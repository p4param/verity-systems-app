
import { DocumentStatus } from "@prisma/client";
import { AuthUser } from "@/lib/auth/auth-types";
import { TRANSITION_MATRIX, WorkflowAction } from "./transition-matrix";
import { createAuditLog } from "@/lib/audit";
import { ReviewService } from "./services/ReviewService";
import { PermissionService } from "./services/PermissionService";
import {
    InvalidWorkflowActionError,
    DocumentNotFoundError,
    InvalidTransitionError,
    UnauthorizedWorkflowActionError,
    StateMismatchError,
    DomainViolationError
} from "./errors";
import { PdfService } from "@/services/dms/pdf-service";
import { ApprovalService } from "./services/ApprovalService";

/**
 * Maps workflow actions to required Folder Permissions.
 * If an action isn't listed, it defaults to Global RBAC only (or handled specifically).
 */
function getRequiredFolderPermission(action: WorkflowAction): "READ" | "WRITE" | "REVIEW" | null {
    switch (action) {
        case "submit": return "WRITE";   // Need write access to submit? Or just READ? Usually WRITE.
        case "approve": return "REVIEW";
        case "reject": return "REVIEW";
        case "revise": return "WRITE";
        case "withdraw": return "WRITE"; // Creator or Write access
        case "obsolete": return "WRITE"; // System/Admin usually, but if folder perm allows...
        default: return null;
    }
}

export function getEffectiveDocumentStatus(document: { status: DocumentStatus, expiryDate: Date | null, effectiveDate?: Date | null }): DocumentStatus | "EXPIRED" | "PENDING_EFFECTIVE" {
    if (document.status === DocumentStatus.APPROVED) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (document.expiryDate && document.expiryDate < startOfToday) {
            return "EXPIRED";
        }
        if (document.effectiveDate && document.effectiveDate > now) {
            return "PENDING_EFFECTIVE";
        }
    }
    return document.status;
}

/**
 * transitionDocumentStatus
 * 
 * The single, transactional engine for DMS document status transitions.
 * This function enforces strict rules and ensures consistency across the DMS module.
 */
export async function transitionDocumentStatus(
    prisma: any,
    documentId: string,
    tenantId: number,
    action: WorkflowAction,
    user: AuthUser,
    comment?: string
) {
    const transition = TRANSITION_MATRIX[action];
    if (!transition) {
        throw new InvalidWorkflowActionError(action);
    }

    const execute = async (tx: any) => {
        // a. Load document with strict tenant scoping (Read Phase)
        const document = await tx.document.findUnique({
            where: { id: documentId, tenantId },
            select: {
                status: true,
                expiryDate: true,
                title: true,
                effectiveDate: true,
                folderId: true,
                createdById: true,
                supersedesId: true, // Added for obsolete logic
                supersededById: true, // Added for Manual Obsolete Logic
                documentNumber: true // Added for audit log
            }
        });

        if (!document) {
            throw new DocumentNotFoundError(documentId, tenantId);
        }

        // Perms: Check Folder/Creator logic before proceeding
        let hasAccess = false;

        // Special Case: Withdraw by Creator
        if (action === "withdraw" && document.createdById === user.sub) {
            hasAccess = true;
        } else {
            // General Permission Check (Folder -> Global)
            const requiredFolderPerm = getRequiredFolderPermission(action);

            if (requiredFolderPerm && document.folderId) {
                // If folder exists, check Folder Permission with Global Fallback
                hasAccess = await PermissionService.checkFolderAccess(
                    user,
                    document.folderId,
                    requiredFolderPerm,
                    transition.permission
                );
            } else {
                // No folder or no specific folder action -> Global RBAC
                hasAccess = user.permissions?.includes(transition.permission) || false;
            }
        }

        if (!hasAccess) {
            throw new UnauthorizedWorkflowActionError(transition.permission);
        }

        // b. Validate Effective Status
        const effectiveStatus = getEffectiveDocumentStatus(document);

        // Block actions on EXPIRED documents (unless we add specific actions for them later)
        if (effectiveStatus === "EXPIRED") {
            throw new DomainViolationError(`Document is EXPIRED. No further actions allowed.`);
        }

        // c. Validate current state matches Matrix requirement
        // Note: For 'approve' in V2, document stays SUBMITTED until final approval.
        // So we strictly check database status.
        if (document.status !== transition.from) {
            throw new InvalidTransitionError(action, document.status, transition.from);
        }

        // d. Business Logic: Rejection requires a comment
        if (action === "reject" && !comment) {
            throw new Error("A comment is required when rejecting a document");
        }

        // e. Business Logic: Manual Obsolete Rules
        if (action === "obsolete") {
            // Rule 1: Must be APPROVED
            if (document.status !== "APPROVED") {
                throw new DomainViolationError("Only APPROVED documents can be marked as OBSOLETE.");
            }

            // Rule 2: Must NOT be Superseded
            // If supersededById is set, a newer version (Draft or Approved) exists.
            // The system handles obsolescence automatically upon approval of the revision.
            // Manual obsolescence would break the chain or create an orphan revision state.
            if ((document as any).supersededById) {
                throw new DomainViolationError("Cannot obsolete a document that has already been superseded by a newer revision.");
            }
        }

        // --- V2 V INTERCEPTION START ---
        // Check if this is a V2 document flow (has reviews)
        // If "withdraw", we always allow V2 interception if status is SUBMITTED
        // But for approve/reject, checking reviews existence is key.

        // For 'withdraw', ReviewService handles it even if no reviews? 
        // No, 'withdraw' is for "In Review". If no reviews exist, V1 SUBMITTED -> DRAFT is logic?
        // V1 didn't have withdraw.
        // If V1 SUBMITTED, can we withdraw? 
        // Yes, if we added it to Matrix.
        // But V1 SUBMITTED usually implies "Waiting for Admin".

        const reviewCount = await tx.documentReview.count({
            where: { documentId, tenantId }
        });

        if (reviewCount > 0 || action === "withdraw") {
            if (action === "approve") {
                // Delegate to ReviewService
                const result = await ReviewService.submitReview(documentId, tenantId, user.sub, "APPROVE", comment);
                return await tx.document.findUnique({ where: { id: documentId } });
            }

            if (action === "reject") {
                // Delegate to ReviewService
                await ReviewService.submitReview(documentId, tenantId, user.sub, "REJECT", comment);
                return await tx.document.findUnique({ where: { id: documentId } });
            }

            if (action === "withdraw") {
                // Delegate to ReviewService
                // But ReviewService.withdrawReview expects Pending reviews?
                // If V1 document (no reviews), ReviewService.withdrawReview might fail if it tries to update reviews?
                // ReviewService.withdrawReview code:
                // updateMany where status=PENDING.
                // If count is 0, it just updates Doc to DRAFT.
                // So it is safe to call even if no reviews exist.
                await ReviewService.withdrawReview(documentId, tenantId, user.sub);
                return await tx.document.findUnique({ where: { id: documentId } });
            }
        }
        // --- V2 INTERCEPTION END ---

        // e. Execute Update (V1 Flow / Default)
        if (action === "approve") {
            await ApprovalService.finalizeDocumentApproval(tx, documentId, tenantId, user.sub);
        } else {
            // We use updateMany with the expected 'from' status in the WHERE clause.
            const updateResult = await tx.document.updateMany({
                where: {
                    id: documentId,
                    tenantId: tenantId,
                    status: transition.from
                },
                data: {
                    status: transition.to,
                    updatedById: user.sub,
                    updatedAt: new Date()
                }
            });

            if (updateResult.count === 0) {
                const currentDoc = await tx.document.findUnique({ where: { id: documentId } });
                if (!currentDoc) throw new DocumentNotFoundError(documentId, tenantId);
                throw new StateMismatchError(documentId, transition.from, currentDoc.status);
            }
        }

        // --- FREEZE VERSION ON SUBMISSION START ---
        if (action === "submit") {
            // Find current version to freeze
            const docWithVersion = await tx.document.findUnique({
                where: { id: documentId, tenantId },
                select: { currentVersionId: true }
            });

            if (docWithVersion?.currentVersionId) {
                await tx.documentVersion.update({
                    where: { id: docWithVersion.currentVersionId, tenantId },
                    data: { isFrozen: true }
                });
            }
        }
        // --- FREEZE VERSION ON SUBMISSION END ---

        // --- AUTOMATIC OBSOLETE LOGIC START ---
        // If approving a revision, auto-obsolete the previous document
        if (action === "approve" && document.supersedesId) {
            const previousDoc = await tx.document.findUnique({
                where: { id: document.supersedesId }
            });

            // Guard 1: Validate Previous & Cross-Tenant Protection
            if (previousDoc && previousDoc.tenantId === tenantId && previousDoc.status === "APPROVED") {

                // Guard 2: Conditional Update (Optimistic Locking / ID+Status check)
                const obsoleteResult = await tx.document.updateMany({
                    where: {
                        id: document.supersedesId,
                        tenantId: tenantId,
                        status: "APPROVED"
                    },
                    data: {
                        status: "OBSOLETE",
                        updatedById: user.sub,
                        updatedAt: new Date()
                    }
                });

                if (obsoleteResult.count === 1) {
                    // Log Automatic Obsoletion
                    await createAuditLog({
                        tenantId,
                        actorUserId: user.sub,
                        entityType: "DOCUMENT",
                        entityId: document.supersedesId,
                        action: "DMS.DOCUMENT_OBSOLETED_AUTO",
                        details: `Automatically obsoleted by approval of revision ${document.documentNumber || documentId}`,
                        metadata: {
                            reason: "Manual Revision Approval",
                            newVersionId: documentId,
                            newDocumentNumber: document.documentNumber
                        }
                    }, tx);
                }
            }
        }
        // --- AUTOMATIC OBSOLETE LOGIC END ---

        // f. Log to Workflow History
        await tx.workflowHistory.create({
            data: {
                documentId,
                tenantId,
                fromStatus: transition.from,
                toStatus: transition.to,
                comment,
                actorUserId: user.sub,
            },
        });

        // g. Emit Audit Log
        const auditAction = `DMS.${action.toUpperCase()}`;
        await createAuditLog({
            tenantId,
            actorUserId: user.sub,
            entityType: "DOCUMENT",
            entityId: documentId,
            action: auditAction,
            details: `Action '${action}' completed. Status: ${transition.from} -> ${transition.to}. Comment: ${comment || "N/A"}`,
            metadata: {
                fromStatus: transition.from,
                toStatus: transition.to,
                comment,
                workflowAction: action
            }
        }, tx);

        // Return the full updated document for the caller
        return await tx.document.findUnique({ where: { id: documentId } });
    };

    // Transaction Handling: Support both Client and TransactionClient (nested)
    if (typeof prisma.$transaction === 'function') {
        return await prisma.$transaction(execute);
    } else {
        return await execute(prisma);
    }
}
