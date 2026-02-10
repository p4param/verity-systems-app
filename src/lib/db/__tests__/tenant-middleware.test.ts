/**
 * Unit Tests: Tenant Enforcement Middleware
 * 
 * Tests for Prisma middleware behavior in all enforcement modes
 */

import { createTenantMiddleware } from '../tenant-middleware'

// Mock next function for middleware testing
const createMockNext = (returnValue: any = {}) => {
    return jest.fn().mockResolvedValue(returnValue)
}

describe('Tenant Enforcement Middleware', () => {
    // Save original env vars
    const originalEnv = process.env

    beforeEach(() => {
        // Reset environment variables before each test
        process.env = { ...originalEnv }
        delete process.env.TENANT_ENFORCEMENT_ENABLED
        delete process.env.TENANT_ENFORCEMENT_MODE
        jest.clearAllMocks()
    })

    afterAll(() => {
        // Restore original env vars
        process.env = originalEnv
    })

    describe('Default Behavior (Disabled)', () => {
        it('should be disabled by default when no env vars set', async () => {
            const middleware = createTenantMiddleware()
            const next = createMockNext({ id: 1 })

            const params = {
                model: 'User',
                action: 'findMany' as any,
                args: { where: { isActive: true } }
            }

            const result = await middleware(params, next)

            expect(next).toHaveBeenCalledWith(params)
            expect(result).toEqual({ id: 1 })
        })

        it('should be disabled when ENABLED=false', async () => {
            process.env.TENANT_ENFORCEMENT_ENABLED = 'false'
            const middleware = createTenantMiddleware()
            const next = createMockNext({ id: 1 })

            const params = {
                model: 'User',
                action: 'findMany' as any,
                args: { where: { isActive: true } }
            }

            const result = await middleware(params, next)

            expect(next).toHaveBeenCalledWith(params)
            expect(result).toEqual({ id: 1 })
        })

        it('should be disabled when MODE=disabled', async () => {
            process.env.TENANT_ENFORCEMENT_ENABLED = 'true'
            process.env.TENANT_ENFORCEMENT_MODE = 'disabled'
            const middleware = createTenantMiddleware()
            const next = createMockNext({ id: 1 })

            const params = {
                model: 'User',
                action: 'findMany' as any,
                args: { where: { isActive: true } }
            }

            const result = await middleware(params, next)

            expect(next).toHaveBeenCalledWith(params)
            expect(result).toEqual({ id: 1 })
        })

        it('should pass through when config override disables it', async () => {
            const middleware = createTenantMiddleware({ enabled: false })
            const next = createMockNext({ id: 1 })

            const params = {
                model: 'User',
                action: 'findMany' as any,
                args: { where: { isActive: true } }
            }

            const result = await middleware(params, next)

            expect(next).toHaveBeenCalledWith(params)
            expect(result).toEqual({ id: 1 })
        })
    })

    describe('Global Models (Always Allowed)', () => {
        it('should allow Permission queries without tenantId', async () => {
            process.env.TENANT_ENFORCEMENT_ENABLED = 'true'
            process.env.TENANT_ENFORCEMENT_MODE = 'enforce'
            const middleware = createTenantMiddleware()
            const next = createMockNext([{ id: 1 }])

            const params = {
                model: 'Permission',
                action: 'findMany' as any,
                args: { where: {} }
            }

            const result = await middleware(params, next)

            expect(next).toHaveBeenCalledWith(params)
            expect(result).toEqual([{ id: 1 }])
        })

        it('should allow Tenant queries without tenantId', async () => {
            process.env.TENANT_ENFORCEMENT_ENABLED = 'true'
            process.env.TENANT_ENFORCEMENT_MODE = 'enforce'
            const middleware = createTenantMiddleware()
            const next = createMockNext([{ id: 1 }])

            const params = {
                model: 'Tenant',
                action: 'findMany' as any,
                args: { where: { isActive: true } }
            }

            const result = await middleware(params, next)

            expect(next).toHaveBeenCalledWith(params)
            expect(result).toEqual([{ id: 1 }])
        })

        it('should allow PasswordResetRequest queries without tenantId', async () => {
            process.env.TENANT_ENFORCEMENT_ENABLED = 'true'
            process.env.TENANT_ENFORCEMENT_MODE = 'enforce'
            const middleware = createTenantMiddleware()
            const next = createMockNext([{ id: 1 }])

            const params = {
                model: 'PasswordResetRequest',
                action: 'findMany' as any,
                args: { where: { email: 'test@example.com' } }
            }

            const result = await middleware(params, next)

            expect(next).toHaveBeenCalledWith(params)
            expect(result).toEqual([{ id: 1 }])
        })
    })

    describe('Log Only Mode', () => {
        it('should log violations but allow queries', async () => {
            process.env.TENANT_ENFORCEMENT_ENABLED = 'true'
            process.env.TENANT_ENFORCEMENT_MODE = 'log_only'
            const middleware = createTenantMiddleware()
            const next = createMockNext([{ id: 1 }])

            // Spy on console.warn
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

            const params = {
                model: 'User',
                action: 'findMany' as any,
                args: { where: { isActive: true } }  // Missing tenantId
            }

            const result = await middleware(params, next)

            expect(warnSpy).toHaveBeenCalledWith('TENANT_VIOLATION', expect.objectContaining({
                type: 'missing_tenant_id',
                model: 'User',
                action: 'findMany'
            }))
            expect(next).toHaveBeenCalledWith(params)
            expect(result).toEqual([{ id: 1 }])

            warnSpy.mockRestore()
        })

        it('should allow queries with tenantId without logging', async () => {
            process.env.TENANT_ENFORCEMENT_ENABLED = 'true'
            process.env.TENANT_ENFORCEMENT_MODE = 'log_only'
            const middleware = createTenantMiddleware()
            const next = createMockNext([{ id: 1 }])

            const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

            const params = {
                model: 'User',
                action: 'findMany' as any,
                args: { where: { tenantId: 1, isActive: true } }
            }

            const result = await middleware(params, next)

            expect(warnSpy).not.toHaveBeenCalled()
            expect(next).toHaveBeenCalledWith(params)
            expect(result).toEqual([{ id: 1 }])

            warnSpy.mockRestore()
        })
    })

    describe('Enforce Mode', () => {
        it('should block User queries without tenantId', async () => {
            process.env.TENANT_ENFORCEMENT_ENABLED = 'true'
            process.env.TENANT_ENFORCEMENT_MODE = 'enforce'
            const middleware = createTenantMiddleware()
            const next = createMockNext()

            const params = {
                model: 'User',
                action: 'findMany' as any,
                args: { where: { isActive: true } }
            }

            await expect(middleware(params, next)).rejects.toThrow('TENANT_CONTEXT_REQUIRED')
            await expect(middleware(params, next)).rejects.toThrow("Model 'User' requires tenantId")
            expect(next).not.toHaveBeenCalled()
        })

        it('should allow User queries with tenantId', async () => {
            process.env.TENANT_ENFORCEMENT_ENABLED = 'true'
            process.env.TENANT_ENFORCEMENT_MODE = 'enforce'
            const middleware = createTenantMiddleware()
            const next = createMockNext([{ id: 1 }])

            const params = {
                model: 'User',
                action: 'findMany' as any,
                args: { where: { tenantId: 1, isActive: true } }
            }

            const result = await middleware(params, next)

            expect(next).toHaveBeenCalledWith(params)
            expect(result).toEqual([{ id: 1 }])
        })

        it('should block RefreshToken queries without user.tenantId', async () => {
            process.env.TENANT_ENFORCEMENT_ENABLED = 'true'
            process.env.TENANT_ENFORCEMENT_MODE = 'enforce'
            const middleware = createTenantMiddleware()
            const next = createMockNext()

            const params = {
                model: 'RefreshToken',
                action: 'findFirst' as any,
                args: { where: { tokenHash: 'abc123' } }
            }

            await expect(middleware(params, next)).rejects.toThrow('TENANT_RELATION_REQUIRED')
            expect(next).not.toHaveBeenCalled()
        })

        it('should allow RefreshToken queries with user.tenantId', async () => {
            process.env.TENANT_ENFORCEMENT_ENABLED = 'true'
            process.env.TENANT_ENFORCEMENT_MODE = 'enforce'
            const middleware = createTenantMiddleware()
            const next = createMockNext({ id: 1 })

            const params = {
                model: 'RefreshToken',
                action: 'findFirst' as any,
                args: { where: { tokenHash: 'abc123', user: { tenantId: 1 } } }
            }

            const result = await middleware(params, next)

            expect(next).toHaveBeenCalledWith(params)
            expect(result).toEqual({ id: 1 })
        })
    })

    describe('Selective Mode', () => {
        it('should enforce only specified models', async () => {
            process.env.TENANT_ENFORCEMENT_ENABLED = 'true'
            process.env.TENANT_ENFORCEMENT_MODE = 'selective'
            process.env.TENANT_ENFORCEMENT_ENFORCE_MODELS = 'User,Role'
            const middleware = createTenantMiddleware()

            // User should be enforced
            const userParams = {
                model: 'User',
                action: 'findMany' as any,
                args: { where: { isActive: true } }
            }
            await expect(middleware(userParams, createMockNext())).rejects.toThrow('TENANT_CONTEXT_REQUIRED')

            // AuditLog should be logged but allowed
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
            const auditParams = {
                model: 'AuditLog',
                action: 'findMany' as any,
                args: { where: { action: 'LOGIN' } }
            }
            const next = createMockNext([{ id: 1 }])
            await middleware(auditParams, next)
            expect(warnSpy).toHaveBeenCalled()
            expect(next).toHaveBeenCalled()

            warnSpy.mockRestore()
        })
    })

    describe('Bypass Mechanism', () => {
        it('should allow bypass with proper justification', async () => {
            process.env.TENANT_ENFORCEMENT_ENABLED = 'true'
            process.env.TENANT_ENFORCEMENT_MODE = 'enforce'
            const middleware = createTenantMiddleware()
            const next = createMockNext([{ id: 1 }])

            const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

            const params = {
                model: 'User',
                action: 'count' as any,
                args: {
                    ctx: {
                        _bypassTenantCheck: true,
                        _bypassReason: 'System metrics',
                        _bypassAuthorizedBy: 'system-cron'
                    }
                }
            }

            const result = await middleware(params, next)

            expect(warnSpy).toHaveBeenCalledWith('TENANT_BYPASS_USED', expect.objectContaining({
                model: 'User',
                action: 'count',
                reason: 'System metrics',
                authorizedBy: 'system-cron'
            }))
            expect(next).toHaveBeenCalledWith(params)
            expect(result).toEqual([{ id: 1 }])

            warnSpy.mockRestore()
        })

        it('should reject bypass without justification', async () => {
            process.env.TENANT_ENFORCEMENT_ENABLED = 'true'
            process.env.TENANT_ENFORCEMENT_MODE = 'enforce'
            const middleware = createTenantMiddleware()
            const next = createMockNext()

            const params = {
                model: 'User',
                action: 'count' as any,
                args: {
                    ctx: {
                        _bypassTenantCheck: true
                        // Missing reason and authorizedBy
                    }
                }
            }

            await expect(middleware(params, next)).rejects.toThrow('BYPASS_MISSING_JUSTIFICATION')
            expect(next).not.toHaveBeenCalled()
        })

        it('should reject bypass when allowBypass=false', async () => {
            const middleware = createTenantMiddleware({
                enabled: true,
                mode: 'enforce',
                allowBypass: false
            })
            const next = createMockNext()

            const params = {
                model: 'User',
                action: 'count' as any,
                args: {
                    ctx: {
                        _bypassTenantCheck: true,
                        _bypassReason: 'System metrics',
                        _bypassAuthorizedBy: 'system-cron'
                    }
                }
            }

            await expect(middleware(params, next)).rejects.toThrow('TENANT_BYPASS_FORBIDDEN')
            expect(next).not.toHaveBeenCalled()
        })
    })

    describe('Edge Cases', () => {
        it('should handle queries without model gracefully', async () => {
            process.env.TENANT_ENFORCEMENT_ENABLED = 'true'
            process.env.TENANT_ENFORCEMENT_MODE = 'enforce'
            const middleware = createTenantMiddleware()
            const next = createMockNext({ result: 'ok' })

            const params = {
                model: undefined,
                action: 'executeRaw' as any,
                args: {}
            }

            const result = await middleware(params as any, next)

            expect(next).toHaveBeenCalledWith(params)
            expect(result).toEqual({ result: 'ok' })
        })

        it('should handle queries without args', async () => {
            process.env.TENANT_ENFORCEMENT_ENABLED = 'true'
            process.env.TENANT_ENFORCEMENT_MODE = 'enforce'
            const middleware = createTenantMiddleware()
            const next = createMockNext()

            const params = {
                model: 'User',
                action: 'findMany' as any,
                args: undefined
            }

            await expect(middleware(params as any, next)).rejects.toThrow('TENANT_CONTEXT_REQUIRED')
        })
    })
})
