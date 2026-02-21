
import { NextResponse } from "next/server";
import {
    DocumentNotFoundError,
    FolderNotFoundError,
    ShareLinkNotFoundError,
    UnauthorizedWorkflowActionError,
    InvalidTransitionError,
    InvalidWorkflowActionError,
    FolderNotEmptyError,
    DocumentLockedError,
    ShareLinkExpiredError,
    DomainViolationError
} from "./errors";
import {
    FileTooLargeError,
    VersionConflictError,
    MimeTypeMismatchError,
    InvalidMimeTypeError,
    InvalidFileNameError,
    StorageError,
    StorageUploadFailedError,
    StorageConfigurationError
} from "./storage/errors";

/**
 * handleApiError
 * 
 * Reusable utility to catch and transform DMS domain errors into structured
 * API responses. Ensures consistency and prevents internal leakage.
 */
export function handleApiError(error: any) {
    console.error("[DMS_API_ERROR]", {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });

    let status = 500;
    let code = "INTERNAL_SERVER_ERROR";
    let message = "An unexpected error occurred";

    // 0. Pass through existing Responses (e.g. from auth-guard)
    if (error instanceof Response) {
        return error;
    }

    // 1. Map Status Codes
    if (
        error instanceof DocumentNotFoundError ||
        error instanceof FolderNotFoundError ||
        error instanceof ShareLinkNotFoundError
    ) {
        status = 404;
    } else if (error instanceof UnauthorizedWorkflowActionError) {
        status = 403;
    } else if (error instanceof VersionConflictError) {
        status = 409;
    } else if (
        error instanceof InvalidTransitionError ||
        error instanceof InvalidWorkflowActionError ||
        error instanceof FolderNotEmptyError ||
        error instanceof DocumentLockedError ||
        error instanceof FileTooLargeError ||
        error instanceof MimeTypeMismatchError ||
        error instanceof InvalidMimeTypeError ||
        error instanceof InvalidFileNameError ||
        error instanceof ShareLinkExpiredError ||
        error instanceof DomainViolationError
    ) {
        status = 400;
    }

    // 2. Extract structured info
    if (status !== 500) {
        message = error.message;
        code = error.name.replace(/Error$/, "").split(/(?=[A-Z])/).join("_").toUpperCase();
    } else if (process.env.NODE_ENV === "development") {
        // In dev, expose the raw error
        message = error.message || String(error);
        code = error.name || "UNKNOWN_ERROR";
    }

    return NextResponse.json(
        {
            success: false,
            error: {
                code,
                message
            }
        },
        { status }
    );
}
