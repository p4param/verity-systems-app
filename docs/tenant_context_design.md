# Tenant Context Resolution & Propagation Design

## Executive Summary

This design establishes a **single authoritative source** for tenant context throughout the backend, ensuring:
- No implicit defaults
- No hardcoded tenant IDs
- Fail-fast behavior on missing context
- Backward compatibility with existing code

## Current State Analysis

### Existing Infrastructure
- **JWT Payload**: Already contains `tenantId` (verified in `AuthUser` type)
- **Auth Guard**: `requireAuth()` extracts user from JWT, including `tenantId`
- **API Pattern**: All protected routes call `requireAuth(req)` → returns `AuthUser` with `tenantId`

### Current Tenant Context Flow
```
Client Request
    ↓
[Authorization: Bearer <JWT>]
    ↓
requireAuth(req)
    ↓
verifyJwt<AuthUser>(token)
    ↓
AuthUser { sub, tenantId, email, roles, permissions }
    ↓
API Handler (has tenantId available)
    ↓
Prisma Query (tenantId manually added to where clause)
```

### Gap Identified
**Problem**: While `tenantId` is available in `AuthUser`, there's no enforcement mechanism to ensure it's used in Prisma queries. Developers can accidentally omit `tenantId` from `where` clauses.

---

## Proposed Tenant Context Architecture

### 1. Source of Truth: JWT → AuthUser

**Primary Source**: JWT access token
- Already contains `tenantId`
- Verified and extracted by `requireAuth()`
- Type-safe via `AuthUser` interface

```typescript
// Current (no changes needed)
export type AuthUser = {
    sub: number        // userId
    tenantId: number   // ✅ Already present
    email: string
    roles: string[]
    permissions?: string[]
}
```

### 2. Propagation Strategy

#### Layer 1: API Route Handlers
**Current**: `requireAuth(req)` returns `AuthUser`
**Proposed**: Wrap in tenant-aware context helper

```typescript
// New helper (to be created)
export type TenantContext = {
    tenantId: number
    userId: number
    user: AuthUser
}

export function requireTenantContext(req: Request): TenantContext {
    const user = requireAuth(req)
    
    // Fail-fast validation
    if (!user.tenantId || user.tenantId <= 0) {
        throw new Response(
            JSON.stringify({ 
                message: "Invalid tenant context",
                code: "TENANT_CONTEXT_MISSING" 
            }),
            { status: 500 }
        )
    }
    
    return {
        tenantId: user.tenantId,
        userId: user.sub,
        user
    }
}
```

#### Layer 2: Prisma Query Scoping
**Strategy**: Create scoped Prisma client factory

```typescript
// New utility (to be created)
export function getTenantPrisma(tenantId: number) {
    // Validation
    if (!tenantId || tenantId <= 0) {
        throw new Error("CRITICAL: Attempted Prisma query without tenant context")
    }
    
    // Return object with tenant-scoped query helpers
    return {
        tenantId,
        
        // Scoped queries that auto-inject tenantId
        user: {
            findMany: (args) => prisma.user.findMany({
                ...args,
                where: { ...args?.where, tenantId }
            }),
            // ... other methods
        },
        
        role: {
            findMany: (args) => prisma.role.findMany({
                ...args,
                where: { ...args?.where, tenantId }
            }),
            // ... other methods
        },
        
        // Direct access for models without tenantId (with warning)
        _unsafe: prisma
    }
}
```

#### Layer 3: Background Jobs
**Challenge**: No HTTP request context
**Solution**: Explicit tenant context parameter

```typescript
// Background job pattern
export async function processAlerts(tenantId: number) {
    // Fail-fast validation
    if (!tenantId || tenantId <= 0) {
        throw new Error("Background job requires explicit tenantId")
    }
    
    const db = getTenantPrisma(tenantId)
    // Use scoped queries
}
```

---

## Complete Tenant Context Flow

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT REQUEST                                              │
│ Authorization: Bearer <JWT with tenantId>                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ API ROUTE HANDLER                                           │
│                                                             │
│ const ctx = requireTenantContext(req)                      │
│   ↓                                                         │
│   requireAuth(req) → AuthUser                              │
│   ↓                                                         │
│   Validate tenantId exists & > 0                           │
│   ↓                                                         │
│   Return { tenantId, userId, user }                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ BUSINESS LOGIC                                              │
│                                                             │
│ const db = getTenantPrisma(ctx.tenantId)                   │
│   ↓                                                         │
│   Validate tenantId > 0                                    │
│   ↓                                                         │
│   Return tenant-scoped query helpers                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PRISMA QUERIES                                              │
│                                                             │
│ db.user.findMany({ where: { ... } })                       │
│   ↓                                                         │
│   Auto-injects: where: { ...args, tenantId }              │
│   ↓                                                         │
│   Executes tenant-scoped query                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ DATABASE                                                    │
│ Returns only data for specified tenantId                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Failure Behaviors

### Scenario 1: Missing JWT
**Trigger**: No Authorization header
**Handler**: `requireAuth(req)`
**Response**: 401 Unauthorized
**Message**: "Unauthorized"

### Scenario 2: Invalid/Expired JWT
**Trigger**: JWT verification fails
**Handler**: `requireAuth(req)` → `verifyJwt()`
**Response**: 401 Unauthorized
**Message**: "Invalid or expired token"

### Scenario 3: JWT Missing tenantId
**Trigger**: JWT payload lacks `tenantId` or `tenantId <= 0`
**Handler**: `requireTenantContext(req)`
**Response**: 500 Internal Server Error
**Message**: "Invalid tenant context"
**Code**: "TENANT_CONTEXT_MISSING"
**Logging**: CRITICAL error logged

### Scenario 4: Prisma Query Without Tenant Context
**Trigger**: `getTenantPrisma()` called with invalid `tenantId`
**Handler**: `getTenantPrisma(tenantId)` validation
**Response**: Throws Error (caught by API handler)
**Message**: "CRITICAL: Attempted Prisma query without tenant context"
**Logging**: CRITICAL error logged

### Scenario 5: Background Job Without Tenant Context
**Trigger**: Background job called without `tenantId` parameter
**Handler**: Job function validation
**Response**: Throws Error
**Message**: "Background job requires explicit tenantId"
**Logging**: ERROR logged

---

## Implementation Strategy

### Phase 1: Infrastructure (In Scope)
1. Create `requireTenantContext()` helper in `src/lib/auth/tenant-context.ts`
2. Create `getTenantPrisma()` factory in `src/lib/db/tenant-prisma.ts`
3. Add runtime validation guards
4. Add logging for tenant context failures

### Phase 2: Gradual Adoption (Out of Scope - Future)
1. Migrate API routes one-by-one to use `requireTenantContext()`
2. Replace direct Prisma calls with `getTenantPrisma()`
3. Update background jobs to accept explicit `tenantId`

### Backward Compatibility
- **Existing Code**: Continues to work (uses `requireAuth()` directly)
- **New Code**: Can adopt `requireTenantContext()` + `getTenantPrisma()`
- **Migration**: Gradual, route-by-route
- **No Breaking Changes**: Old pattern still functional

---

## Security Guarantees

### ✅ Enforced
1. **No Silent Defaults**: Missing `tenantId` → 500 error (fail-fast)
2. **No Hardcoded IDs**: All tenant context from JWT
3. **Type Safety**: `TenantContext` type ensures `tenantId` presence
4. **Runtime Validation**: Double-check `tenantId > 0` at multiple layers

### ✅ Prevented
1. **Cross-Tenant Data Leaks**: Auto-scoped queries prevent accidental omission
2. **Implicit Tenant Assumptions**: Explicit context required
3. **Background Job Leaks**: Explicit `tenantId` parameter required

### ⚠️ Limitations
1. **Opt-In**: Existing code must be migrated to benefit
2. **Developer Discipline**: Can still use `prisma._unsafe` if needed
3. **Not Prisma Middleware**: Doesn't intercept all queries automatically

---

## Monitoring & Observability

### Metrics to Track
1. **Tenant Context Failures**: Count of `TENANT_CONTEXT_MISSING` errors
2. **Unsafe Prisma Access**: Log when `_unsafe` is used
3. **Background Job Failures**: Track tenant validation errors

### Logging Strategy
```typescript
// Critical: Missing tenant context
logger.critical("TENANT_CONTEXT_MISSING", { 
    userId: user.sub, 
    endpoint: req.url 
})

// Warning: Unsafe Prisma access
logger.warn("UNSAFE_PRISMA_ACCESS", { 
    tenantId, 
    model: "User", 
    operation: "findMany" 
})
```

---

## Risk Assessment

### ✅ Low Risk
- Infrastructure changes are additive (no breaking changes)
- Fail-fast behavior prevents silent data leaks
- Backward compatible with existing code

### ⚠️ Medium Risk
- Requires developer training on new patterns
- Migration effort across many API routes
- Potential for `_unsafe` misuse

### ❌ High Risk (Mitigated)
- **Risk**: Forgetting to use scoped queries
- **Mitigation**: Code review checklist, linting rules (future)

---

## Out of Scope (Explicitly Excluded)

1. ❌ Prisma middleware implementation
2. ❌ Refactoring existing business logic
3. ❌ Modifying authentication flows
4. ❌ Query performance optimizations
5. ❌ UI changes
6. ❌ Automatic migration of all routes

---

## Waiting for next instruction.
