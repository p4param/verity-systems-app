
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
                    contentMode: "FILE",
                    contentJson: null,
                    isFrozen: false,
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
                details: `Created version ${nextVersionNumber} for document ${documentId} (FILE mode). Key: ${uploadResult.storageKey}`,
                metadata: {
                    versionNumber: nextVersionNumber,
                    documentId,
                    title: document.title, // Include title for audit display
                    fileName: originalFileName,
                    contentMode: "FILE"
                }
            }, tx);

            return version;
        }, {
            maxWait: 5000, // Wait max 5s for a connection
            timeout: 20000 // Transaction can run for up to 20s (fixes P2028 on slow uploads/locks)
        });
    }

    /**
     * saveInlineVersion
     * 
     * Saves a new document version with INLINE content (JSON).
     * Enforces Rule 1 & 2.
     */
    static async saveInlineVersion(params: {
        tenantId: number;
        documentId: string;
        contentJson: any;
        user: AuthUser;
    }) {
        const { tenantId, documentId, contentJson, user } = params;

        // 1. Validate document
        const document = await globalPrisma.document.findUnique({
            where: { id: documentId, tenantId },
            select: { id: true, status: true, title: true }
        });

        if (!document) {
            throw new DocumentNotFoundError(documentId, tenantId);
        }

        // 2. Governance: Check status (Must be DRAFT or REJECTED)
        const ALLOWED_STATES = ["DRAFT", "REJECTED"];
        if (!ALLOWED_STATES.includes(document.status)) {
            const { DomainViolationError } = await import("@/lib/dms/errors");
            throw new DomainViolationError(`Inline content can only be saved in DRAFT or REJECTED states. Current: ${document.status}`);
        }

        // 3. Determine next versionNumber
        const lastVersion = await globalPrisma.documentVersion.findFirst({
            where: { documentId, tenantId },
            orderBy: { versionNumber: "desc" },
            select: { versionNumber: true, isFrozen: true, contentMode: true }
        });

        // Rule: Cannot switch contentMode in the SAME version if frozen (handled by version increment)
        // Rule 2: Primary content can be edited ONLY IF doc.status = DRAFT AND version.isFrozen = false
        // However, we usually create a NEW version or update the LATEST if it's a DRAFT?
        // In this system, every "Save" seems to create a new version number? 
        // Based on uploadNewVersion, it ALWAYS increments. 
        // If we want "Drafting" to happen in place, we might need a different logic.
        // But the prompt says "For each DocumentVersion: Exactly ONE primary content... Freeze on submission".
        // This implies when you are in DRAFT status, you might have multiple versions.

        const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1;

        return await globalPrisma.$transaction(async (tx: any) => {
            // Check for race condition
            const existingVersion = await tx.documentVersion.findFirst({
                where: { documentId, tenantId, versionNumber: nextVersionNumber }
            });
            if (existingVersion) throw new VersionConflictError(documentId, nextVersionNumber);

            // 4. Create record
            const version = await tx.documentVersion.create({
                data: {
                    documentId,
                    tenantId,
                    versionNumber: nextVersionNumber,
                    contentMode: "INLINE",
                    contentJson,
                    storageKey: null, // PDF snapshot generated on approval
                    isFrozen: false,
                    createdById: user.sub,
                }
            });

            // 5. Update document pointer
            await tx.document.update({
                where: { id: documentId, tenantId },
                data: {
                    currentVersionId: version.id,
                    updatedById: user.sub
                }
            });

            // 6. Audit Log
            await createAuditLog({
                tenantId,
                actorUserId: user.sub,
                entityType: "VERSION",
                entityId: version.id,
                action: "DMS.VERSION_CREATE",
                details: `Created version ${nextVersionNumber} for document ${documentId} (INLINE mode).`,
                metadata: {
                    versionNumber: nextVersionNumber,
                    documentId,
                    title: document.title,
                    contentMode: "INLINE"
                }
            }, tx);

            return version;
        });
    }

    /**
     * listVersions
     * 
     * Retrieves full version history for a specific document.
     */
    static async listVersions(documentId: string, tenantId: number) {
        // Fetch all ancestor documents to show complete history
        // Use require to avoid circular dependency issues if any, though importing DocumentService is cleaner
        const { DocumentService } = await import("./document-service");
        const ancestorIds = await DocumentService.getAncestorDocumentIds(documentId, tenantId);
        console.log(`[DEBUG] listVersions for ${documentId}, Ancestors: ${ancestorIds.join(', ')}`);

        return await globalPrisma.documentVersion.findMany({
            where: {
                documentId: { in: ancestorIds },
                tenantId
            },
            orderBy: {
                createdAt: "desc" // Sort by creation time to interleave properly, or versionNumber if purely linear
                // VersionNumber restarts at 1 for each new document. 
                // So sorting by createdAt desc gives the most recent first across all documents.
            },
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
                storageKey: true,
                document: {
                    select: {
                        id: true,
                        documentNumber: true,
                        status: true
                    }
                }
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
