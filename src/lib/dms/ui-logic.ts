import { DocumentStatus } from "@prisma/client";
import { WorkflowAction } from "./transition-matrix";

/**
 * UI representation of a workflow action.
 */
export interface UiWorkflowAction {
    action: WorkflowAction;
    label: string;
    variant: "primary" | "secondary" | "success" | "danger" | "info";
    requiredPermission: string;
}

/**
 * getAvailableWorkflowActions
 * 
 * STRICT RULE: Returns ONLY the actions allowed for the current status and user permissions.
 * Does NOT perform server-side validation, but mirrors it for UX.
 * 
 * Server Authority: src/lib/dms/transition-matrix.ts
 */
export function getAvailableWorkflowActions(
    status: DocumentStatus | string,
    userPermissions: string[] = [],
    isCreator: boolean = false
): UiWorkflowAction[] {
    const actions: UiWorkflowAction[] = [];

    // 1. DRAFT -> Submit
    if (status === "DRAFT") {
        if (userPermissions.includes("DMS_DOCUMENT_SUBMIT")) {
            actions.push({
                action: "submit",
                label: "Submit for Review",
                variant: "primary",
                requiredPermission: "DMS_DOCUMENT_SUBMIT"
            });
        }
    }

    // 2. SUBMITTED -> Approve / Reject / Withdraw
    if (status === "SUBMITTED") {
        if (userPermissions.includes("DMS_DOCUMENT_APPROVE")) {
            actions.push({
                action: "approve",
                label: "Approve",
                variant: "success",
                requiredPermission: "DMS_DOCUMENT_APPROVE"
            });
        }
        if (userPermissions.includes("DMS_DOCUMENT_REJECT")) {
            actions.push({
                action: "reject",
                label: "Reject",
                variant: "danger",
                requiredPermission: "DMS_DOCUMENT_REJECT"
            });
        }
        // Withdraw logic: Allowed for Creator OR specific permission.
        if (isCreator || userPermissions.includes("DMS_DOCUMENT_WITHDRAW")) {
            actions.push({
                action: "withdraw",
                label: "Withdraw",
                variant: "secondary",
                requiredPermission: "DMS_DOCUMENT_WITHDRAW"
            });
        }
    }

    // 3. REJECTED -> Revise
    if (status === "REJECTED") {
        if (userPermissions.includes("DMS_DOCUMENT_EDIT")) {
            actions.push({
                action: "revise",
                label: "Revise",
                variant: "info",
                requiredPermission: "DMS_DOCUMENT_EDIT"
            });
        }
    }

    // 4. APPROVED -> Obsolete
    if (status === "APPROVED") {
        if (userPermissions.includes("DMS_DOCUMENT_OBSOLETE")) {
            actions.push({
                action: "obsolete",
                label: "Mark Obsolete",
                variant: "secondary",
                requiredPermission: "DMS_DOCUMENT_OBSOLETE"
            });
        }
    }

    // 5. OBSOLETE / EXPIRED -> None
    // Implicitly handled as no actions added.

    return actions;
}

/**
 * canUploadNewVersion
 * 
 * STRICT RULE: Only DRAFT and REJECTED documents can accept new versions.
 * APPROVED, SUBMITTED, OBSOLETE, and EXPIRED are locked.
 */
export function canUploadNewVersion(
    status: DocumentStatus | string,
    userPermissions: string[] = []
): boolean {
    // 1. Check basic permission
    if (!userPermissions.includes("DMS_DOCUMENT_UPLOAD")) {
        return false;
    }

    // 2. Check Status (Allow List)
    // STRICT RULE: Only DRAFT. REJECTED documents must be "Revised" (transition to DRAFT) first.
    const allowedStatuses = ["DRAFT"];

    // Explicitly Block others for clarity (though implicitly handled by allow list)
    // SUBMITTED -> Locked during review
    // APPROVED -> Immutable
    // OBSOLETE -> Locked
    // EXPIRED -> Locked

    return allowedStatuses.includes(status);
}
