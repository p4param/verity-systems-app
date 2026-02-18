
import { prisma } from "@/lib/prisma";
import { AuthUser } from "@/lib/auth/auth-types";
import { createAuditLog } from "@/lib/audit";
import { DocumentStatus } from "@prisma/client";

export class CommentService {
    static async addComment(
        documentId: string,
        tenantId: number,
        user: AuthUser,
        content: string
    ) {
        if (!content || content.trim().length === 0) {
            throw new Error("Comment content cannot be empty.");
        }

        return await prisma.$transaction(async (tx) => {
            const doc = await tx.document.findUnique({
                where: { id: documentId, tenantId }
            });

            if (!doc) throw new Error("Document not found.");

            // Rule: "Allowed only in DRAFT or IN_REVIEW"
            if (doc.status === DocumentStatus.APPROVED || doc.status === DocumentStatus.OBSOLETE) {
                throw new Error("Cannot comment on APPROVED or OBSOLETE documents.");
            }

            const comment = await tx.documentComment.create({
                data: {
                    documentId,
                    tenantId,
                    userId: user.sub,
                    content
                }
            });

            await createAuditLog({
                tenantId,
                actorUserId: user.sub,
                entityType: "DOCUMENT",
                entityId: documentId,
                action: "DMS.COMMENT_ADDED",
                details: "Added a comment to document.",
                module: "DMS",
                metadata: { commentId: comment.id }
            }, tx);

            return comment;
        });
    }

    static async getComments(documentId: string, tenantId: number) {
        return await prisma.documentComment.findMany({
            where: { documentId, tenantId },
            orderBy: { createdAt: 'asc' },
            include: {
                user: {
                    select: { fullName: true, email: true }
                }
            }
        });
    }
}
