/**
 * Audit Metadata Formatter
 * 
 * Strict allow-listing and sanitization for audit log metadata.
 * Prevents leakage of internal IDs, storage keys, and sensitive flags.
 */

// Allow-lists for specific actions
const METADATA_ALLOW_LIST: Record<string, string[]> = {
    // Document Creation
    "DMS.DOCUMENT_CREATE": ["title", "folderId", "folderName", "status"],

    // Workflow Actions
    "DMS.SUBMIT": ["fromStatus", "toStatus", "comment", "workflowAction"],
    "DMS.APPROVE": ["fromStatus", "toStatus", "comment", "workflowAction"],
    "DMS.REJECT": ["fromStatus", "toStatus", "comment", "workflowAction", "reason"],
    "DMS.REVISE": ["fromStatus", "toStatus", "comment", "workflowAction"],
    "DMS.OBSOLETE": ["fromStatus", "toStatus", "comment", "workflowAction"],

    // Updates
    "DMS.DOCUMENT_UPDATE": ["title", "description", "folderId", "changedFields"],
    "DMS.VERSION_UPLOAD": ["versionNumber", "fileName", "fileSize", "mimeType"],

    // Sharing
    "DMS.SHARE_CREATE": ["expiresAt", "recipientEmail"], // No token!
    "DMS.SHARE_REVOKE": ["tokenPrefix"],

    // V3 Legal Hold Events
    "DMS.LEGAL_HOLD_CREATED": ["name", "reason", "startDate", "endDate"],
    "DMS.LEGAL_HOLD_ATTACHED": ["holdName", "targetType", "targetId", "documentCount"],
    "DMS.LEGAL_HOLD_RELEASED": ["releasedAt", "affectedDocumentCount"],
    "DMS.LEGAL_HOLD_VIOLATION_BLOCKED": ["documentId", "documentTitle"]
};

// Global deny-list (applied even if in allow-list by mistake)
const GLOBAL_DENY_LIST = [
    "storageKey",
    "password",
    "token",
    "secret",
    "hash",
    "internalId",
    "signedUrl",
    "path"
];

const MAX_STRING_LENGTH = 200;

export function formatAuditMetadata(action: string, metadata: any): Record<string, any> | null {
    if (!metadata || typeof metadata !== 'object') {
        return null;
    }

    // 1. Get allow-list for this action (or default to empty if unknown action)
    // We treat unknown actions with extreme suspicion -> return nothing or very basic generic fields?
    // For safety, if action is not in our known list, we return empty metadata.
    // Or we could define a "DEFAULT" allow list with safest fields like "reason".
    const allowedKeys = METADATA_ALLOW_LIST[action];

    if (!allowedKeys) {
        // Fallback: If we don't know the action, we strictly scrub everything.
        // Better safe than sorry.
        return null;
    }

    const safeMetadata: Record<string, any> = {};

    for (const key of allowedKeys) {
        // 2. Check if key is present
        if (Object.prototype.hasOwnProperty.call(metadata, key)) {
            const value = metadata[key];

            // 3. Skip null/undefined
            if (value === null || value === undefined) {
                continue;
            }

            // 4. Global Deny List check (extra safety layer)
            if (GLOBAL_DENY_LIST.some(deny => key.toLowerCase().includes(deny))) {
                continue;
            }

            // 5. Value Sanitization
            safeMetadata[key] = sanitizeValue(value);
        }
    }

    return Object.keys(safeMetadata).length > 0 ? safeMetadata : null;
}

function sanitizeValue(value: any): any {
    if (typeof value === 'string') {
        // Truncate long strings
        return value.length > MAX_STRING_LENGTH
            ? value.substring(0, MAX_STRING_LENGTH) + "..."
            : value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (Array.isArray(value)) {
        // Recursively sanitize arrays, but limit depth/length
        return value.slice(0, 10).map(sanitizeValue);
    }

    if (typeof value === 'object') {
        // We flatten or ignore nested objects for simplicity in this V1 formatter
        // to prevent complex object dumping. 
        // If we need nested support, valid keys must be explicitly defined.
        return "[Complex Object]";
    }

    return String(value);
}
