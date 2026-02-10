export type AuthUser = {
    sub: number        // userId
    tenantId: number
    email: string
    roles: string[]
    permissions?: string[]
    mfaEnabled: boolean
}
