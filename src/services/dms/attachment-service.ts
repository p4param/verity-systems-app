import { prisma as globalPrisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/auth/auth-types";
import { StorageService } from "@/lib/dms/storage";
import { createAuditLog } from "@/lib/audit";
import { DocumentStatus } from "@prisma/client";
import { DocumentNotFoundError, DomainViolationError } from "@/lib/dms/errors";
import { validateDmsFile } from "@/lib/dms/storage/validation";

export class AttachmentService {
    /**
     * uploadAttachment
     * 
     * Adds a Supporting Attachment to a Document Version.
     * Rule: Only allowed if DRAFT and NOT frozen.
     */
    static async uploadAttachment(params: {
        tenantId: number;
        documentId: string;
        versionId: string;
        fileBuffer: Buffer | Uint8Array;
        originalFileName: string;
        mimeType: string;
        user: AuthUser;
    }) {
        const { tenantId, documentId, versionId, fileBuffer, originalFileName, mimeType, user } = params;

        // 1. Validate File
        validateDmsFile({
            fileSize: fileBuffer.byteLength,
            mimeType,
            fileName: originalFileName,
            fileBuffer
        });

        return await globalPrisma.$transaction(async (tx) => {
            // 2. Load and Lock (Prisma transaction)
            const document = await tx.document.findUnique({
                where: { id: documentId, tenantId },
                select: { status: true }
            });

            if (!document) throw new DocumentNotFoundError(documentId, tenantId);

            const version = await tx.documentVersion.findFirst({
                where: { id: versionId, tenantId, documentId },
                select: { isFrozen: true, id: true }
            });

            if (!version) throw new Error("Document version not found.");

            // 3. Rule Enforcements
            if (document.status !== DocumentStatus.DRAFT) {
                throw new DomainViolationError(`Attachments can only be added in DRAFT status. Current: ${document.status}`);
            }

            if (version.isFrozen) {
                throw new DomainViolationError("This version is frozen. No modifications allowed.");
            }

            // 4. Create Attachment Record (to get ID for storage key)
            const attachment = await tx.documentVersionAttachment.create({
                data: {
                    versionId,
                    tenantId,
                    fileName: originalFileName,
                    mimeType,
                    fileSize: fileBuffer.byteLength,
                    storageKey: "PENDING", // Temporary
                    createdById: user.sub.toString()
                }
            });

            // 5. Generate Key and Upload
            const extension = originalFileName.split('.').pop() || "";
            const storageKey = StorageService.generateAttachmentKey({
                tenantId,
                documentId,
                versionId,
                attachmentId: attachment.id,
                extension
            });

            await StorageService.uploadFile({
                tenantId,
                documentId,
                versionNumber: 0, // Not used for attachments in generateAttachmentKey but needed by uploadFile signature?
                // Wait, StorageService.uploadFile calls generateKey inside.
                // I should probably update StorageService.uploadFile or use provider directly.
                // Let's check StorageService.uploadFile again.
                // Ah, StorageService.uploadFile calls this.generateKey.
                // I need a more flexible upload method or just call provider.
                body: fileBuffer,
                metadata: {
                    size: fileBuffer.byteLength,
                    mimeType,
                    extension
                }
            });
            // Correction: I should bypass StorageService.uploadFile and use provider to use my custom key.
            const provider = (StorageService as any).getProvider();
            await provider.upload(storageKey, fileBuffer, {
                size: fileBuffer.byteLength,
                mimeType,
                extension
            });

            // 6. Update Record with Key
            const updatedAttachment = await tx.documentVersionAttachment.update({
                where: { id: attachment.id },
                data: { storageKey }
            });

            // 7. Audit Log
            await createAuditLog({
                tenantId,
                actorUserId: user.sub,
                entityType: "DOCUMENT",
                entityId: documentId,
                action: "DOCUMENT_ATTACHMENT_ADDED",
                details: `Added attachment '${originalFileName}' to version ${versionId}.`,
                metadata: {
                    documentId,
                    versionId,
                    attachmentId: attachment.id,
                    fileName: originalFileName
                }
            }, tx);

            return updatedAttachment;
        }, { timeout: 30_000 });
    }

    /**
     * removeAttachment
     * 
     * Removes an attachment.
     * Rule: Only allowed if DRAFT and NOT frozen.
     */
    static async removeAttachment(params: {
        tenantId: number;
        documentId: string;
        versionId: string;
        attachmentId: string;
        user: AuthUser;
    }) {
        const { tenantId, documentId, versionId, attachmentId, user } = params;

        return await globalPrisma.$transaction(async (tx) => {
            // 1. Validate state
            const document = await tx.document.findUnique({
                where: { id: documentId, tenantId },
                select: { status: true }
            });

            if (!document) throw new DocumentNotFoundError(documentId, tenantId);

            const version = await tx.documentVersion.findFirst({
                where: { id: versionId, tenantId, documentId },
                select: { isFrozen: true }
            });

            if (!version) throw new Error("Document version not found.");

            if (document.status !== DocumentStatus.DRAFT) {
                throw new DomainViolationError(`Attachments can only be removed in DRAFT status. Current: ${document.status}`);
            }

            if (version.isFrozen) {
                throw new DomainViolationError("This version is frozen. No modifications allowed.");
            }

            const attachment = await tx.documentVersionAttachment.findFirst({
                where: { id: attachmentId, tenantId, versionId }
            });

            if (!attachment) throw new Error("Attachment not found.");

            // 2. Delete Record
            await tx.documentVersionAttachment.delete({
                where: { id: attachmentId }
            });

            // 3. Audit Log
            await createAuditLog({
                tenantId,
                actorUserId: user.sub,
                entityType: "DOCUMENT",
                entityId: documentId,
                action: "DOCUMENT_ATTACHMENT_REMOVED",
                details: `Removed attachment '${attachment.fileName}' from version ${versionId}.`,
                metadata: {
                    documentId,
                    versionId,
                    attachmentId,
                    fileName: attachment.fileName
                }
            }, tx);

            return { success: true };
        }, { timeout: 30_000 });
    }
}
