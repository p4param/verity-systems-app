/**
 * Permission ID Constants
 * 
 * These IDs are fixed in the database seed and used throughout the application
 * to perform security checks that are resilient to code/name changes.
 */
export enum PermissionId {
    USER_VIEW = 1,
    USER_CREATE = 2,
    USER_UPDATE = 3,
    USER_DELETE = 4,
    ROLE_VIEW = 5,
    ROLE_CREATE = 6,
    ROLE_UPDATE = 7,
    ROLE_DELETE = 8,
    ROLE_ASSIGN = 9,
    PERMISSION_VIEW = 10,
    AUDIT_VIEW = 11,
    ADMIN_ACCESS = 12,
    BILLING_READ = 13,
    COMPLIANCE_READ = 14,
    DATA_EXPORT = 15,
    DMS_VIEW = 20,
    DMS_DOCUMENT_EDIT = 21,
    DMS_DOCUMENT_APPROVE = 22,
    DMS_DOCUMENT_DELETE = 23,
    DMS_DOCUMENT_SUBMIT = 24,
    DMS_DOCUMENT_REJECT = 25,
    DMS_DOCUMENT_OBSOLETE = 26,
    DMS_FOLDER_READ = 27,
    DMS_FOLDER_CREATE = 28,
    DMS_FOLDER_UPDATE = 29,
    DMS_FOLDER_DELETE = 30,
    DMS_DOCUMENT_CREATE = 31,
    DMS_DOCUMENT_READ = 32,
    DMS_DOCUMENT_UPLOAD = 33,
    DMS_SHARE_CREATE = 34,
    DMS_SHARE_READ = 35,
    DMS_SHARE_REVOKE = 36,
    DMS_DOCUMENT_TYPE_MANAGE = 37,
    DMS_AUDIT_EXPORT = 38,
    DMS_DOCUMENT_DOWNLOAD = 42,
    DMS_DOCUMENT_APPROVE_ON_BEHALF = 43,

    // V3 Legal Hold Permissions
    LEGAL_HOLD_VIEW = 50,
    LEGAL_HOLD_CREATE = 51,
    LEGAL_HOLD_ATTACH = 52,
    LEGAL_HOLD_RELEASE = 53,

    // V3 Compliance Permissions
    COMPLIANCE_VIEW = 60,
}

export enum RoleId {
    ADMIN = 1,
    USER = 2,
}
