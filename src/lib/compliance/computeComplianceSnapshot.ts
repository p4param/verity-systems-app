
import { prisma } from "@/lib/prisma";
import { DocumentStatus, LegalHoldTargetType, ReviewStatus } from "@prisma/client";
import { subDays, isBefore, addDays } from "date-fns";

export async function computeComplianceSnapshot(tenantId: number) {
    return await prisma.$transaction(async (tx) => {
        const now = new Date();
        const thirtyDaysAgo = subDays(now, 30);
        const thirtyDaysFromNow = addDays(now, 30);
        const sevenDaysAgo = subDays(now, 7);

        // 1. Basic Document Metrics
        const totalDocuments = await tx.document.count({ where: { tenantId } });
        if (totalDocuments === 0) {
            return await upsertEmptySnapshot(tx, tenantId, now);
        }

        const approvedDocuments = await tx.document.count({
            where: { tenantId, status: DocumentStatus.APPROVED }
        });

        const draftDocuments = await tx.document.count({
            where: { tenantId, status: DocumentStatus.DRAFT }
        });

        const expiredDocuments = await tx.document.count({
            where: {
                tenantId,
                status: DocumentStatus.APPROVED,
                expiryDate: { lt: now }
            }
        });

        const documentsNearExpiry = await tx.document.count({
            where: {
                tenantId,
                status: DocumentStatus.APPROVED,
                expiryDate: {
                    gt: now,
                    lt: thirtyDaysFromNow
                }
            }
        });

        const documentsUnderReview = await tx.document.count({
            where: {
                tenantId,
                status: DocumentStatus.SUBMITTED
            }
        });

        // 2. Review SLA Metrics
        const overdueReviews = await tx.documentReview.count({
            where: {
                tenantId,
                status: ReviewStatus.PENDING,
                createdAt: { lt: sevenDaysAgo }
            }
        });

        // 3. Acknowledgement Metrics
        const docsWithAcks = await tx.documentAcknowledgement.groupBy({
            by: ['documentId'],
            where: { tenantId }
        });
        const unacknowledgedDocuments = Math.max(0, approvedDocuments - docsWithAcks.length);

        // 4. Access & Compliance Metrics
        const activeShareLinks = await tx.shareLink.count({
            where: {
                tenantId,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: now } }
                ]
            }
        });

        // 5. Legal Hold Governance Integration
        const activeHolds = await tx.legalHold.findMany({
            where: { tenantId, isActive: true },
            include: { targets: true }
        });
        const legalHoldCount = activeHolds.length;

        // Resolve targets to Document IDs
        const heldDocumentIds = new Set<string>();
        for (const hold of activeHolds) {
            for (const target of hold.targets) {
                if (target.targetType === LegalHoldTargetType.DOCUMENT) {
                    heldDocumentIds.add(target.targetId);
                } else if (target.targetType === LegalHoldTargetType.FOLDER) {
                    const docs = await tx.document.findMany({
                        where: { tenantId, folderId: target.targetId },
                        select: { id: true }
                    });
                    docs.forEach(d => heldDocumentIds.add(d.id));
                } else if (target.targetType === LegalHoldTargetType.DOCUMENT_TYPE) {
                    const docs = await tx.document.findMany({
                        where: { tenantId, typeId: target.targetId },
                        select: { id: true }
                    });
                    docs.forEach(d => heldDocumentIds.add(d.id));
                } else if (target.targetType === LegalHoldTargetType.TENANT) {
                    const docs = await tx.document.findMany({
                        where: { tenantId },
                        select: { id: true }
                    });
                    docs.forEach(d => heldDocumentIds.add(d.id));
                }
            }
        }
        const documentsUnderHold = heldDocumentIds.size;

        // Violation Detection (Audit Logs)
        const violationAttempts = await tx.auditLog.count({
            where: {
                tenantId,
                action: { in: ["DELETE_DOCUMENT", "DELETE_VERSION", "AUTO_RETENTION_PURGE"] },
                entityType: "DOCUMENT",
                entityId: { in: Array.from(heldDocumentIds) },
                createdAt: { gte: thirtyDaysAgo }
            }
        });
        const holdViolationAttempts = violationAttempts;

        // Recent Release Events
        const holdReleaseEventsLast30Days = await tx.legalHold.count({
            where: {
                tenantId,
                releasedAt: { gte: thirtyDaysAgo }
            }
        });

        // Stale Hold check (e.g., > 1 year)
        const oneYearAgo = subDays(new Date(), 365);
        const holdsNearingReview = activeHolds.filter((h: any) => isBefore(h.startDate, oneYearAgo)).length;

        // Integrity Verification (Verify held documents still exist)
        let missingHeldDocuments = 0;
        if (heldDocumentIds.size > 0) {
            const existingHeldDocs = await tx.document.count({
                where: { id: { in: Array.from(heldDocumentIds) } }
            });
            missingHeldDocuments = Math.max(0, heldDocumentIds.size - existingHeldDocs);
        }

        // Legal Hold Integrity Sub-Score
        let legalHoldIntegrityScore = 100;
        if (missingHeldDocuments > 0) {
            legalHoldIntegrityScore = 0; // Critical failure
        } else if (holdViolationAttempts > 0) {
            legalHoldIntegrityScore = Math.max(0, 100 - (holdViolationAttempts * 20));
        }

        // 6. Audit & Integrity Metrics
        const docsWithAudit = await tx.auditLog.groupBy({
            by: ['entityId'],
            where: {
                tenantId,
                entityType: "DOCUMENT"
            }
        });
        const auditCoverageScore = Math.floor((docsWithAudit.length / totalDocuments) * 100);

        const stuckDocuments = await tx.document.count({
            where: {
                tenantId,
                status: { in: [DocumentStatus.DRAFT, DocumentStatus.SUBMITTED] },
                updatedAt: { lt: thirtyDaysAgo }
            }
        });
        const workflowIntegrityScore = Math.max(0, 100 - Math.floor((stuckDocuments / totalDocuments) * 100));

        // 7. Sub-Score Calculations
        const reviewSLAScore = Math.max(0, 100 - (overdueReviews * 10));
        const expiryControlScore = approvedDocuments > 0
            ? Math.max(0, 100 - Math.floor((expiredDocuments / approvedDocuments) * 100))
            : 100;
        const accessGovernanceScore = Math.max(0, 100 - (activeShareLinks * 2));
        const auditCompletenessScore = auditCoverageScore;
        const retentionComplianceScore = 100; // Placeholder

        // 8. Weighted Compliance Score (V3 Updated Weights)
        // workflowIntegrity: 25%, reviewSLA: 20%, expiryControl: 15%, 
        // accessGovernance: 15%, auditCompleteness: 10%, retentionCompliance: 5%, 
        // legalHoldIntegrity: 10%
        const complianceScore = Math.floor(
            (workflowIntegrityScore * 0.25) +
            (reviewSLAScore * 0.20) +
            (expiryControlScore * 0.15) +
            (accessGovernanceScore * 0.15) +
            (auditCompletenessScore * 0.10) +
            (retentionComplianceScore * 0.05) +
            (legalHoldIntegrityScore * 0.10)
        );

        // 9. Upsert Snapshot
        const snapshotDate = new Date();
        snapshotDate.setHours(0, 0, 0, 0);

        const snapshot = await tx.complianceSnapshot.upsert({
            where: {
                tenantId_snapshotDate: {
                    tenantId,
                    snapshotDate
                }
            },
            update: {
                totalDocuments,
                approvedDocuments,
                draftDocuments,
                expiredDocuments,
                documentsNearExpiry,
                documentsUnderReview,
                overdueReviews,
                unacknowledgedDocuments,
                activeShareLinks,
                legalHoldCount,
                documentsUnderHold,
                holdReleaseEventsLast30Days,
                holdViolationAttempts,
                retentionViolations: 0,
                auditCoverageScore,
                workflowIntegrityScore,
                legalHoldIntegrityScore,
                complianceScore,
                lastComputedAt: now
            },
            create: {
                tenantId,
                snapshotDate,
                totalDocuments,
                approvedDocuments,
                draftDocuments,
                expiredDocuments,
                documentsNearExpiry,
                documentsUnderReview,
                overdueReviews,
                unacknowledgedDocuments,
                activeShareLinks,
                legalHoldCount,
                documentsUnderHold,
                holdReleaseEventsLast30Days,
                holdViolationAttempts,
                retentionViolations: 0,
                auditCoverageScore,
                workflowIntegrityScore,
                legalHoldIntegrityScore,
                complianceScore,
                lastComputedAt: now
            }
        });

        // 10. Alert Generation
        await generateAlerts(tx, tenantId, {
            expiredDocuments,
            overdueReviews,
            auditCoverageScore,
            holdViolationAttempts,
            missingHeldDocuments,
            holdsNearingReview
        });

        return snapshot;
    }, { timeout: 60000 }); // Increased timeout for heavier checks
}

async function upsertEmptySnapshot(tx: any, tenantId: number, now: Date) {
    const snapshotDate = new Date();
    snapshotDate.setHours(0, 0, 0, 0);
    return await tx.complianceSnapshot.upsert({
        where: { tenantId_snapshotDate: { tenantId, snapshotDate } },
        update: { lastComputedAt: now },
        create: {
            tenantId,
            snapshotDate,
            totalDocuments: 0,
            approvedDocuments: 0,
            draftDocuments: 0,
            expiredDocuments: 0,
            documentsNearExpiry: 0,
            documentsUnderReview: 0,
            overdueReviews: 0,
            unacknowledgedDocuments: 0,
            activeShareLinks: 0,
            legalHoldCount: 0,
            documentsUnderHold: 0,
            holdReleaseEventsLast30Days: 0,
            holdViolationAttempts: 0,
            retentionViolations: 0,
            auditCoverageScore: 100,
            workflowIntegrityScore: 100,
            legalHoldIntegrityScore: 100,
            complianceScore: 100,
            lastComputedAt: now
        }
    });
}

async function generateAlerts(tx: any, tenantId: number, metrics: any) {
    const {
        expiredDocuments,
        overdueReviews,
        auditCoverageScore,
        holdViolationAttempts,
        missingHeldDocuments,
        holdsNearingReview
    } = metrics;

    const alertTypes = [];

    if (expiredDocuments > 0) {
        alertTypes.push({
            type: "EXPIRED_DOCUMENTS",
            severity: "HIGH",
            message: `${expiredDocuments} approved document(s) have expired and require attention.`
        });
    }

    if (overdueReviews > 0) {
        alertTypes.push({
            type: "OVERDUE_REVIEWS",
            severity: "MEDIUM",
            message: `${overdueReviews} document reviews are overdue (>7 days).`
        });
    }

    if (auditCoverageScore < 80) {
        alertTypes.push({
            type: "LOW_AUDIT_COVERAGE",
            severity: "MEDIUM",
            message: `Audit coverage is low (${auditCoverageScore}%). Ensure all documents are being correctly logged.`
        });
    }

    // Legal Hold Alerts
    if (holdViolationAttempts > 0) {
        alertTypes.push({
            type: "LEGAL_HOLD_VIOLATION_ATTEMPT",
            severity: "HIGH",
            message: `Detected ${holdViolationAttempts} attempted deletion(s) of documents under active legal hold.`
        });
    }

    if (missingHeldDocuments > 0) {
        alertTypes.push({
            type: "LEGAL_HOLD_MISSING_DOCUMENT",
            severity: "CRITICAL",
            message: `CRITICAL: ${missingHeldDocuments} document(s) under legal hold are missing or were bypassed!`
        });
    }

    if (holdsNearingReview > 0) {
        alertTypes.push({
            type: "LEGAL_HOLD_STALE_REVIEW",
            severity: "LOW",
            message: `${holdsNearingReview} legal hold(s) have been active for over a year and should be reviewed.`
        });
    }

    for (const alert of alertTypes) {
        const existing = await tx.complianceAlert.findFirst({
            where: {
                tenantId,
                type: alert.type,
                resolvedAt: null
            }
        });

        if (!existing) {
            await tx.complianceAlert.create({
                data: {
                    tenantId,
                    ...alert
                }
            });
        }
    }
}
