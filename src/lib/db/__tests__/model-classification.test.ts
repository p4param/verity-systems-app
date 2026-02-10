/**
 * Unit Tests: Model Classification
 * 
 * Tests for tenant enforcement model classification logic
 */

import {
    TENANT_SCOPED_MODELS,
    TENANT_RELATED_MODELS,
    GLOBAL_MODELS,
    TENANT_RELATION_PATHS,
    isTenantScopedModel,
    isTenantRelatedModel,
    isGlobalModel
} from '../model-classification'

describe('Model Classification', () => {
    describe('Constants', () => {
        it('should define tenant-scoped models correctly', () => {
            expect(TENANT_SCOPED_MODELS).toEqual(['User', 'Role', 'AuditLog'])
            expect(TENANT_SCOPED_MODELS).toHaveLength(3)
        })

        it('should define tenant-related models correctly', () => {
            expect(TENANT_RELATED_MODELS).toEqual([
                'UserRole',
                'RolePermission',
                'RefreshToken',
                'PasswordResetToken',
                'MfaBackupCode',
                'SecurityAlert'
            ])
            expect(TENANT_RELATED_MODELS).toHaveLength(6)
        })

        it('should define global models correctly', () => {
            expect(GLOBAL_MODELS).toEqual([
                'Tenant',
                'Permission',
                'PasswordResetRequest'
            ])
            expect(GLOBAL_MODELS).toHaveLength(3)
        })

        it('should have no overlap between model categories', () => {
            const allModels = [
                ...TENANT_SCOPED_MODELS,
                ...TENANT_RELATED_MODELS,
                ...GLOBAL_MODELS
            ]
            const uniqueModels = new Set(allModels)
            expect(uniqueModels.size).toBe(allModels.length)
        })
    })

    describe('Tenant Relation Paths', () => {
        it('should define paths for all tenant-related models', () => {
            TENANT_RELATED_MODELS.forEach(model => {
                expect(TENANT_RELATION_PATHS[model]).toBeDefined()
                expect(Array.isArray(TENANT_RELATION_PATHS[model])).toBe(true)
                expect(TENANT_RELATION_PATHS[model].length).toBeGreaterThan(0)
            })
        })

        it('should have correct paths for UserRole', () => {
            expect(TENANT_RELATION_PATHS.UserRole).toEqual([
                'user.tenantId',
                'role.tenantId'
            ])
        })

        it('should have correct paths for RefreshToken', () => {
            expect(TENANT_RELATION_PATHS.RefreshToken).toEqual(['user.tenantId'])
        })

        it('should have correct paths for SecurityAlert', () => {
            expect(TENANT_RELATION_PATHS.SecurityAlert).toEqual(['user.tenantId'])
        })
    })

    describe('isTenantScopedModel()', () => {
        it('should return true for tenant-scoped models', () => {
            expect(isTenantScopedModel('User')).toBe(true)
            expect(isTenantScopedModel('Role')).toBe(true)
            expect(isTenantScopedModel('AuditLog')).toBe(true)
        })

        it('should return false for tenant-related models', () => {
            expect(isTenantScopedModel('UserRole')).toBe(false)
            expect(isTenantScopedModel('RefreshToken')).toBe(false)
        })

        it('should return false for global models', () => {
            expect(isTenantScopedModel('Tenant')).toBe(false)
            expect(isTenantScopedModel('Permission')).toBe(false)
        })

        it('should return false for unknown models', () => {
            expect(isTenantScopedModel('UnknownModel')).toBe(false)
        })
    })

    describe('isTenantRelatedModel()', () => {
        it('should return true for tenant-related models', () => {
            expect(isTenantRelatedModel('UserRole')).toBe(true)
            expect(isTenantRelatedModel('RefreshToken')).toBe(true)
            expect(isTenantRelatedModel('SecurityAlert')).toBe(true)
        })

        it('should return false for tenant-scoped models', () => {
            expect(isTenantRelatedModel('User')).toBe(false)
            expect(isTenantRelatedModel('Role')).toBe(false)
        })

        it('should return false for global models', () => {
            expect(isTenantRelatedModel('Tenant')).toBe(false)
            expect(isTenantRelatedModel('Permission')).toBe(false)
        })

        it('should return false for unknown models', () => {
            expect(isTenantRelatedModel('UnknownModel')).toBe(false)
        })
    })

    describe('isGlobalModel()', () => {
        it('should return true for global models', () => {
            expect(isGlobalModel('Tenant')).toBe(true)
            expect(isGlobalModel('Permission')).toBe(true)
            expect(isGlobalModel('PasswordResetRequest')).toBe(true)
        })

        it('should return false for tenant-scoped models', () => {
            expect(isGlobalModel('User')).toBe(false)
            expect(isGlobalModel('Role')).toBe(false)
        })

        it('should return false for tenant-related models', () => {
            expect(isGlobalModel('UserRole')).toBe(false)
            expect(isGlobalModel('RefreshToken')).toBe(false)
        })

        it('should return false for unknown models', () => {
            expect(isGlobalModel('UnknownModel')).toBe(false)
        })
    })
})
