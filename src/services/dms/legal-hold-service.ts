import { prisma as _prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalPrisma = _prisma as any;
import { AuthUser } from "@/lib/auth/auth-types";
import { createAuditLog } from "@/lib/audit";
import { LegalHoldViolationError, DocumentNotFoundError } from "@/lib/dms/errors";

// Local type alias — matches the LegalHoldTargetType enum in schema.prisma
// Remove and replace with: import { LegalHoldTargetType } from "@prisma/client"
// once `prisma generate` has been run after the migration.
type LegalHoldTargetType = "DOCUMENT" | "FOLDER" | "DOCUMENT_TYPE" | "TENANT";

// ─── Core Enforcement ────────────────────────────────────────────────────────

/**
 * assertNotUnderLegalHold
 *
 * Enforcement gate — must be called AFTER RBAC and workflow checks, but BEFORE
 * any destructive operation. Throws LegalHoldViolationError (HTTP 423) if the
 * document has isUnderLegalHold = true.
 *
 * Logs a tamper-evident audit event on every blocked attempt.
 */
export async function assertNotUnderLegalHold(
    documentId: string,
    tenantId: number,
    tx?: any
): Promise<void> {
    const db = tx ?? globalPrisma;
    const doc = await db.document.findUnique({
        where: { id: documentId, tenantId },
        select: { isUnderLegalHold: true, title: true }
    });

    if (!doc) throw new DocumentNotFoundError(documentId, tenantId);

    if (doc.isUnderLegalHold) {
        // Log the blocked attempt (fire-and-forget — don't block the error throw)
        createAuditLog({
            tenantId,
            entityType: "DOCUMENT",
            entityId: documentId,
            action: "DMS.LEGAL_HOLD_VIOLATION_BLOCKED",
            details: `Blocked destructive operation on '${doc.title}' (ID: ${documentId}) — document is under an active Legal Hold.`,
            metadata: { documentId, documentTitle: doc.title }
        }, globalPrisma).catch(console.error);

        throw new LegalHoldViolationError(documentId);
    }
}

// ─── Hold CRUD ───────────────────────────────────────────────────────────────

export interface CreateHoldParams {
    tenantId: number;
    name: string;
    description?: string;
    reason: string;
    startDate: Date;
    endDate?: Date;
    user: AuthUser;
}

export class LegalHoldService {
    /**
     * createHold
     *
     * Creates a new Legal Hold record. Does NOT attach any targets yet.
     * Requires LEGAL_HOLD_CREATE permission (enforced at route level).
     */
    static async createHold(params: CreateHoldParams) {
        const { tenantId, name, description, reason, startDate, endDate, user } = params;

        const hold = await globalPrisma.legalHold.create({
            data: {
                tenantId,
                name,
                description,
                reason,
                imposedByUserId: String(user.sub),
                startDate,
                endDate,
                isActive: true
            }
        });

        await createAuditLog({
            tenantId,
            actorUserId: Number(user.sub),
            entityType: "LEGAL_HOLD",
            entityId: hold.id,
            action: "DMS.LEGAL_HOLD_CREATED",
            details: `Legal Hold '${name}' created. Reason: ${reason}`,
            metadata: { name, reason, startDate, endDate }
        });

        return hold;
    }

    /**
     * listHolds
     *
     * Lists all Legal Holds for the tenant with target counts.
     */
    static async listHolds(tenantId: number, activeOnly?: boolean) {
        return globalPrisma.legalHold.findMany({
            where: {
                tenantId,
                ...(activeOnly !== undefined ? { isActive: activeOnly } : {})
            },
            include: {
                _count: { select: { targets: true } }
            },
            orderBy: { createdAt: "desc" }
        });
    }

    /**
     * attachTargets
     *
     * Attaches one or more targets to an existing Legal Hold and marks all
     * affected documents with isUnderLegalHold = true.
     *
     * Runs inside a single transaction to guarantee consistency.
     */
    static async attachTargets(params: {
        tenantId: number;
        holdId: string;
        targets: { targetType: LegalHoldTargetType; targetId: string }[];
        user: AuthUser;
    }) {
        const { tenantId, holdId, targets, user } = params;

        return globalPrisma.$transaction(async (tx) => {
            // 1. Verify hold belongs to this tenant and is active
            const hold = await tx.legalHold.findFirst({
                where: { id: holdId, tenantId, isActive: true }
            });
            if (!hold) throw new Error(`Legal Hold ${holdId} not found or already released.`);

            let totalDocsAffected = 0;

            for (const { targetType, targetId } of targets) {
                // 2. Upsert target row (prevent duplicates via @@unique)
                await tx.legalHoldTarget.upsert({
                    where: {
                        tenantId_legalHoldId_targetType_targetId: {
                            tenantId, legalHoldId: holdId, targetType, targetId
                        }
                    },
                    update: {},
                    create: { tenantId, legalHoldId: holdId, targetType, targetId }
                });

                // 3. Mark affected documents
                const count = await LegalHoldService._markDocuments(tx, tenantId, targetType, targetId, true);
                totalDocsAffected += count;

                // 4. Mark affected folder(s) if applicable
                await LegalHoldService._markFolders(tx, tenantId, targetType, targetId, true);
            }

            await createAuditLog({
                tenantId,
                actorUserId: Number(user.sub),
                entityType: "LEGAL_HOLD",
                entityId: holdId,
                action: "DMS.LEGAL_HOLD_ATTACHED",
                details: `Attached ${targets.length} target(s) to Legal Hold '${hold.name}'. ${totalDocsAffected} document(s) now under hold.`,
                metadata: { holdId, holdName: hold.name, targets, documentCount: totalDocsAffected }
            }, tx);

            return { holdId, targetsAttached: targets.length, documentsAffected: totalDocsAffected };
        }, { timeout: 60_000 });
    }

    /**
     * releaseHold
     *
     * Releases an active Legal Hold. For each previously affected document,
     * recalculates whether any OTHER active hold still covers it before
     * clearing the isUnderLegalHold flag.
     */
    static async releaseHold(holdId: string, tenantId: number, user: AuthUser) {
        return globalPrisma.$transaction(async (tx) => {
            // 1. Fetch hold + its targets
            const hold = await tx.legalHold.findFirst({
                where: { id: holdId, tenantId, isActive: true },
                include: { targets: true }
            });
            if (!hold) throw new Error(`Legal Hold ${holdId} not found or already released.`);

            // 2. Collect all document and folder IDs currently affected by this hold
            const affectedDocIds = new Set<string>();
            const affectedFolderIds = new Set<string>();

            for (const target of hold.targets) {
                const docIds = await LegalHoldService._collectDocumentIds(tx, tenantId, target.targetType, target.targetId);
                docIds.forEach(id => affectedDocIds.add(id));

                const folderIds = await LegalHoldService._collectFolderIds(tx, tenantId, target.targetType, target.targetId);
                folderIds.forEach(id => affectedFolderIds.add(id));
            }

            // 3. Mark hold as released
            const releasedAt = new Date();
            await tx.legalHold.update({
                where: { id: holdId },
                data: { isActive: false, releasedAt, releasedByUserId: String(user.sub) }
            });

            // 4. Recalculate each document — only clear if no other active hold remains
            let clearedDocCount = 0;
            for (const docId of affectedDocIds) {
                const stillHeld = await LegalHoldService._isDocumentCoveredByAnotherHold(
                    tx, tenantId, docId, holdId
                );
                if (!stillHeld) {
                    await tx.document.update({
                        where: { id: docId, tenantId },
                        data: { isUnderLegalHold: false }
                    });
                    clearedDocCount++;
                }
            }

            // 5. Recalculate each folder - only clear if no other active hold remains
            for (const fldId of affectedFolderIds) {
                const stillHeld = await LegalHoldService._isFolderCoveredByAnotherHold(
                    tx, tenantId, fldId, holdId
                );
                if (!stillHeld) {
                    await tx.folder.update({
                        where: { id: fldId, tenantId },
                        data: { isUnderLegalHold: false }
                    });
                }
            }

            await createAuditLog({
                tenantId,
                actorUserId: Number(user.sub),
                entityType: "LEGAL_HOLD",
                entityId: holdId,
                action: "DMS.LEGAL_HOLD_RELEASED",
                details: `Legal Hold '${hold.name}' released. ${clearedDocCount} document(s) cleared from hold.`,
                metadata: { holdId, holdName: hold.name, releasedAt, affectedDocumentCount: clearedDocCount }
            }, tx);

            return { holdId, releasedAt, documentsCleared: clearedDocCount };
        }, { timeout: 120_000 });
    }

    /**
     * listTargets
     *
     * Returns all targets attached to a Legal Hold for the given tenant.
     */
    static async listTargets(holdId: string, tenantId: number) {
        return globalPrisma.legalHoldTarget.findMany({
            where: { legalHoldId: holdId, tenantId }
        });
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /**
     * Marks or unmarks documents as under legal hold based on target type.
     * Returns the count of documents affected.
     */
    private static async _markDocuments(
        tx: any,
        tenantId: number,
        targetType: LegalHoldTargetType,
        targetId: string,
        underHold: boolean
    ): Promise<number> {
        const value = { isUnderLegalHold: underHold };

        switch (targetType) {
            case "DOCUMENT": {
                const result = await tx.document.updateMany({
                    where: { id: targetId, tenantId },
                    data: value
                });
                return result.count;
            }
            case "FOLDER": {
                const folderIds = await LegalHoldService._getAllChildFolderIds(tx, tenantId, targetId);
                const result = await tx.document.updateMany({
                    where: { folderId: { in: folderIds }, tenantId },
                    data: value
                });
                return result.count;
            }
            case "DOCUMENT_TYPE": {
                const result = await tx.document.updateMany({
                    where: { typeId: targetId, tenantId },
                    data: value
                });
                return result.count;
            }
            case "TENANT": {
                const result = await tx.document.updateMany({
                    where: { tenantId },
                    data: value
                });
                return result.count;
            }
            default:
                return 0;
        }
    }

    /**
     * Collects document IDs based on target type (used during release recalculation).
     */
    private static async _collectDocumentIds(
        tx: any,
        tenantId: number,
        targetType: LegalHoldTargetType,
        targetId: string
    ): Promise<string[]> {
        let docs: { id: string }[] = [];

        switch (targetType) {
            case "DOCUMENT":
                docs = await tx.document.findMany({ where: { id: targetId, tenantId }, select: { id: true } });
                break;
            case "FOLDER": {
                const folderIds = await LegalHoldService._getAllChildFolderIds(tx, tenantId, targetId);
                docs = await tx.document.findMany({ where: { folderId: { in: folderIds }, tenantId }, select: { id: true } });
                break;
            }
            case "DOCUMENT_TYPE":
                docs = await tx.document.findMany({ where: { typeId: targetId, tenantId }, select: { id: true } });
                break;
            case "TENANT":
                docs = await tx.document.findMany({ where: { tenantId }, select: { id: true } });
                break;
        }

        return docs.map(d => d.id);
    }

    /**
     * Recursively collects a folder ID and all its descendant folder IDs.
     */
    private static async _getAllChildFolderIds(
        tx: any,
        tenantId: number,
        rootFolderId: string
    ): Promise<string[]> {
        const all: string[] = [rootFolderId];
        const queue = [rootFolderId];

        while (queue.length > 0) {
            const parentId = queue.shift()!;
            const children = await tx.folder.findMany({
                where: { parentId, tenantId },
                select: { id: true }
            });
            for (const child of children) {
                all.push(child.id);
                queue.push(child.id);
            }
        }

        return all;
    }

    /**
     * Checks if a document is covered by any active Legal Hold OTHER than the one being released.
     */
    private static async _isDocumentCoveredByAnotherHold(
        tx: any,
        tenantId: number,
        documentId: string,
        excludeHoldId: string
    ): Promise<boolean> {
        // Find all active holds for this tenant (excluding the one being released)
        const activeHolds = await tx.legalHold.findMany({
            where: { tenantId, isActive: true, id: { not: excludeHoldId } },
            include: { targets: true }
        });

        for (const hold of activeHolds) {
            for (const target of hold.targets) {
                const coveredIds = await LegalHoldService._collectDocumentIds(tx, tenantId, target.targetType, target.targetId);
                if (coveredIds.includes(documentId)) return true;
            }
        }

        return false;
    }

    /**
     * Marks or unmarks folders as under legal hold based on target type.
     */
    private static async _markFolders(
        tx: any,
        tenantId: number,
        targetType: LegalHoldTargetType,
        targetId: string,
        underHold: boolean
    ): Promise<void> {
        const value = { isUnderLegalHold: underHold };

        switch (targetType) {
            case "FOLDER": {
                const folderIds = await LegalHoldService._getAllChildFolderIds(tx, tenantId, targetId);
                await tx.folder.updateMany({
                    where: { id: { in: folderIds }, tenantId },
                    data: value
                });
                break;
            }
            case "TENANT":
                await tx.folder.updateMany({
                    where: { tenantId },
                    data: value
                });
                break;
        }
    }

    /**
     * Collects folder IDs based on target type.
     */
    private static async _collectFolderIds(
        tx: any,
        tenantId: number,
        targetType: LegalHoldTargetType,
        targetId: string
    ): Promise<string[]> {
        let folders: { id: string }[] = [];

        switch (targetType) {
            case "FOLDER":
                return await LegalHoldService._getAllChildFolderIds(tx, tenantId, targetId);
            case "TENANT":
                folders = await tx.folder.findMany({ where: { tenantId }, select: { id: true } });
                break;
        }

        return folders.map(f => f.id);
    }

    /**
     * Checks if a folder is covered by any active Legal Hold OTHER than the one being released.
     */
    private static async _isFolderCoveredByAnotherHold(
        tx: any,
        tenantId: number,
        folderId: string,
        excludeHoldId: string
    ): Promise<boolean> {
        const activeHolds = await tx.legalHold.findMany({
            where: { tenantId, isActive: true, id: { not: excludeHoldId } },
            include: { targets: true }
        });

        for (const hold of activeHolds) {
            for (const target of hold.targets) {
                const coveredIds = await LegalHoldService._collectFolderIds(tx, tenantId, target.targetType, target.targetId);
                if (coveredIds.includes(folderId)) return true;
            }
        }

        return false;
    }
}
