
import { prisma as globalPrisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/auth/auth-types";
import { StorageService } from "@/lib/dms/storage";
import { createAuditLog } from "@/lib/audit";
import {
    FileTooLargeError,
    // StorageUploadFailedError, // Handled by StorageService now
    VersionConflictError
} from "@/lib/dms/storage/errors";
import { DocumentNotFoundError, DomainViolationError } from "@/lib/dms/errors";

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
        const document = await globalPrisma.document.findFirst({
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
            maxWait: 5000,
            timeout: 30000
        });
    }

    /**
     * saveStructuredVersion
     * 
     * Saves a new document version with STRUCTURED content (JSON).
     * Enforces Rule 1 & 2.
     */
    static async saveStructuredVersion(params: {
        tenantId: number;
        documentId: string;
        contentJson: any;
        user: AuthUser;
    }) {
        const { tenantId: tid, documentId: did, contentJson, user } = params;

        // 1. Validate document
        const document = await globalPrisma.document.findFirst({
            where: { id: did, tenantId: tid },
            select: { id: true, status: true, title: true, currentVersionId: true }
        });

        if (!document) {
            throw new DocumentNotFoundError(did, tid);
        }

        // 2. Governance: Check status (Must be DRAFT or REJECTED)
        const ALLOWED_STATES = ["DRAFT", "REJECTED"];
        if (!ALLOWED_STATES.includes(document.status)) {
            throw new DomainViolationError(`Structured content can only be saved in DRAFT or REJECTED states. Current: ${document.status}`);
        }

        return await globalPrisma.$transaction(async (tx: any) => {
            // 3. Find the current draft version (if any)
            const currentVersion = document.currentVersionId
                ? await tx.documentVersion.findFirst({
                    where: { id: document.currentVersionId, documentId: did, tenantId: tid },
                    select: { id: true, isFrozen: true, versionNumber: true }
                })
                : null;

            // 4a. If there's an existing unfrozen draft version → UPDATE it in-place
            if (currentVersion && !currentVersion.isFrozen) {
                const updated = await tx.documentVersion.update({
                    where: { id: currentVersion.id },
                    data: {
                        contentJson,
                        contentMode: "STRUCTURED",
                    }
                });

                // Touch document timestamp
                await tx.document.update({
                    where: { id: did },
                    data: { updatedById: user.sub }
                });

                await createAuditLog({
                    tenantId: tid,
                    actorUserId: user.sub,
                    entityType: "VERSION",
                    entityId: updated.id,
                    action: "DMS.VERSION_CONTENT_UPDATED",
                    details: `Updated structured content for version ${currentVersion.versionNumber} of document ${did}.`,
                    metadata: { versionNumber: currentVersion.versionNumber, documentId: did }
                }, tx);

                return updated;
            }

            // 4b. No current version, or frozen → CREATE a new version
            const lastVersion = await tx.documentVersion.findFirst({
                where: { documentId: did, tenantId: tid },
                orderBy: { versionNumber: "desc" },
                select: { versionNumber: true }
            });
            const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1;

            // Race condition guard
            const conflict = await tx.documentVersion.findFirst({
                where: { documentId: did, tenantId: tid, versionNumber: nextVersionNumber }
            });
            if (conflict) throw new VersionConflictError(did, nextVersionNumber);

            const version = await tx.documentVersion.create({
                data: {
                    documentId: did,
                    tenantId: tid,
                    versionNumber: nextVersionNumber,
                    contentMode: "STRUCTURED",
                    contentJson,
                    storageKey: null,
                    isFrozen: false,
                    createdById: user.sub,
                }
            });

            // Update document pointer
            await tx.document.update({
                where: { id: did },
                data: { currentVersionId: version.id, updatedById: user.sub }
            });

            await createAuditLog({
                tenantId: tid,
                actorUserId: user.sub,
                entityType: "VERSION",
                entityId: version.id,
                action: "DMS.VERSION_CREATE",
                details: `Created version ${nextVersionNumber} for document ${did} (STRUCTURED mode).`,
                metadata: { versionNumber: nextVersionNumber, documentId: did, title: document.title, contentMode: "STRUCTURED" }
            }, tx);

            return version;
        }, { timeout: 30_000 });
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
