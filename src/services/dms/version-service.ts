
import { prisma as globalPrisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/auth/auth-types";
import { StorageService } from "@/lib/dms/storage";
import { createAuditLog } from "@/lib/audit";
import {
    FileTooLargeError,
    // StorageUploadFailedError, // Handled by StorageService now
    VersionConflictError
} from "@/lib/dms/storage/errors";
import { DocumentNotFoundError } from "@/lib/dms/errors";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export class VersionService {
    /**
     * uploadNewVersion
     * 
     * Orchestrates the upload of a new document version.
     * Ensures storage and database are synchronized.
     */
    static async uploadNewVersion(params: {
        tenantId: number;
        documentId: string;
        fileBuffer: Buffer | Uint8Array;
        originalFileName: string;
        mimeType: string;
        user: AuthUser;
    }) {
        const {
            tenantId,
            documentId,
            fileBuffer,
            originalFileName,
            mimeType,
            user
        } = params;

        // 1. Enforce file size limit
        if (fileBuffer.byteLength > MAX_FILE_SIZE) {
            throw new FileTooLargeError(fileBuffer.byteLength, MAX_FILE_SIZE);
        }

        // 2. Validate document exists and belongs to tenant
        const document = await globalPrisma.document.findUnique({
            where: { id: documentId, tenantId },
            select: { id: true, status: true, expiryDate: true, title: true } // Select needed fields
        });

        if (!document) {
            throw new DocumentNotFoundError(documentId, tenantId);
        }

        // 2.5. HARDENING: Status & Expiry Enforcement
        const { getEffectiveDocumentStatus } = await import("@/lib/dms/workflowEngine");
        const { DomainViolationError } = await import("@/lib/dms/errors");

        const effectiveStatus = getEffectiveDocumentStatus(document);

        if (effectiveStatus === "EXPIRED") {
            throw new DomainViolationError("Cannot upload version to an EXPIRED document.");
        }

        // Only allow uploads in DRAFT or REJECTED states
        const ALLOWED_UPLOAD_STATES = ["DRAFT", "REJECTED"];
        if (!ALLOWED_UPLOAD_STATES.includes(document.status)) {
            throw new DomainViolationError(`Version upload only allowed in DRAFT or REJECTED states. Current: ${document.status}`);
        }

        // 3. Determine next versionNumber
        const lastVersion = await globalPrisma.documentVersion.findFirst({
            where: { documentId, tenantId },
            orderBy: { versionNumber: "desc" },
            select: { versionNumber: true }
        });

        const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1;

        // 4. Document versioning & Storage
        // We let StorageService handle key generation and upload to the correct provider

        // 5. Upload file to storage provider via service
        const uploadResult = await StorageService.uploadFile({
            tenantId,
            documentId,
            versionNumber: nextVersionNumber,
            body: fileBuffer,
            metadata: {
                size: fileBuffer.byteLength,
                mimeType,
                extension: originalFileName.split('.').pop() || ''
            }
        });

        // 6. Database Transaction
        return await globalPrisma.$transaction(async (tx: any) => {
            // Check for race condition on version number
            // findFirst used for explicit tenantId scoping compliance
            const existingVersion = await tx.documentVersion.findFirst({
                where: {
                    documentId,
                    tenantId,
                    versionNumber: nextVersionNumber
                }
            });

            if (existingVersion) {
                // If collision, we might need to rollback storage or retry
                // For V1, we throw conflict
                throw new VersionConflictError(documentId, nextVersionNumber);
            }

            // a. Create DocumentVersion record
            const version = await tx.documentVersion.create({
                data: {
                    documentId,
                    tenantId,
                    versionNumber: nextVersionNumber,
                    fileName: originalFileName,
                    fileSize: fileBuffer.byteLength,
                    mimeType,
                    storageKey: uploadResult.storageKey,
                    createdById: user.sub,
                }
            });

            // b. Update document pointers and metadata
            await tx.document.update({
                where: { id: documentId, tenantId },
                data: {
                    currentVersionId: version.id,
                    updatedById: user.sub
                }
            });

            // c. Create Audit Log
            await createAuditLog({
                tenantId,
                actorUserId: user.sub,
                entityType: "VERSION",
                entityId: version.id, // Using version ID as entity ID
                action: "DMS.VERSION_CREATE",
                details: `Created version ${nextVersionNumber} for document ${documentId}. Key: ${uploadResult.storageKey}`,
                metadata: {
                    versionNumber: nextVersionNumber,
                    documentId,
                    title: document.title, // Include title for audit display
                    fileName: originalFileName
                }
            }, tx);

            return version;
        }, {
            maxWait: 5000, // Wait max 5s for a connection
            timeout: 20000 // Transaction can run for up to 20s (fixes P2028 on slow uploads/locks)
        });
    }

    /**
     * listVersions
     * 
     * Retrieves full version history for a specific document.
     */
    static async listVersions(documentId: string, tenantId: number) {
        return await globalPrisma.documentVersion.findMany({
            where: { documentId, tenantId },
            orderBy: { versionNumber: "desc" },
            select: {
                id: true,
                versionNumber: true,
                fileName: true,
                fileSize: true,
                mimeType: true,
                createdAt: true,
                createdBy: {
                    select: { fullName: true, email: true }
                },
                storageKey: true
            }
        });
    }

    /**
     * getVersionById
     * 
     * Retrieves metadata for a specific document version.
     */
    static async getVersionById(versionId: string, tenantId: number, documentId?: string) {
        return await globalPrisma.documentVersion.findFirst({
            where: {
                id: versionId,
                tenantId,
                ...(documentId && { documentId })
            }
        });
    }
}
