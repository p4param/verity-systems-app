
import { prisma as globalPrisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/auth/auth-types";
import { createAuditLog } from "@/lib/audit";
import { DocumentStatus } from "@prisma/client";
import { resolveEffectiveStatus } from "@/lib/dms/status-utils";
import { FolderService } from "./folder-service";
import { DocumentNotFoundError, FolderNotFoundError, DocumentLockedError } from "@/lib/dms/errors";

export interface CreateDocumentParams {
    title: string;
    description?: string;
    folderId?: string | null;
    expiryDate?: Date;
    typeId?: string;
    tenantId: number;
    user: AuthUser;
}

export interface UpdateDocumentMetadataParams {
    id: string;
    title?: string;
    description?: string;
    folderId?: string;
    expiryDate?: Date | null;
    typeId?: string;
    tenantId: number;
    user: AuthUser;
}

export class DocumentService {
    /**
     * createDocument
     * 
     * Creates a new document record. Initial status is DRAFT.
     * Requires folderId as per rules.
     */
    static async createDocument(params: CreateDocumentParams, tx?: any) {
        const { title, description, folderId, expiryDate, typeId, tenantId, user } = params;
        const db = tx || globalPrisma;

        return await db.$transaction(async (innerTx: any) => {
            // 0. Enforce Folder Selection (No Root Documents)
            if (!folderId) {
                throw new Error("Documents must be created within a folder. Please select a folder.");
            }

            // 1. Verify folder exists and belongs to tenant (if folderId provided)
            let folder = null;
            if (folderId) {
                folder = await innerTx.folder.findUnique({
                    where: { id: folderId, tenantId }
                });

                if (!folder) {
                    throw new FolderNotFoundError(folderId, tenantId);
                }
            }

            // 2. Generate Document Number
            const year = new Date().getFullYear();

            // Upsert sequence for the current year
            const sequence = await innerTx.documentSequence.upsert({
                where: {
                    tenantId_year: {
                        tenantId,
                        year
                    }
                },
                update: {
                    current: { increment: 1 }
                },
                create: {
                    tenantId,
                    year,
                    current: 1
                }
            });

            const documentNumber = `DOC-${year}-${String(sequence.current).padStart(5, '0')}`;

            // 3. Create document with status DRAFT
            const document = await innerTx.document.create({
                data: {
                    title,
                    description,
                    folderId: folderId || null,
                    tenantId,
                    status: DocumentStatus.DRAFT,
                    createdById: user.sub,
                    updatedById: user.sub,
                    documentNumber,
                    typeId,
                    expiryDate
                }
            });

            // 4. Audit Log
            await createAuditLog({
                tenantId,
                actorUserId: user.sub,
                entityType: "DOCUMENT",
                entityId: document.id,
                action: "DMS.DOCUMENT_CREATE",
                details: `Created document '${title}' (${documentNumber}) in ${folder ? `folder '${folder.name}'` : 'root folder'}.`,
                metadata: {
                    title,
                    documentNumber,
                    folderId,
                    folderName: folder?.name,
                    typeId,
                    expiryDate
                }
            }, innerTx);

            return document;
        });
    }

    /**
     * getDocumentById
     * 
     * Retrieves a document with its versions and folder info.
     * Resolves effective status (computes EXPIRED if applicable).
     * Includes effectivePermissions for the requesting user.
     */
    static async getDocumentById(id: string, tenantId: number, user: AuthUser) {
        const document = await globalPrisma.document.findUnique({
            where: { id, tenantId },
            include: {
                currentVersion: {
                    select: {
                        id: true,
                        versionNumber: true,
                        fileName: true,
                        mimeType: true,
                        fileSize: true
                    }
                },
                versions: {
                    orderBy: { versionNumber: "desc" },
                    include: {
                        createdBy: {
                            select: { fullName: true, email: true }
                        }
                    }
                },
                folder: {
                    select: { id: true, name: true, parentId: true }
                },
                createdBy: {
                    select: { fullName: true, email: true }
                },
                updatedBy: {
                    select: { fullName: true, email: true }
                },
                type: {
                    select: { id: true, name: true }
                }
            }
        });

        if (!document) return null;

        const { PermissionService } = require("../../lib/dms/services/PermissionService");
        const effectivePermissions = await PermissionService.getEffectivePermissions(user, document.folderId);

        return {
            ...document,
            effectiveStatus: resolveEffectiveStatus(document),
            effectivePermissions
        };
    }

    /**
     * listDocuments
     * 
     * Lists documents in a folder or by search criteria.
     * Returns effective status for each document.
     */
    /**
     * listDocuments
     * 
     * Lists documents with advanced filtering, sorting, and pagination.
     */
    static async listDocuments(params: {
        tenantId: number;
        folderId?: string;
        includeSubfolders?: boolean;
        search?: string;
        status?: DocumentStatus[];
        typeIds?: string[];
        expiryFilter?: 'expired' | 'expiring_30' | 'expiring_90' | 'custom';
        expiryFrom?: Date;
        expiryTo?: Date;
        versionFrom?: number;
        versionTo?: number;
        sortBy?: 'documentNumber' | 'title' | 'status' | 'expiryDate' | 'version' | 'createdAt';
        sortOrder?: 'asc' | 'desc';
        page?: number;
        limit?: number;
    }) {
        const {
            tenantId,
            folderId,
            includeSubfolders,
            search,
            status,
            typeIds,
            expiryFilter,
            expiryFrom,
            expiryTo,
            versionFrom,
            versionTo,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            page = 1,
            limit = 50
        } = params;

        // 1. Build Where Clause
        const where: any = {
            tenantId
        };

        // Folder Filter
        if (folderId) {
            if (includeSubfolders) {
                const folderIds = await FolderService.getRecursiveFolderIds(folderId, tenantId);
                where.folderId = { in: folderIds };
            } else {
                where.folderId = folderId;
            }
        }

        // Search (Title or Document Number)
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { documentNumber: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Status Filter
        if (status && status.length > 0) {
            where.status = { in: status };
        }

        // Type Filter
        if (typeIds && typeIds.length > 0) {
            where.typeId = { in: typeIds };
        }

        // Version Filter
        if (versionFrom !== undefined || versionTo !== undefined) {
            where.currentVersion = {
                versionNumber: {
                    ...(versionFrom !== undefined && { gte: versionFrom }),
                    ...(versionTo !== undefined && { lte: versionTo })
                }
            };
        }

        // Expiry Filter
        const now = new Date();
        if (expiryFilter) {
            switch (expiryFilter) {
                case 'expired':
                    // Expired: date < now AND status = APPROVED (usually) or just date check?
                    // User requirement: "expired -> expiryDate < now AND status = APPROVED"
                    where.expiryDate = { lt: now };
                    where.status = DocumentStatus.APPROVED;
                    break;
                case 'expiring_30':
                    const plus30 = new Date(now);
                    plus30.setDate(plus30.getDate() + 30);
                    where.expiryDate = { gte: now, lte: plus30 };
                    break;
                case 'expiring_90':
                    const plus90 = new Date(now);
                    plus90.setDate(plus90.getDate() + 90);
                    where.expiryDate = { gte: now, lte: plus90 };
                    break;
                case 'custom':
                    if (expiryFrom || expiryTo) {
                        where.expiryDate = {
                            ...(expiryFrom && { gte: expiryFrom }),
                            ...(expiryTo && { lte: expiryTo })
                        };
                    }
                    break;
            }
        }

        // 2. Build OrderBy
        let orderBy: any = {};
        switch (sortBy) {
            case 'documentNumber':
                orderBy = { documentNumber: sortOrder };
                break;
            case 'title':
                orderBy = { title: sortOrder };
                break;
            case 'status':
                orderBy = { status: sortOrder };
                break;
            case 'expiryDate':
                orderBy = { expiryDate: sortOrder };
                break;
            case 'version':
                // Sort by related model field
                orderBy = { currentVersion: { versionNumber: sortOrder } };
                break;
            case 'createdAt':
            default:
                orderBy = { createdAt: sortOrder };
                break;
        }

        // 3. Pagination
        // Cap limit
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const skip = (Math.max(page, 1) - 1) * safeLimit;

        // 4. Update Query: Get Count and Data
        const [total, documents] = await Promise.all([
            globalPrisma.document.count({ where }),
            globalPrisma.document.findMany({
                where,
                include: {
                    currentVersion: {
                        select: { id: true, fileName: true, versionNumber: true }
                    },
                    createdBy: {
                        select: { fullName: true, email: true }
                    },
                    updatedBy: {
                        select: { fullName: true, email: true }
                    },
                    type: {
                        select: { id: true, name: true }
                    }
                },
                orderBy,
                skip,
                take: safeLimit
            })
        ]);

        return {
            data: documents.map(doc => ({
                ...doc,
                effectiveStatus: resolveEffectiveStatus(doc)
            })),
            meta: {
                total,
                page,
                limit: safeLimit,
                totalPages: Math.ceil(total / safeLimit)
            }
        };
    }

    /**
     * updateDocumentMetadata
     * 
     * Updates document metadata.
     * ONLY allowed if status is DRAFT or REJECTED.
     * Never mutates status directly.
     */
    static async updateDocumentMetadata(params: UpdateDocumentMetadataParams, tx?: any) {
        const { id, title, description, folderId, expiryDate, typeId, tenantId, user } = params;
        const db = tx || globalPrisma;

        return await db.$transaction(async (innerTx: any) => {
            // 1. Verify existence and ownership
            const document = await innerTx.document.findUnique({
                where: { id, tenantId }
            });

            if (!document) {
                throw new DocumentNotFoundError(id, tenantId);
            }

            // 2. Guard: Only DRAFT or REJECTED allowed for metadata updates
            if (document.status !== DocumentStatus.DRAFT && document.status !== DocumentStatus.REJECTED) {
                throw new DocumentLockedError(id, document.status);
            }

            // 3. If folderId changing, verify new folder
            if (folderId && folderId !== document.folderId) {
                const newFolder = await innerTx.folder.findUnique({
                    where: { id: folderId, tenantId }
                });
                if (!newFolder) {
                    throw new FolderNotFoundError(folderId, tenantId);
                }
            }

            // 3. Update document (excluding status)
            const updatedDocument = await innerTx.document.update({
                where: { id, tenantId },
                data: {
                    ...(title && { title }),
                    ...(description !== undefined && { description }),
                    ...(folderId && { folderId }),
                    ...(expiryDate !== undefined && { expiryDate }),
                    ...(typeId && { typeId }),
                    updatedById: user.sub
                }
            });

            // 4. Audit Log
            await createAuditLog({
                tenantId,
                actorUserId: user.sub,
                entityType: "DOCUMENT",
                entityId: id,
                action: "DMS.DOCUMENT_UPDATE",
                details: `Updated metadata for document ${id}. ${title ? `Title: ${title}. ` : ''}`,
                metadata: {
                    title: title || document.title, // Always include title for audit display
                    folderId,
                    folderName: folderId ? (await innerTx.folder.findUnique({ where: { id: folderId } }))?.name : undefined
                }
            }, innerTx);

            return {
                ...updatedDocument,
                effectiveStatus: resolveEffectiveStatus(updatedDocument)
            };
        });
    }

    /**
     * deleteDocument
     * 
     * Deletes a document and its version history.
     * ONLY allowed if status is DRAFT.
     */
    static async deleteDocument(id: string, tenantId: number, user: AuthUser, tx?: any) {
        const db = tx || globalPrisma;

        return await db.$transaction(async (innerTx: any) => {
            // 1. Verify existence
            const document = await innerTx.document.findUnique({
                where: { id, tenantId }
            });

            if (!document) {
                throw new DocumentNotFoundError(id, tenantId);
            }

            // 2. Guard: Only DRAFT allowed for deletion
            if (document.status !== DocumentStatus.DRAFT) {
                throw new DocumentLockedError(id, document.status);
            }

            // 3. Delete document (Cascade handles versions and history)
            await innerTx.document.delete({
                where: { id, tenantId }
            });

            // 4. Audit Log
            await createAuditLog({
                tenantId,
                actorUserId: user.sub,
                entityType: "DOCUMENT",
                entityId: id,
                action: "DMS.DOCUMENT_DELETE",
                details: `Deleted draft document '${document.title}' (ID: ${id}).`,
                metadata: {
                    title: document.title
                }
            }, innerTx);

            return { success: true };
        });
    }
}
