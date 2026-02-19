
import { prisma } from "@/lib/prisma";
import { ReviewStatus, DocumentStatus } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { AuthUser } from "@/lib/auth/auth-types";

export class ReviewService {
    /**
     * Initializes a review cycle for a document.
     * Transitions document to SUBMITTED state if not already.
     */
    static async startReviewProcess(
        documentId: string,
        tenantId: number,
        initiator: AuthUser,
        reviewers: { userId: number; stage: number }[]
    ) {
        if (reviewers.length === 0) {
            throw new Error("At least one reviewer is required to start a review process.");
        }

        return await prisma.$transaction(async (tx) => {
            // 1. Verify Document Exists & Status
            const doc = await tx.document.findUnique({
                where: { id: documentId, tenantId },
            });

            if (!doc) throw new Error("Document not found.");
            if (doc.status !== DocumentStatus.DRAFT && doc.status !== DocumentStatus.REJECTED) {
                throw new Error(`Document must be in DRAFT or REJECTED state to submit. Current: ${doc.status}`);
            }

            // 2. Create Review Entries
            for (const reviewer of reviewers) {
                await tx.documentReview.create({
                    data: {
                        documentId,
                        tenantId,
                        reviewerUserId: reviewer.userId,
                        stageNumber: reviewer.stage,
                        status: ReviewStatus.PENDING,
                    },
                });
            }

            // 3. Update Document Status to SUBMITTED (In Review)
            // Note: In V1, SUBMITTED implies "In Review".
            await tx.document.update({
                where: { id: documentId },
                data: { status: DocumentStatus.SUBMITTED },
            });

            // 4. Audit Log
            await createAuditLog({
                tenantId,
                actorUserId: initiator.sub,
                entityType: "DOCUMENT",
                entityId: documentId,
                action: "DMS.REVIEW_STARTED",
                details: `Review started with ${reviewers.length} reviewers.`,
                module: "DMS",
                metadata: { reviewCount: reviewers.length }
            }, tx);

            return await tx.document.findUnique({
                where: { id: documentId }
            });
        });
    }

    /**
     * Processes a reviewer's decision (Approve/Reject).
     */
    static async submitReview(
        documentId: string,
        tenantId: number,
        reviewerUserId: number,
        decision: "APPROVE" | "REJECT",
        comment?: string
    ) {
        return await prisma.$transaction(async (tx) => {
            // 1. Find the pending review for this user
            const review = await tx.documentReview.findFirst({
                where: {
                    documentId,
                    tenantId,
                    reviewerUserId,
                    status: ReviewStatus.PENDING,
                },
            });

            if (!review) {
                throw new Error("No pending review found for this user.");
            }

            // 2. Update Review Status
            const newStatus = decision === "APPROVE" ? ReviewStatus.APPROVED : ReviewStatus.REJECTED;
            await tx.documentReview.update({
                where: { id: review.id },
                data: {
                    status: newStatus,
                    reviewedAt: new Date(),
                    comment: comment,
                },
            });

            // 3. Handle Decision Logic
            if (decision === "REJECT") {
                // REJECT: Immediately reject document, cancel other reviews.
                await tx.document.update({
                    where: { id: documentId },
                    data: { status: DocumentStatus.REJECTED },
                });

                await tx.documentReview.updateMany({
                    where: {
                        documentId,
                        tenantId,
                        status: ReviewStatus.PENDING,
                    },
                    data: { status: ReviewStatus.CANCELLED },
                });

                await createAuditLog({
                    tenantId,
                    actorUserId: reviewerUserId,
                    entityType: "DOCUMENT",
                    entityId: documentId,
                    action: "DMS.REVIEW_REJECTED",
                    details: `Reviewer ${reviewerUserId} rejected the document.`,
                    module: "DMS",
                    metadata: { comment }
                }, tx);

                return { status: "REJECTED" };
            } else {
                // APPROVE: Check if all reviews in ALL stages are approved?
                // Or implementing staged gating? 
                // For V2 MVP, let's check if ALL pending reviews are done.
                // Or better, check if ANY pending reviews exist.

                const pendingCount = await tx.documentReview.count({
                    where: {
                        documentId,
                        tenantId,
                        status: ReviewStatus.PENDING,
                    },
                });

                if (pendingCount === 0) {
                    // All reviews completed. Check if any were rejected? (Already handled above)
                    // If we are here, it means all were APPROVED (or cancelled, but cancelled usually implies rejection).
                    // Double check we don't have mixed states if we allowed concurrent stages.

                    // Transition Document to APPROVED
                    await tx.document.update({
                        where: { id: documentId },
                        data: { status: DocumentStatus.APPROVED },
                    });

                    await createAuditLog({
                        tenantId,
                        actorUserId: reviewerUserId, // The last reviewer triggers approval
                        entityType: "DOCUMENT",
                        entityId: documentId,
                        action: "DMS.DOCUMENT_APPROVED",
                        details: "All reviews completed. Document APPROVED.",
                        module: "DMS"
                    }, tx);

                    return { status: "APPROVED" };
                }

                await createAuditLog({
                    tenantId,
                    actorUserId: reviewerUserId,
                    entityType: "DOCUMENT",
                    entityId: documentId,
                    action: "DMS.REVIEW_APPROVED",
                    details: `Reviewer ${reviewerUserId} approved. ${pendingCount} reviews remaining.`,
                    module: "DMS",
                    metadata: { comment }
                }, tx);

                return { status: "IN_PROGRESS", pendingReviews: pendingCount };
            }
        });
    }

    /**
     * Withdraws a document from review (Creator action).
     */
    static async withdrawReview(documentId: string, tenantId: number, userId: number) {
        return await prisma.$transaction(async (tx) => {
            const doc = await tx.document.findUnique({
                where: { id: documentId, tenantId },
            });

            if (!doc || doc.status !== DocumentStatus.SUBMITTED) {
                throw new Error("Document is not in review.");
            }

            // Cancel all reviews
            await tx.documentReview.updateMany({
                where: { documentId, tenantId, status: ReviewStatus.PENDING },
                data: { status: ReviewStatus.CANCELLED },
            });

            // Set Doc to DRAFT
            await tx.document.update({
                where: { id: documentId },
                data: { status: DocumentStatus.DRAFT },
            });

            await createAuditLog({
                tenantId,
                actorUserId: userId,
                entityType: "DOCUMENT",
                entityId: documentId,
                action: "DMS.REVIEW_WITHDRAWN",
                details: "Document withdrawn from review.",
                module: "DMS"
            }, tx);

            return await tx.document.findUnique({
                where: { id: documentId }
            });
        });
    }

    /**
     * Sends reminders for pending reviews older than X days.
     */
    static async sendReminders(tenantId: number, daysThreshold: number = 3) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

        const pendingReviews = await prisma.documentReview.findMany({
            where: {
                tenantId,
                status: ReviewStatus.PENDING,
                createdAt: { lt: thresholdDate },
            },
            include: {
                ReviewReminderLog: {
                    orderBy: { sentAt: 'desc' },
                    take: 1
                },
                reviewer: { select: { email: true, fullName: true, id: true } },
                document: { select: { title: true, documentNumber: true, id: true } }
            }
        });

        const results = [];

        for (const review of pendingReviews) {
            const lastReminder = review.ReviewReminderLog[0];
            if (lastReminder && lastReminder.sentAt > thresholdDate) {
                continue;
            }

            // In a real system, we'd queue an email job here.

            await prisma.$transaction(async (tx) => {
                await tx.reviewReminderLog.create({
                    data: {
                        documentReviewId: review.id,
                        tenantId
                    }
                });

                await createAuditLog({
                    tenantId,
                    actorUserId: 0, // System
                    entityType: "DOCUMENT",
                    entityId: review.documentId,
                    action: "DMS.REMINDER_SENT",
                    details: `Reminder sent to ${review.reviewer.email} for document ${review.document.title}`,
                    module: "DMS"
                }, tx);
            });
            results.push(review.id);
        }
        return results;
    }

    /**
     * Retrieves all reviews for a document.
     */
    static async getReviews(documentId: string, tenantId: number) {
        return await prisma.documentReview.findMany({
            where: { documentId, tenantId },
            include: {
                reviewer: { select: { id: true, fullName: true, email: true } }
            },
            orderBy: [
                { stageNumber: 'asc' },
                { reviewer: { fullName: 'asc' } }
            ]
        });
    }
    /**
     * Retrieves review history for a document and all its ancestors.
     */
    static async getReviewHistory(documentId: string, tenantId: number) {
        // Dynamic import to avoid circular dependency
        const { DocumentService } = await import("@/services/dms/document-service");
        const ancestorIds = await DocumentService.getAncestorDocumentIds(documentId, tenantId);

        return await prisma.documentReview.findMany({
            where: {
                documentId: { in: ancestorIds },
                tenantId
            },
            include: {
                reviewer: { select: { id: true, fullName: true, email: true } },
                document: { select: { id: true, documentNumber: true, status: true, title: true } }
            },
            orderBy: [
                { document: { createdAt: 'desc' } }, // Newest document version first
                { stageNumber: 'asc' },
                { reviewer: { fullName: 'asc' } }
            ]
        });
    }
}
