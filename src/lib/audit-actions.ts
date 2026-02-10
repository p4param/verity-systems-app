/**
 * Audit Action Taxonomy
 * 
 * Centralized list of all audit actions used throughout the application.
 * Use these constants to ensure consistency in audit logging.
 */

// User Management Actions
export const USER_CREATE = "USER.CREATE"
export const USER_UPDATE = "USER.UPDATE"
export const USER_DELETE = "USER.DELETE"
export const USER_DEACTIVATE = "USER.DEACTIVATE"
export const USER_REACTIVATE = "USER.REACTIVATE"
export const USER_MFA_RESET_BY_ADMIN = "USER_MFA_RESET_BY_ADMIN"
export const USER_INVITE_RESENT = "USER.INVITE_RESENT"

// Session Management Actions
export const SESSION_REVOKED = "SESSION_REVOKED"
export const SESSION_REVOKED_ALL = "SESSION_REVOKED_ALL"

// Authentication Actions
export const LOGIN_SUCCESS = "LOGIN_SUCCESS"
export const LOGIN_FAILED = "LOGIN_FAILED"
export const LOGOUT = "LOGOUT"

// Password Actions
export const PASSWORD_CHANGED = "PASSWORD_CHANGED"
export const PASSWORD_RESET_REQUESTED = "PASSWORD_RESET_REQUESTED"
export const PASSWORD_RESET_COMPLETED = "PASSWORD_RESET_COMPLETED"

// MFA Actions
export const MFA_ENABLED = "MFA_ENABLED"
export const MFA_DISABLED = "MFA_DISABLED"
export const MFA_VERIFIED = "MFA_VERIFIED"

// Role Management Actions
export const ROLE_ASSIGNED = "ROLE_ASSIGNED"
export const ROLE_REVOKED = "ROLE_REVOKED"

/**
 * Type for all audit actions
 */
export type AuditAction =
    | typeof USER_CREATE
    | typeof USER_UPDATE
    | typeof USER_DELETE
    | typeof USER_DEACTIVATE
    | typeof USER_REACTIVATE
    | typeof USER_MFA_RESET_BY_ADMIN
    | typeof USER_INVITE_RESENT
    | typeof SESSION_REVOKED
    | typeof SESSION_REVOKED_ALL
    | typeof LOGIN_SUCCESS
    | typeof LOGIN_FAILED
    | typeof LOGOUT
    | typeof PASSWORD_CHANGED
    | typeof PASSWORD_RESET_REQUESTED
    | typeof PASSWORD_RESET_COMPLETED
    | typeof MFA_ENABLED
    | typeof MFA_DISABLED
    | typeof MFA_VERIFIED
    | typeof ROLE_ASSIGNED
    | typeof ROLE_REVOKED
