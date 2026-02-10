# Prisma Middleware Tenant Isolation Specification

## Executive Summary

This specification defines a Prisma middleware that **intercepts ALL queries** and enforces tenant isolation by:
- Requiring `tenantId` for all tenant-scoped models
- Rejecting queries that lack required tenant context
- Allowing explicit bypass only for system operations
- Failing fast with clear error messages

---

## Model Classification

### Tenant-Scoped Models (REQUIRE tenantId)
Models that contain `tenantId` field and MUST be isolated per tenant:

```
✅ User           (has tenantId field)
✅ Role           (has tenantId field)
✅ AuditLog       (has tenantId field)
```

**Enforcement Rule**: ALL queries on these models MUST include `tenantId` in the `where` clause.

### Tenant-Related Models (INDIRECT tenant scope)
Models that don't have `tenantId` but are owned by tenant-scoped models:

```
⚠️ UserRole           (owned by User + Role, both tenant-scoped)
⚠️ RolePermission     (owned by Role, tenant-scoped)
⚠️ PasswordResetToken (owned by User, tenant-scoped)
⚠️ RefreshToken       (owned by User, tenant-scoped)
⚠️ MfaBackupCode      (owned by User, tenant-scoped)
⚠️ SecurityAlert      (owned by User, tenant-scoped)
```

**Enforcement Rule**: Queries MUST include relation filters that cascade to tenant-scoped parent.

**Example**:
```typescript
// ❌ FORBIDDEN
prisma.userRole.findMany({ where: { roleId: 5 } })

// ✅ ALLOWED
prisma.userRole.findMany({ 
  where: { 
    roleId: 5,
    user: { tenantId: 1 }  // Cascades to tenant-scoped User
  } 
})
```

### Global Models (NO tenant scope)
Models that are shared across all tenants:

```
🌐 Tenant                (the tenant registry itself)
🌐 Permission            (global permission definitions)
🌐 PasswordResetRequest  (rate-limiting, no user link)
```

**Enforcement Rule**: No `tenantId` required. Queries allowed without restriction.

---

## Middleware Behavior Specification

### Interception Points

The middleware intercepts at the following Prisma operations:

```typescript
// Query Operations
- findUnique
- findFirst
- findMany
- count
- aggregate
- groupBy

// Mutation Operations
- create
- createMany
- update
- updateMany
- upsert
- delete
- deleteMany
```

### Decision Tree

```
Query Intercepted
    ↓
Is model in GLOBAL_MODELS?
    ↓ YES → Allow (no tenant check)
    ↓ NO
    ↓
Is model in TENANT_SCOPED_MODELS?
    ↓ YES
    ↓
    Does query have tenantId in where clause?
        ↓ YES → Allow
        ↓ NO
        ↓
        Is bypass flag set? (ctx._bypassTenantCheck)
            ↓ YES → Log warning + Allow
            ↓ NO → REJECT with error
    ↓
Is model in TENANT_RELATED_MODELS?
    ↓ YES
    ↓
    Does query have tenant-scoped relation filter?
        ↓ YES → Allow
        ↓ NO
        ↓
        Is bypass flag set?
            ↓ YES → Log warning + Allow
            ↓ NO → REJECT with error
```

---

## Allowed Query Patterns

### ✅ Pattern 1: Direct tenantId Filter (Tenant-Scoped Models)

```typescript
// User queries
prisma.user.findMany({
  where: { tenantId: 1, isActive: true }
})

prisma.user.findUnique({
  where: { id: 5 },
  // ❌ REJECTED - missing tenantId
})

prisma.user.findFirst({
  where: { 
    tenantId: 1,  // ✅ Required
    email: "user@example.com" 
  }
})

// Role queries
prisma.role.findMany({
  where: { tenantId: 1 }
})

// AuditLog queries
prisma.auditLog.create({
  data: {
    tenantId: 1,  // ✅ Required
    action: "USER_LOGIN",
    actorUserId: 5
  }
})
```

### ✅ Pattern 2: Relation-Based Tenant Filter (Tenant-Related Models)

```typescript
// UserRole queries
prisma.userRole.findMany({
  where: {
    user: { tenantId: 1 }  // ✅ Cascades to tenant-scoped User
  }
})

prisma.userRole.findMany({
  where: {
    role: { tenantId: 1 }  // ✅ Cascades to tenant-scoped Role
  }
})

// RefreshToken queries
prisma.refreshToken.findFirst({
  where: {
    tokenHash: "abc123",
    user: { tenantId: 1 }  // ✅ Required
  }
})

// SecurityAlert queries
prisma.securityAlert.findMany({
  where: {
    user: { tenantId: 1 }  // ✅ Required
  }
})
```

### ✅ Pattern 3: Global Model Queries (No Restriction)

```typescript
// Permission queries (global)
prisma.permission.findMany()  // ✅ Allowed

// Tenant queries (global registry)
prisma.tenant.findUnique({
  where: { id: 1 }
})  // ✅ Allowed

// PasswordResetRequest (rate-limiting)
prisma.passwordResetRequest.create({
  data: {
    email: "user@example.com",
    ipAddress: "1.2.3.4"
  }
})  // ✅ Allowed
```

### ✅ Pattern 4: Explicit Bypass (System Operations Only)

```typescript
// System maintenance job
const ctx = { _bypassTenantCheck: true }

prisma.$use(async (params, next) => {
  // Middleware detects bypass flag
  if (params.args?.ctx?._bypassTenantCheck) {
    logger.warn("TENANT_CHECK_BYPASSED", { 
      model: params.model, 
      action: params.action 
    })
    return next(params)
  }
  // ... normal enforcement
})

// Usage in system job
await prisma.user.findMany({
  ctx: { _bypassTenantCheck: true }
})  // ✅ Allowed with warning log
```

---

## Forbidden Query Patterns

### ❌ Pattern 1: Missing tenantId on Tenant-Scoped Models

```typescript
// User queries without tenantId
prisma.user.findMany({
  where: { isActive: true }
})  // ❌ REJECTED

prisma.user.findUnique({
  where: { id: 5 }
})  // ❌ REJECTED

prisma.user.update({
  where: { id: 5 },
  data: { fullName: "New Name" }
})  // ❌ REJECTED

// Role queries without tenantId
prisma.role.findMany()  // ❌ REJECTED

prisma.role.delete({
  where: { id: 3 }
})  // ❌ REJECTED
```

### ❌ Pattern 2: Missing Relation Filter on Tenant-Related Models

```typescript
// UserRole without tenant context
prisma.userRole.findMany({
  where: { roleId: 5 }
})  // ❌ REJECTED

// RefreshToken without user.tenantId
prisma.refreshToken.findFirst({
  where: { tokenHash: "abc123" }
})  // ❌ REJECTED

// SecurityAlert without user.tenantId
prisma.securityAlert.updateMany({
  where: { isRead: false },
  data: { isRead: true }
})  // ❌ REJECTED
```

### ❌ Pattern 3: Implicit tenantId (Silent Defaults)

```typescript
// Attempting to use default tenantId
const DEFAULT_TENANT = 1

prisma.user.findMany({
  where: { 
    tenantId: DEFAULT_TENANT  // ❌ Still rejected if not explicit
  }
})

// Middleware should detect and reject implicit defaults
// Only explicit tenantId from request context is allowed
```

---

## Fail-Fast Rules

### Rule 1: Immediate Rejection
**Trigger**: Query on tenant-scoped model without `tenantId`
**Action**: Throw error BEFORE query execution
**Error Code**: `TENANT_CONTEXT_REQUIRED`
**HTTP Status**: 500 Internal Server Error

```typescript
throw new Error(
  `TENANT_CONTEXT_REQUIRED: Model '${model}' requires tenantId in query. ` +
  `Operation: ${action}`
)
```

### Rule 2: Relation Validation
**Trigger**: Query on tenant-related model without tenant-scoped relation filter
**Action**: Throw error BEFORE query execution
**Error Code**: `TENANT_RELATION_REQUIRED`

```typescript
throw new Error(
  `TENANT_RELATION_REQUIRED: Model '${model}' requires tenant-scoped relation filter. ` +
  `Expected: user.tenantId or role.tenantId`
)
```

### Rule 3: Bypass Logging
**Trigger**: Bypass flag detected
**Action**: Log warning + Allow query
**Log Level**: WARN

```typescript
logger.warn("TENANT_CHECK_BYPASSED", {
  model: params.model,
  action: params.action,
  timestamp: new Date().toISOString(),
  stackTrace: new Error().stack  // For audit trail
})
```

### Rule 4: Development Mode Strictness
**Trigger**: `NODE_ENV !== 'production'`
**Action**: Throw error even on bypass attempts (unless explicitly allowed)
**Purpose**: Prevent accidental bypass usage in development

```typescript
if (process.env.NODE_ENV !== 'production' && params.args?.ctx?._bypassTenantCheck) {
  if (!process.env.ALLOW_TENANT_BYPASS) {
    throw new Error(
      "TENANT_BYPASS_FORBIDDEN: Bypass not allowed in development. " +
      "Set ALLOW_TENANT_BYPASS=true to enable."
    )
  }
}
```

---

## Middleware Configuration

### Model Registry

```typescript
const TENANT_SCOPED_MODELS = [
  'User',
  'Role',
  'AuditLog'
]

const TENANT_RELATED_MODELS = [
  'UserRole',
  'RolePermission',
  'PasswordResetToken',
  'RefreshToken',
  'MfaBackupCode',
  'SecurityAlert'
]

const GLOBAL_MODELS = [
  'Tenant',
  'Permission',
  'PasswordResetRequest'
]

const TENANT_RELATION_PATHS = {
  UserRole: ['user.tenantId', 'role.tenantId'],
  RolePermission: ['role.tenantId'],
  PasswordResetToken: ['user.tenantId'],
  RefreshToken: ['user.tenantId'],
  MfaBackupCode: ['user.tenantId'],
  SecurityAlert: ['user.tenantId']
}
```

### Validation Functions

```typescript
function hasTenantId(whereClause: any): boolean {
  return whereClause?.tenantId !== undefined
}

function hasTenantRelation(model: string, whereClause: any): boolean {
  const paths = TENANT_RELATION_PATHS[model] || []
  
  for (const path of paths) {
    const parts = path.split('.')
    let current = whereClause
    
    for (const part of parts) {
      if (!current?.[part]) return false
      current = current[part]
    }
    
    if (current !== undefined) return true
  }
  
  return false
}
```

---

## Error Messages

### Error 1: Missing tenantId
```json
{
  "error": "TENANT_CONTEXT_REQUIRED",
  "message": "Model 'User' requires tenantId in query",
  "operation": "findMany",
  "model": "User",
  "hint": "Add tenantId to where clause or use requireTenantContext() helper"
}
```

### Error 2: Missing Relation Filter
```json
{
  "error": "TENANT_RELATION_REQUIRED",
  "message": "Model 'UserRole' requires tenant-scoped relation filter",
  "operation": "findMany",
  "model": "UserRole",
  "expectedFilters": ["user.tenantId", "role.tenantId"],
  "hint": "Add user: { tenantId: X } or role: { tenantId: X } to where clause"
}
```

### Error 3: Bypass Forbidden
```json
{
  "error": "TENANT_BYPASS_FORBIDDEN",
  "message": "Tenant bypass not allowed in development environment",
  "hint": "Set ALLOW_TENANT_BYPASS=true environment variable to enable"
}
```

---

## Bypass Mechanism

### Allowed Use Cases
1. **System Maintenance Jobs**: Bulk operations across all tenants
2. **Data Migration Scripts**: One-time schema updates
3. **Monitoring/Reporting**: Cross-tenant analytics (admin only)

### Bypass Pattern

```typescript
// In system job or migration script
import { prisma } from '@/lib/prisma'

async function systemMaintenanceJob() {
  // Explicit bypass with audit trail
  const users = await prisma.user.findMany({
    where: {
      // No tenantId - bypass required
    },
    // Special context flag
    ctx: { 
      _bypassTenantCheck: true,
      _bypassReason: "System maintenance: deactivate expired users",
      _bypassAuthorizedBy: "system-cron"
    }
  })
  
  // Middleware logs warning with full context
}
```

### Bypass Audit Log

```typescript
// Middleware logs bypass attempts
logger.warn("TENANT_CHECK_BYPASSED", {
  model: "User",
  action: "findMany",
  reason: "System maintenance: deactivate expired users",
  authorizedBy: "system-cron",
  timestamp: "2026-01-28T23:00:00Z",
  stackTrace: "..."
})
```

---

## Backward Compatibility Strategy

### Phase 1: Soft Enforcement (Logging Only)
- Middleware logs violations but allows queries
- Developers fix violations based on logs
- Duration: 1-2 weeks

```typescript
if (!hasTenantId(params.args?.where)) {
  logger.error("TENANT_VIOLATION", { model, action })
  // Allow query to proceed (soft enforcement)
  return next(params)
}
```

### Phase 2: Hard Enforcement (Fail-Fast)
- Middleware rejects queries without tenant context
- All violations must be fixed
- Production rollout

```typescript
if (!hasTenantId(params.args?.where)) {
  throw new Error("TENANT_CONTEXT_REQUIRED")
}
```

### Migration Path
1. Deploy middleware in **logging mode** to production
2. Monitor logs for violations
3. Fix all violations in codebase
4. Switch to **enforcement mode**
5. Monitor error rates

---

## Performance Considerations

### Minimal Overhead
- Middleware runs **before** query execution
- Simple object property checks (O(1) complexity)
- No additional database queries
- Estimated overhead: < 1ms per query

### Optimization
- Cache model classifications (static)
- Pre-compile validation functions
- Skip validation for global models early

---

## Testing Strategy

### Unit Tests
```typescript
describe('Tenant Isolation Middleware', () => {
  it('allows User query with tenantId', async () => {
    await expect(
      prisma.user.findMany({ where: { tenantId: 1 } })
    ).resolves.toBeDefined()
  })
  
  it('rejects User query without tenantId', async () => {
    await expect(
      prisma.user.findMany({ where: { isActive: true } })
    ).rejects.toThrow('TENANT_CONTEXT_REQUIRED')
  })
  
  it('allows UserRole query with user.tenantId', async () => {
    await expect(
      prisma.userRole.findMany({ where: { user: { tenantId: 1 } } })
    ).resolves.toBeDefined()
  })
  
  it('allows Permission query without tenantId (global)', async () => {
    await expect(
      prisma.permission.findMany()
    ).resolves.toBeDefined()
  })
  
  it('logs warning on bypass', async () => {
    const spy = jest.spyOn(logger, 'warn')
    await prisma.user.findMany({ ctx: { _bypassTenantCheck: true } })
    expect(spy).toHaveBeenCalledWith('TENANT_CHECK_BYPASSED', expect.any(Object))
  })
})
```

### Integration Tests
- Test all API routes with middleware enabled
- Verify no cross-tenant data leaks
- Test bypass mechanism in system jobs

---

## Monitoring & Alerts

### Metrics to Track
1. **Violation Rate**: Count of `TENANT_CONTEXT_REQUIRED` errors
2. **Bypass Usage**: Count of `TENANT_CHECK_BYPASSED` warnings
3. **Model Coverage**: % of queries with tenant context

### Alerts
- **Critical**: Violation rate > 0 in production (after enforcement)
- **Warning**: Bypass usage > 10 per hour
- **Info**: New model added without tenant classification

---

## Risk Assessment

### ✅ Low Risk
- Additive change (middleware layer)
- Fail-fast prevents silent data leaks
- Backward compatible with soft enforcement phase

### ⚠️ Medium Risk
- Requires comprehensive testing before hard enforcement
- Potential for false positives on edge cases
- Bypass mechanism could be misused

### ❌ High Risk (Mitigated)
- **Risk**: Breaking all existing queries
- **Mitigation**: Soft enforcement phase + gradual rollout

---

## Implementation Checklist

- [ ] Create middleware function in `src/lib/db/tenant-middleware.ts`
- [ ] Define model classifications (TENANT_SCOPED, TENANT_RELATED, GLOBAL)
- [ ] Implement validation functions (hasTenantId, hasTenantRelation)
- [ ] Add bypass mechanism with audit logging
- [ ] Write unit tests for all query patterns
- [ ] Deploy in logging mode to staging
- [ ] Monitor logs for violations
- [ ] Fix all violations in codebase
- [ ] Deploy in enforcement mode to production
- [ ] Set up monitoring alerts

---

## Waiting for next instruction.
