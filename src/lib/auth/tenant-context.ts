/**
 * Tenant Context Helper
 * 
 * Provides utilities for extracting and validating tenant context from requests.
 * See: docs/tenant_context_design.md for design specification.
 */

import { requireAuth, type AuthUser } from './auth-guard'

/**
 * Tenant context extracted from authenticated request
 */
export interface TenantContext {
    tenantId: number
    userId: number
    user: AuthUser
}

/**
 * Extract and validate tenant context from request
 * 
 * @param req - The HTTP request
 * @returns Validated tenant context
 * @throws Error if tenant context is missing or invalid
 */
export function requireTenantContext(req: Request): TenantContext {
    // Get authenticated user
    const user = requireAuth(req)

    // Validate tenantId exists and is valid
    if (!user.tenantId || user.tenantId <= 0) {
        throw new Response(
            JSON.stringify({
                message: 'Invalid tenant context',
                code: 'TENANT_CONTEXT_MISSING',
                details: 'User JWT is missing valid tenantId'
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }

    return {
        tenantId: user.tenantId,
        userId: user.sub,
        user
    }
}

/**
 * Validate that a tenantId is valid for background jobs
 * 
 * @param tenantId - The tenant ID to validate
 * @param jobName - Name of the background job (for error messages)
 * @throws Error if tenantId is invalid
 */
export function validateTenantId(tenantId: number, jobName: string): void {
    if (!tenantId || tenantId <= 0) {
        throw new Error(
            `BACKGROUND_JOB_MISSING_TENANT: ${jobName} requires explicit tenantId parameter`
        )
    }
}

/**
 * Validate that a user belongs to a specific tenant
 * 
 * @param userId - The user ID
 * @param tenantId - The expected tenant ID
 * @param prisma - Prisma client instance
 * @throws Error if user doesn't belong to tenant
 */
export async function validateUserBelongsToTenant(
    userId: number,
    tenantId: number,
    prisma: any
): Promise<void> {
    const user = await prisma.user.findFirst({
        where: { id: userId, tenantId }
    })

    if (!user) {
        throw new Error(
            `USER_TENANT_MISMATCH: User ${userId} does not belong to tenant ${tenantId}`
        )
    }
}
