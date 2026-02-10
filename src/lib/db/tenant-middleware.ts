/**
 * Prisma Tenant Enforcement Middleware
 *
 * This middleware enforces tenant isolation at the database query level.
 * See: docs/prisma_tenant_middleware_spec.md for complete specification.
 *
 * IMPORTANT: This middleware is DISABLED by default and must be explicitly
 * enabled via environment variables. When disabled, it is a complete no-op.
 */

import { Prisma } from '@prisma/client'
import {
    isTenantScopedModel,
    isTenantRelatedModel,
    isUserScopedModel,
    isGlobalModel
} from './model-classification'
import {
    hasTenantId,
    hasTenantRelation,
    validateBypassContext
} from './tenant-validation'

/* =============================================================
   PRE_AUTH ROUTE ALLOWLIST
============================================================= */

/**
 * Routes allowed to access User model without tenantId
 * for identity resolution (PRE_AUTH phase)
 */
const PRE_AUTH_ROUTES = [
    '/api/auth/login',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-email'
]

/* =============================================================
   TYPES & CONFIG
============================================================= */

export type EnforcementMode = 'disabled' | 'log_only' | 'selective' | 'enforce'

export interface TenantMiddlewareConfig {
    enabled: boolean
    mode: EnforcementMode
    enforceModels: string[] | 'all'
    logModels: string[] | 'all'
    allowBypass: boolean
    logSampleRate: number
}

const DEFAULT_CONFIG: TenantMiddlewareConfig = {
    enabled: false,
    mode: 'disabled',
    enforceModels: 'all',
    logModels: 'all',
    allowBypass: true,
    logSampleRate: 1.0
}

/* =============================================================
   CONFIG LOADER
============================================================= */

function loadConfig(): TenantMiddlewareConfig {
    return {
        enabled: process.env.TENANT_ENFORCEMENT_ENABLED === 'true',
        mode: (process.env.TENANT_ENFORCEMENT_MODE as EnforcementMode) || 'disabled',
        enforceModels: process.env.TENANT_ENFORCEMENT_ENFORCE_MODELS === 'all'
            ? 'all'
            : (process.env.TENANT_ENFORCEMENT_ENFORCE_MODELS?.split(',') || []),
        logModels: process.env.TENANT_ENFORCEMENT_LOG_MODELS === 'all'
            ? 'all'
            : (process.env.TENANT_ENFORCEMENT_LOG_MODELS?.split(',') || []),
        allowBypass: process.env.TENANT_ENFORCEMENT_ALLOW_BYPASS !== 'false',
        logSampleRate: parseFloat(process.env.TENANT_ENFORCEMENT_LOG_SAMPLE_RATE || '1.0')
    }
}

/* =============================================================
   MIDDLEWARE FACTORY
============================================================= */

export function createTenantMiddleware(
    config: Partial<TenantMiddlewareConfig> = {}
): Prisma.Middleware {
    const finalConfig = { ...DEFAULT_CONFIG, ...loadConfig(), ...config }

    return async (params, next) => {
        // Hard no-op if disabled
        if (!finalConfig.enabled || finalConfig.mode === 'disabled') {
            return next(params)
        }

        if (!params.model) {
            return next(params)
        }

        const model = params.model

        // Global models always allowed
        if (isGlobalModel(model)) {
            return next(params)
        }

        const ctx = params.args?.ctx

        /* ---------------------------------------------------------
           BYPASS HANDLING
        ---------------------------------------------------------- */

        if (ctx?._bypassTenantCheck) {
            if (!finalConfig.allowBypass) {
                throw new Error(
                    `TENANT_BYPASS_FORBIDDEN: Bypass not allowed for model '${model}'`
                )
            }

            validateBypassContext(ctx)
            logBypassUsage(model, params.action, ctx)
            return next(params)
        }

        /* ---------------------------------------------------------
           PRE_AUTH CLASSIFICATION
        ---------------------------------------------------------- */

        if (isPreAuthAccess(model, params)) {
            logPreAuthAccess(model, params.action, ctx)
            return next(params)
        }

        /* ---------------------------------------------------------
           USER-SCOPED MODELS (e.g. RefreshToken)
        ---------------------------------------------------------- */

        if (isUserScopedModel(model)) {
            return next(params)
        }

        /* ---------------------------------------------------------
           TENANT VALIDATION
        ---------------------------------------------------------- */


        const violation = checkTenantViolation(model, params)

        if (violation) {
            return handleViolation(violation, params, next, finalConfig)
        }

        return next(params)
    }
}

/* =============================================================
   VIOLATION CHECKS
============================================================= */

function checkTenantViolation(
    model: string,
    params: Prisma.MiddlewareParams
): TenantViolation | null {

    // 🔹 PRE_AUTH User access (login / forgot-password / reset-password)
    // Allowed without tenantId. This is identity resolution, not data access.
    if (isPreAuthUserAccess(params)) {
        return null
    }

    const whereClause = params.args?.where

    if (isTenantScopedModel(model)) {
        // Create operations don't have a where clause, they have data.
        // We rely on service layer (and schema) to ensure tenantId is present in data.
        if (params.action === 'create' || params.action === 'createMany') {
            return null
        }

        if (!hasTenantId(whereClause)) {
            return {
                type: 'missing_tenant_id',
                model,
                action: params.action,
                message: `Model '${model}' requires tenantId in where clause`
            }
        }
    }

    if (isTenantRelatedModel(model)) {
        if (!hasTenantRelation(model, whereClause)) {
            return {
                type: 'missing_relation_filter',
                model,
                action: params.action,
                message: `Model '${model}' requires tenant-scoped relation filter`
            }
        }
    }

    return null
}

/* =============================================================
   PRE_AUTH HELPERS
============================================================= */

function isPreAuthAccess(
    model: string,
    params: Prisma.MiddlewareParams
): boolean {
    const ctx = params.args?.ctx
    const requestPath = ctx?.requestPath
    const authenticatedUser = ctx?.user

    if (!requestPath) return false
    if (authenticatedUser) return false
    if (model !== 'User') return false

    return PRE_AUTH_ROUTES.some(route =>
        requestPath.startsWith(route)
    )
}

function logPreAuthAccess(
    model: string,
    action: string,
    ctx: any
): void {
    console.info('PRE_AUTH_ACCESS', {
        model,
        action,
        route: ctx?.requestPath,
        reason: 'identity_resolution',
        timestamp: new Date().toISOString()
    })
}

/* =============================================================
   VIOLATION HANDLING
============================================================= */

async function handleViolation(
    violation: TenantViolation,
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<any>,
    config: TenantMiddlewareConfig
): Promise<any> {
    const { model } = violation

    const shouldEnforce = shouldEnforceModel(model, config)
    const shouldLog = shouldLogModel(model, config)

    if (config.mode === 'log_only') {
        if (shouldLog && shouldSample(config.logSampleRate)) {
            logViolation(violation)
        }
        return next(params)
    }

    if (config.mode === 'selective') {
        if (shouldEnforce) {
            throw createViolationError(violation)
        }
        if (shouldLog && shouldSample(config.logSampleRate)) {
            logViolation(violation)
        }
        return next(params)
    }

    if (config.mode === 'enforce') {
        throw createViolationError(violation)
    }

    return next(params)
}

/* =============================================================
   UTILITIES
============================================================= */

function shouldEnforceModel(model: string, config: TenantMiddlewareConfig): boolean {
    if (config.enforceModels === 'all') return true
    return config.enforceModels.includes(model)
}

function shouldLogModel(model: string, config: TenantMiddlewareConfig): boolean {
    if (config.logModels === 'all') return true
    return config.logModels.includes(model)
}

function shouldSample(rate: number): boolean {
    return Math.random() < rate
}

function createViolationError(violation: TenantViolation): Error {
    return new Error(
        `TENANT_VIOLATION: ${violation.message}. Operation: ${violation.action}`
    )
}

function logViolation(violation: TenantViolation): void {
    console.warn('TENANT_VIOLATION', {
        type: violation.type,
        model: violation.model,
        action: violation.action,
        message: violation.message,
        timestamp: new Date().toISOString()
    })
}

function logBypassUsage(model: string, action: string, ctx: any): void {
    console.warn('TENANT_BYPASS_USED', {
        model,
        action,
        reason: ctx._bypassReason,
        authorizedBy: ctx._bypassAuthorizedBy,
        timestamp: new Date().toISOString()
    })
}

/* =============================================================
   TYPES
============================================================= */

interface TenantViolation {
    type: 'missing_tenant_id' | 'missing_relation_filter'
    model: string
    action: string
    message: string
}

/* =============================================================
   PRE_AUTH USER ACCESS
============================================================= */
function isPreAuthUserAccess(params: Prisma.MiddlewareParams): boolean {
    if (params.model !== 'User') return false

    // Only allow read/write patterns used during identity resolution
    const allowedActions = ['findMany', 'findFirst', 'findUnique', 'update']
    if (!allowedActions.includes(params.action)) return false

    // Check directly for email in where clause (most reliable)
    if (params.args && params.args.where && params.args.where.email) {
        return true
    }

    // Heuristic: auth flows typically touch these fields
    const argsJson = JSON.stringify(params.args ?? {})

    return (
        argsJson.includes('password') ||
        argsJson.includes('passwordHash') ||
        argsJson.includes('resetToken') ||
        argsJson.includes('lastLoginAt') ||
        argsJson.includes('email')
    )
}
