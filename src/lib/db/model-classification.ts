/**
 * Prisma Model Classification for Tenant Enforcement
 * 
 * This file defines which models require tenant isolation and how.
 * See: docs/model_classification.md for detailed justification.
 */

/**
 * Models with direct tenantId field that MUST be filtered by tenantId
 */
export const TENANT_SCOPED_MODELS = [
    'User',
    'Role',
    'AuditLog'
] as const

/**
 * Models without direct tenantId but owned by tenant-scoped models
 * These require tenant-scoped relation filters (e.g., user.tenantId)
 */
export const TENANT_RELATED_MODELS = [
    'UserRole',
    'RolePermission',
    'PasswordResetToken',
    'MfaBackupCode',
    'SecurityAlert'
] as const

/**
 * Models that are user-scoped and tenant-safe via userId filtering
 * These do NOT require explicit tenant relation filters because:
 * - All queries filter by userId (which is unique per tenant)
 * - Each userId belongs to exactly one tenant
 * - userId filtering provides complete tenant isolation
 * 
 * ARCHITECTURAL INVARIANT: RefreshToken access is strictly user-owned.
 * Tokens cannot be accessed across users, and users cannot cross tenant boundaries.
 */
export const USER_SCOPED_MODELS = [
    'RefreshToken'  // Tenant-safe via userId filtering
] as const

/**
 * Models that are global/system-wide and do NOT require tenant filtering
 */
export const GLOBAL_MODELS = [
    'Tenant',
    'Permission',
    'PasswordResetRequest'
] as const

/**
 * Mapping of tenant-related models to their valid tenant relation paths
 * Used to validate that queries include proper tenant-scoped relations
 */
export const TENANT_RELATION_PATHS: Record<string, string[]> = {
    UserRole: ['user.tenantId', 'role.tenantId'],
    RolePermission: ['role.tenantId'],
    PasswordResetToken: ['user.tenantId'],
    MfaBackupCode: ['user.tenantId'],
    SecurityAlert: ['user.tenantId']
}

/**
 * Type helpers for model classification
 */
export type TenantScopedModel = typeof TENANT_SCOPED_MODELS[number]
export type TenantRelatedModel = typeof TENANT_RELATED_MODELS[number]
export type UserScopedModel = typeof USER_SCOPED_MODELS[number]
export type GlobalModel = typeof GLOBAL_MODELS[number]
export type PrismaModel = TenantScopedModel | TenantRelatedModel | UserScopedModel | GlobalModel

/**
 * Check if a model is tenant-scoped (has direct tenantId field)
 */
export function isTenantScopedModel(model: string): model is TenantScopedModel {
    return TENANT_SCOPED_MODELS.includes(model as TenantScopedModel)
}

/**
 * Check if a model is tenant-related (requires relation filter)
 */
export function isTenantRelatedModel(model: string): model is TenantRelatedModel {
    return TENANT_RELATED_MODELS.includes(model as TenantRelatedModel)
}

/**
 * Check if a model is user-scoped (tenant-safe via userId)
 */
export function isUserScopedModel(model: string): model is UserScopedModel {
    return USER_SCOPED_MODELS.includes(model as UserScopedModel)
}

/**
 * Check if a model is global (no tenant enforcement)
 */
export function isGlobalModel(model: string): model is GlobalModel {
    return GLOBAL_MODELS.includes(model as GlobalModel)
}
