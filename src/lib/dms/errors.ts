
/**
 * Custom error thrown when an action is not recognized by the workflow system.
 */
export class InvalidWorkflowActionError extends Error {
    constructor(action: string) {
        super(`Invalid workflow action: ${action}`);
        this.name = "InvalidWorkflowActionError";
    }
}

/**
 * Custom error thrown when a document cannot be found for a given ID and tenant.
 */
export class DocumentNotFoundError extends Error {
    constructor(documentId: string, tenantId: number) {
        super(`Document not found: ${documentId} for tenant ${tenantId}`);
        this.name = "DocumentNotFoundError";
    }
}

/**
 * Custom error thrown when the current document status does not allow the requested action.
 */
export class InvalidTransitionError extends Error {
    constructor(action: string, currentStatus: string, expectedStatus: string) {
        super(`Invalid transition: Document is in ${currentStatus}, but action '${action}' requires ${expectedStatus}`);
        this.name = "InvalidTransitionError";
    }
}

/**
 * Custom error thrown when the user lacks the required permission for a workflow action.
 */
export class UnauthorizedWorkflowActionError extends Error {
    constructor(permissionCode: string) {
        super(`Unauthorized: Missing required permission ${permissionCode}`);
        this.name = "UnauthorizedWorkflowActionError";
    }
}
/**
 * Custom error thrown when a folder cannot be found for a given ID and tenant.
 */
export class FolderNotFoundError extends Error {
    constructor(folderId: string, tenantId: number) {
        super(`Folder not found: ${folderId} for tenant ${tenantId}`);
        this.name = "FolderNotFoundError";
    }
}

/**
 * Custom error thrown when a folder cannot be deleted because it contains items.
 */
export class FolderNotEmptyError extends Error {
    constructor(folderId: string) {
        super(`Cannot delete folder ${folderId}: It is not empty.`);
        this.name = "FolderNotEmptyError";
    }
}

/**
 * Custom error thrown when a document is in a state that prevents the requested modification.
 */
export class DocumentLockedError extends Error {
    constructor(documentId: string, status: string) {
        super(`Document ${documentId} is locked (Status: ${status}). Metadata updates are only allowed in DRAFT or REJECTED states.`);
        this.name = "DocumentLockedError";
    }
}

/**
 * Custom error thrown when a share link has expired.
 */
export class ShareLinkExpiredError extends Error {
    constructor(linkId: string) {
        super(`Share link ${linkId} has expired.`);
        this.name = "ShareLinkExpiredError";
    }
}

/**
 * Custom error thrown when a share link cannot be found.
 */
export class ShareLinkNotFoundError extends Error {
    constructor(linkId: string) {
        super(`Share link ${linkId} not found.`);
        this.name = "ShareLinkNotFoundError";
    }
}

/**
 * Custom error thrown when a strict concurrency check fails during a state transition.
 */
export class StateMismatchError extends Error {
    constructor(entityId: string, expectedStatus: string, actualStatus: string = "UNKNOWN") {
        super(`State mismatch for ${entityId}: Expected ${expectedStatus}, but found ${actualStatus}. The document may have been modified by another process.`);
        this.name = "StateMismatchError";
    }
}

/**
 * Custom error thrown when a business rule or invariant is violated.
 */
export class DomainViolationError extends Error {
    constructor(message: string) {
        super(`Domain Violation: ${message}`);
        this.name = "DomainViolationError";
    }
}
