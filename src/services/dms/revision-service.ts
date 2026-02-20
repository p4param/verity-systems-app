import { prisma as globalPrisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/auth/auth-types";
import { createAuditLog } from "@/lib/audit";
import { DocumentStatus } from "@prisma/client";
import {
    DocumentNotFoundError,
    DomainViolationError,
    UnauthorizedWorkflowActionError
} from "@/lib/dms/errors";
import { hasPermission } from "@/lib/auth/permission-check";
import { PermissionId } from "@/lib/auth/permission-codes";

export class RevisionService {
    /**
     * reviseDocument
     * 
     * Creates a new revision of an existing APPROVED document.
     * Enforces immutable history and clean lineage.
     */
    static async reviseDocument(params: {
        documentId: string;
        tenantId: number;
        user: AuthUser;
    }) {
        const { documentId, tenantId, user } = params;

        return await globalPrisma.$transaction(async (tx) => {
            // 1. Fetch Original Document
            const originalDoc = await tx.document.findUnique({
                where: { id: documentId, tenantId },
                include: { folder: true } // Need folder to confirm permissions if logic requires
            });

            if (!originalDoc) {
                throw new DocumentNotFoundError(documentId, tenantId);
            }

            // 2. Business Rule Validations

            // a. Must be APPROVED
            if (originalDoc.status !== DocumentStatus.APPROVED) {
                throw new DomainViolationError(
                    `Cannot revise document ${originalDoc.documentNumber}. Only APPROVED documents can be revised. Current status: ${originalDoc.status}`
                );
            }

            // b. Must NOT be superseded already
            if (originalDoc.supersededById) {
                throw new DomainViolationError(
                    `Cannot revise document ${originalDoc.documentNumber}. It has already been superseded.`
                );
            }

            // 3. Security Check: User must have WRITE permission on the folder
            /* 
               Note: We rely on the generic 'DMS_DOCUMENT_CREATE' or similar, 
               but ideally we check folder-level write access. 
               For this implementation, we assume the initial guard/middleware checked basic access,
               and we enforce specific 'WRITE' permission here.
            */
            const hasWrite = await hasPermission({
                user,
                permission: PermissionId.DMS_DOCUMENT_CREATE, // Using CREATE as revision is a creation event
                context: {
                    fileId: originalDoc.folderId || undefined // Contextual check if supported
                }
            });

            if (!hasWrite && !user.roles.includes('admin')) {
                // Fallback for admins or specific logic if hasPermission returns false but user is admin
                // Assuming hasPermission handles admin override.
                throw new UnauthorizedWorkflowActionError("DMS_DOCUMENT_CREATE");
            }

            // 4. Generate New Document Number
            // Logic duplicated from DocumentService or reused? 
            // Ideally reused, but for now we implement generation to ensure it's in the same tx.
            const year = new Date().getFullYear();
            const sequence = await tx.documentSequence.upsert({
                where: {
                    tenantId_year: {
                        tenantId,
                        year
                    }
                },
                update: { current: { increment: 1 } },
                create: { tenantId, year, current: 1 }
            });
            const newDocumentNumber = `DOC-${year}-${String(sequence.current).padStart(5, '0')}`;

            // 5. Create New Document (Revision)
            const newDoc = await tx.document.create({
                data: {
                    title: originalDoc.title,
                    description: originalDoc.description,
                    documentNumber: newDocumentNumber,
                    status: DocumentStatus.DRAFT,
                    tenantId: originalDoc.tenantId,
                    folderId: originalDoc.folderId,
                    typeId: originalDoc.typeId,
                    createdById: user.sub,
                    updatedById: user.sub,

                    // Linkage
                    supersedesId: originalDoc.id
                }
            });

            // 6. Clone Version Content & Attachments
            const currentVersion = await tx.documentVersion.findUnique({
                where: { id: originalDoc.currentVersionId as string, tenantId },
                include: { attachments: true }
            });

            let newVersionId: string | undefined = undefined;

            if (currentVersion) {
                // Determine next versionNumber for the NEW document (it starts at 1)
                const nextVersionNumber = 1;

                // Create new version for the revision
                const newVersion = await tx.documentVersion.create({
                    data: {
                        documentId: newDoc.id,
                        tenantId,
                        versionNumber: nextVersionNumber,
                        fileName: currentVersion.fileName,
                        fileSize: currentVersion.fileSize,
                        mimeType: currentVersion.mimeType,
                        storageKey: currentVersion.storageKey,
                        contentType: currentVersion.contentType,
                        contentJson: currentVersion.contentJson,
                        isFrozen: false, // New revision is NOT frozen
                        createdById: user.sub,
                    }
                });

                newVersionId = newVersion.id;

                // Update new document pointer
                await tx.document.update({
                    where: { id: newDoc.id, tenantId },
                    data: { currentVersionId: newVersion.id }
                });

                // Clone Attachments
                if (currentVersion.attachments.length > 0) {
                    await tx.documentVersionAttachment.createMany({
                        data: currentVersion.attachments.map((att: any) => ({
                            versionId: newVersion.id,
                            tenantId,
                            fileName: att.fileName,
                            storageKey: att.storageKey,
                            mimeType: att.mimeType,
                            fileSize: att.fileSize,
                            createdById: user.sub.toString(), // Ensure string
                        }))
                    });
                }
            }

            // 7. Update Original Document (Mark as Superseded)
            await tx.document.update({
                where: { id: originalDoc.id },
                data: {
                    supersededById: newDoc.id
                }
            });

            // 8. Audit Log
            await createAuditLog({
                tenantId,
                actorUserId: user.sub,
                entityType: "DOCUMENT",
                entityId: newDoc.id,
                action: "DMS.REVISION_CREATED",
                details: `Created revision ${newDoc.documentNumber} superseding ${originalDoc.documentNumber}. Cloned content and ${currentVersion?.attachments.length || 0} attachments.`,
                metadata: {
                    originalDocumentId: originalDoc.id,
                    newDocumentId: newDoc.id,
                    clonedAttachmentsCount: currentVersion?.attachments.length || 0,
                    mapping: `${originalDoc.documentNumber} -> ${newDoc.documentNumber}`
                }
            }, tx);

            return { ...newDoc, currentVersionId: newVersionId };
        });
    }
}
