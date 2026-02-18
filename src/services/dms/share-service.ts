
import { prisma as globalPrisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/auth/auth-types";
import { createAuditLog } from "@/lib/audit";
import crypto from "crypto";
import { DocumentStatus } from "@prisma/client";
import { DocumentNotFoundError, ShareLinkNotFoundError, ShareLinkExpiredError } from "@/lib/dms/errors";

export interface CreateShareLinkParams {
    documentId: string;
    tenantId: number;
    user: AuthUser;
    expiresAt?: Date | null;
    maxClicks?: number | null;
}

export class ShareService {
    /**
     * createShareLink
     * 
     * Generates a secure, temporary share link for a document.
     * Only allowed for APPROVED documents as per rules.
     */
    static async createShareLink(params: CreateShareLinkParams, tx?: any) {
        const { documentId, tenantId, user, expiresAt, maxClicks } = params;
        const db = tx || globalPrisma;

        return await db.$transaction(async (innerTx: any) => {
            // 1. Verify document exists and belongs to tenant
            const document = await innerTx.document.findUnique({
                where: { id: documentId, tenantId },
                select: { id: true, title: true, status: true, expiryDate: true }
            });

            if (!document) {
                throw new DocumentNotFoundError(documentId, tenantId);
            }

            // 2. Status Guard: Only APPROVED documents can be shared (and not expired)
            // Dynamic import to avoid circular dependency if workflowEngine imports ShareService (unlikely but safe)
            const { getEffectiveDocumentStatus } = await import("@/lib/dms/workflowEngine");
            const effectiveStatus = getEffectiveDocumentStatus(document);

            if (effectiveStatus !== "APPROVED") { // This covers both non-APPROVED status and "EXPIRED"
                throw new Error(`Only APPROVED and non-expired documents can be shared. Current status: ${effectiveStatus}`);
            }

            // 3. Generate secure random token
            const token = Buffer.from(crypto.randomBytes(32)).toString('hex');

            // 4. Create ShareLink
            const shareLink = await innerTx.shareLink.create({
                data: {
                    documentId,
                    tenantId,
                    token,
                    expiresAt,
                    maxClicks,
                    createdById: user.sub
                }
            });

            // 5. Audit Log
            await createAuditLog({
                tenantId,
                actorUserId: user.sub,
                entityType: "SHARE_LINK", // Distinct entity type
                entityId: shareLink.id,
                action: "DMS.SHARE_CREATE",
                details: `Created share link for document '${document.title}' (ID: ${documentId}).`,
                metadata: {
                    documentId,
                    title: document.title,
                    expiresAt
                }
            }, innerTx);

            return shareLink;
        });
    }

    /**
     * validateShareToken
     * 
     * Validates a share key, increments click count, and returns document info.
     * Internal/Anonymous usage.
     */
    static async validateShareToken(token: string) {
        return await globalPrisma.$transaction(async (tx: any) => {
            const link = await tx.shareLink.findFirst({
                where: { token },
                include: {
                    document: {
                        include: {
                            currentVersion: true,
                            folder: {
                                select: { name: true }
                            }
                        }
                    }
                }
            });

            if (!link) return null;

            // 1. Check link expiry
            if (link.expiresAt && link.expiresAt < new Date()) {
                throw new ShareLinkExpiredError(link.id);
            }

            // 2. Check max clicks
            if (link.maxClicks && link.clickCount >= link.maxClicks) {
                return null;
            }

            // 3. HARDENING: Check Document Status & Expiry
            // Even if link is valid, document must still be APPROVED and not expired
            const { getEffectiveDocumentStatus } = await import("@/lib/dms/workflowEngine");
            const effectiveStatus = getEffectiveDocumentStatus(link.document);

            if (effectiveStatus !== "APPROVED") {
                console.warn(`[ShareService] Blocked access to document ${link.documentId} (Effective Status: ${effectiveStatus}) via share ${token}`);
                return null;
            }

            // Increment clicks and Audit
            const updatedLink = await tx.shareLink.update({
                where: { id: link.id, tenantId: link.tenantId },
                data: { clickCount: { increment: 1 } }
            });

            await createAuditLog({
                tenantId: link.tenantId,
                actorUserId: 0, // System/Anonymous action
                entityType: "DOCUMENT",
                entityId: link.documentId,
                action: "DMS.SHARE_ACCESS",
                details: `Share token accessed for document ${link.documentId}. Click count: ${updatedLink.clickCount}`,
                metadata: {
                    title: link.document.title,
                    shareLinkId: link.id,
                    clickCount: updatedLink.clickCount
                }
            }, tx);

            return {
                document: link.document,
                linkDetails: {
                    id: link.id,
                    expiresAt: link.expiresAt,
                    clickCount: updatedLink.clickCount
                }
            };
        });
    }

    /**
     * revokeShareLink
     * 
     * Deactivates/Deletes a share link.
     */
    static async revokeShareLink(id: string, tenantId: number, user: AuthUser, tx?: any) {
        const db = tx || globalPrisma;

        return await db.$transaction(async (innerTx: any) => {
            // 1. Verify existence
            const shareLink = await innerTx.shareLink.findUnique({
                where: { id, tenantId }
            });

            if (!shareLink) {
                throw new ShareLinkNotFoundError(id);
            }

            // 2. Delete
            await innerTx.shareLink.delete({
                where: { id, tenantId }
            });

            // 3. Audit Log
            await createAuditLog({
                tenantId,
                actorUserId: user.sub,
                entityType: "SHARE_LINK",
                entityId: id,
                action: "DMS.SHARE_REVOKE",
                details: `Revoked share link ${id} for document ${shareLink.documentId}.`,
                metadata: {
                    documentId: shareLink.documentId,
                    // Note: We don't have document title here without an extra query, 
                    // but for revocation the ID is often sufficient or we can rely on details regex fallback if needed.
                    // Or ideally fetching doc title would be better, but avoiding extra query for now unless critical.
                    // Actually, let's just include the ID to be safe.
                }
            }, innerTx);

            return { success: true };
        });
    }

    /**
     * listShareLinks
     * 
     * Lists all active share links for a document.
     */
    static async listShareLinks(tenantId: number, documentId?: string) {
        return await globalPrisma.shareLink.findMany({
            where: {
                tenantId,
                ...(documentId && { documentId })
            },
            orderBy: { createdAt: "desc" },
            include: {
                document: {
                    select: { title: true }
                }
            }
        });
    }
}
