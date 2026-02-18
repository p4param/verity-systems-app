
import { prisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/auth/auth-types";
import { createAuditLog } from "@/lib/audit";
import { DocumentStatus } from "@prisma/client";

export class AcknowledgementService {
    static async acknowledge(
        documentId: string,
        tenantId: number,
        user: AuthUser
    ) {
        return await prisma.$transaction(async (tx) => {
            const doc = await tx.document.findUnique({
                where: { id: documentId, tenantId }
            });

            if (!doc) throw new Error("Document not found.");

            // Rule: "Only for APPROVED documents"
            if (doc.status !== DocumentStatus.APPROVED) {
                throw new Error("Cannot acknowledge a document that is not APPROVED.");
            }

            if (!doc.currentVersionId) {
                throw new Error("Document has no current version.");
            }

            // Create Acknowledgement
            // DB Unique constraint handles duplicates.
            const ack = await tx.documentAcknowledgement.create({
                data: {
                    documentId,
                    versionId: doc.currentVersionId,
                    userId: user.sub,
                    tenantId
                }
            });

            await createAuditLog({
                tenantId,
                actorUserId: user.sub,
                entityType: "DOCUMENT",
                entityId: documentId,
                action: "DMS.ACKNOWLEDGED",
                details: `Document acknowledged (Version: ${doc.currentVersionId}).`,
                module: "DMS"
            }, tx);

            return ack;
        });
    }

    static async getAcknowledgements(documentId: string, tenantId: number) {
        return await prisma.documentAcknowledgement.findMany({
            where: { documentId, tenantId },
            include: { user: { select: { fullName: true } } },
            orderBy: { acknowledgedAt: 'desc' }
        });
    }
}
