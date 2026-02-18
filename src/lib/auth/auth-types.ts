export type AuthUser = {
    sub: number        // userId (subject)
    id: number         // userId (for consistency)
    tenantId: number
    email: string
    roles: string[]
    roleIds: number[]
    permissions?: string[]
    permissionIds?: number[]
    mfaEnabled: boolean
    sid?: number
}
