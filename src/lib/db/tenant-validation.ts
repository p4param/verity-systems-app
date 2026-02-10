/**
 * Tenant Validation Functions for Prisma Middleware
 * 
 * These functions validate that Prisma queries include proper tenant context.
 * See: docs/prisma_tenant_middleware_spec.md for specification.
 */

import { TENANT_RELATION_PATHS } from './model-classification'

/**
 * Check if a where clause includes tenantId
 */
export function hasTenantId(whereClause: any): boolean {
    if (!whereClause) return false
    return whereClause.tenantId !== undefined
}

/**
 * Check if a where clause includes a tenant-scoped relation filter
 * 
 * @param model - The Prisma model name
 * @param whereClause - The where clause to validate
 * @returns true if a valid tenant relation path is found
 */
export function hasTenantRelation(model: string, whereClause: any): boolean {
    if (!whereClause) return false

    const validPaths = TENANT_RELATION_PATHS[model]
    if (!validPaths || validPaths.length === 0) return false

    // Check each valid path (e.g., "user.tenantId")
    for (const path of validPaths) {
        const parts = path.split('.')
        let current = whereClause

        // Traverse the path
        for (const part of parts) {
            if (!current || typeof current !== 'object') {
                break
            }
            current = current[part]
        }

        // If we successfully traversed the path and found a value, it's valid
        if (current !== undefined) {
            return true
        }
    }

    return false
}

/**
 * Validate bypass context has required fields
 * 
 * @param ctx - The context object from query args
 * @throws Error if bypass is used without proper justification
 */
export function validateBypassContext(ctx: any): void {
    if (!ctx || !ctx._bypassTenantCheck) {
        return // No bypass, nothing to validate
    }

    // Bypass requires reason and authorized by
    if (!ctx._bypassReason || typeof ctx._bypassReason !== 'string') {
        throw new Error(
            'BYPASS_MISSING_JUSTIFICATION: _bypassReason is required when using _bypassTenantCheck'
        )
    }

    if (!ctx._bypassAuthorizedBy || typeof ctx._bypassAuthorizedBy !== 'string') {
        throw new Error(
            'BYPASS_MISSING_JUSTIFICATION: _bypassAuthorizedBy is required when using _bypassTenantCheck'
        )
    }
}

/**
 * Get nested property from object using dot notation
 * Helper for traversing relation paths
 */
function getNestedProperty(obj: any, path: string): any {
    const parts = path.split('.')
    let current = obj

    for (const part of parts) {
        if (!current || typeof current !== 'object') {
            return undefined
        }
        current = current[part]
    }

    return current
}
