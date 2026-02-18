
import { DocumentStatus } from "@prisma/client";
import { AuthUser } from "@/lib/auth/auth-types";
import { TRANSITION_MATRIX, WorkflowAction } from "./transition-matrix";
import { createAuditLog } from "@/lib/audit";
import {
    InvalidWorkflowActionError,
    DocumentNotFoundError,
    InvalidTransitionError,
    UnauthorizedWorkflowActionError,
    StateMismatchError,
    DomainViolationError
} from "./errors";

/**
 * Helper to validate permission against AuthUser object.
 * Throws if permission is missing.
 */
function checkPermission(user: AuthUser, permissionCode: string) {
    if (!user.permissions?.includes(permissionCode)) {
        throw new UnauthorizedWorkflowActionError(permissionCode);
    }
}

/**
 * getEffectiveDocumentStatus
 * 
 * Determines the ACTUAL status of a document, factoring in expiry.
 * The database status might be 'APPROVED', but if expiryDate < now, it is effectively 'EXPIRED'.
 */
export function getEffectiveDocumentStatus(document: { status: DocumentStatus, expiryDate: Date | null }): DocumentStatus | "EXPIRED" {
    if (document.status === DocumentStatus.APPROVED && document.expiryDate && document.expiryDate < new Date()) {
        return "EXPIRED";
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

    // 1. Permission Enforcement
    checkPermission(user, transition.permission);

    // 2. Transactional Status Update
    return await prisma.$transaction(async (tx: any) => {
        // a. Load document with strict tenant scoping (Read Phase)
        const document = await tx.document.findUnique({
            where: { id: documentId, tenantId },
            select: { status: true, expiryDate: true, title: true } // Optimization: Select only needed fields
        });

        if (!document) {
            throw new DocumentNotFoundError(documentId, tenantId);
        }

        // b. Validate Effective Status
        const effectiveStatus = getEffectiveDocumentStatus(document);

        // Block actions on EXPIRED documents (unless we add specific actions for them later)
        if (effectiveStatus === "EXPIRED") {
            throw new DomainViolationError(`Document is EXPIRED. No further actions allowed.`);
        }

        // c. Validate current state matches Matrix requirement
        if (document.status !== transition.from) {
            throw new InvalidTransitionError(action, document.status, transition.from);
        }

        // d. Business Logic: Rejection requires a comment
        if (action === "reject" && !comment) {
            throw new Error("A comment is required when rejecting a document");
        }

        // e. Execute Update (with STRICT Concurrency Control)
        // We use updateMany with the expected 'from' status in the WHERE clause.
        // If the document was modified by another request between step "a" and now, count will be 0.
        const updateResult = await tx.document.updateMany({
            where: {
                id: documentId,
                tenantId: tenantId,
                status: transition.from // Optimistic Lock: Must still be in 'from' state
            },
            data: {
                status: transition.to,
                updatedById: user.sub,
                updatedAt: new Date() // Force timestamps update
            }
        });

        if (updateResult.count === 0) {
            // Re-fetch to see why it failed (Deleted? Changed status?)
            const currentDoc = await tx.document.findUnique({ where: { id: documentId } });
            if (!currentDoc) throw new DocumentNotFoundError(documentId, tenantId);

            throw new StateMismatchError(documentId, transition.from, currentDoc.status);
        }

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
    });
}
