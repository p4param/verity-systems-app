# Tenant Context Design: Background & Async Jobs

## Executive Summary

Background jobs operate **without HTTP request context**, requiring explicit tenant context management. This design ensures:
- **Per-tenant jobs**: Explicit `tenantId` parameter required
- **Cross-tenant jobs**: Explicit bypass with audit trail
- **Fail-fast validation**: Missing tenant context throws error
- **Zero implicit defaults**: No silent tenant assumptions

---

## Job Classification

### Category 1: Per-Tenant Jobs (REQUIRE tenantId)

Jobs that operate on a **single tenant's data**:

| Job | Trigger | Tenant Context | Example |
|-----|---------|---------------|---------|
| Alert Generation | User action | Explicit `tenantId` | New device login alert |
| Audit Log Archival | Scheduled (per-tenant) | Explicit `tenantId` | Archive old audit logs for Tenant 1 |
| Session Cleanup | Scheduled (per-tenant) | Explicit `tenantId` | Expire sessions for Tenant 1 |
| MFA Reset | Admin action | From target user's `tenantId` | Reset MFA for user in Tenant 1 |

**Rule**: These jobs MUST receive `tenantId` as an explicit parameter.

---

### Category 2: Cross-Tenant System Jobs (BYPASS with Audit)

Jobs that operate **across all tenants**:

| Job | Trigger | Tenant Context | Example |
|-----|---------|---------------|---------|
| Global Session Cleanup | Scheduled (global) | Bypass with iteration | Expire all sessions across all tenants |
| Tenant Health Check | Scheduled (global) | Bypass with iteration | Check active users per tenant |
| System Metrics | Scheduled (global) | Bypass | Count total users across all tenants |

**Rule**: These jobs use bypass mechanism with explicit audit logging.

---

## Tenant Context Patterns

### Pattern 1: Explicit tenantId Parameter (Per-Tenant Jobs)

**Use Case**: Job operates on single tenant's data

**Signature**:
```typescript
async function jobName(tenantId: number, ...otherParams) {
  // Validate tenant context
  if (!tenantId || tenantId <= 0) {
    throw new Error('BACKGROUND_JOB_MISSING_TENANT: tenantId required')
  }
  
  // Use tenant-scoped queries
  const users = await prisma.user.findMany({
    where: { tenantId, ...otherConditions }
  })
}
```

**Examples**:
```typescript
// Alert generation
await generateSecurityAlert(tenantId: 1, userId: 5, alertType: 'NEW_DEVICE')

// Audit log archival
await archiveOldAuditLogs(tenantId: 1, olderThanDays: 90)

// Session cleanup
await cleanupExpiredSessions(tenantId: 1)

// MFA reset
await resetUserMfa(tenantId: 1, userId: 5)
```

---

### Pattern 2: Tenant Iteration (Cross-Tenant Jobs)

**Use Case**: Job operates on all tenants, one at a time

**Signature**:
```typescript
async function globalJobName() {
  // Fetch all active tenants
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true }
  })
  
  // Process each tenant independently
  for (const tenant of tenants) {
    try {
      await processTenant(tenant.id)
    } catch (error) {
      logger.error('TENANT_JOB_FAILED', { 
        tenantId: tenant.id, 
        error 
      })
      // Continue to next tenant (isolation)
    }
  }
}

async function processTenant(tenantId: number) {
  // Validate tenant context
  if (!tenantId || tenantId <= 0) {
    throw new Error('INVALID_TENANT_ID')
  }
  
  // Use tenant-scoped queries
  const sessions = await prisma.refreshToken.findMany({
    where: { 
      user: { tenantId },
      expiresAt: { lt: new Date() }
    }
  })
  
  // Process tenant data
}
```

**Examples**:
```typescript
// Global session cleanup
async function cleanupAllExpiredSessions() {
  const tenants = await prisma.tenant.findMany({ where: { isActive: true } })
  
  for (const tenant of tenants) {
    await cleanupExpiredSessions(tenant.id)
  }
}

// Tenant health check
async function checkTenantHealth() {
  const tenants = await prisma.tenant.findMany({ where: { isActive: true } })
  
  for (const tenant of tenants) {
    const activeUsers = await prisma.user.count({
      where: { tenantId: tenant.id, isActive: true }
    })
    
    logger.info('TENANT_HEALTH', { 
      tenantId: tenant.id, 
      activeUsers 
    })
  }
}
```

---

### Pattern 3: Explicit Bypass (System Metrics Only)

**Use Case**: Job needs cross-tenant aggregation (rare)

**Signature**:
```typescript
async function systemMetricsJob() {
  // Use bypass for cross-tenant query
  const totalUsers = await prisma.user.count({
    ctx: {
      _bypassTenantCheck: true,
      _bypassReason: 'System metrics: total user count',
      _bypassAuthorizedBy: 'system-cron'
    }
  })
  
  logger.info('SYSTEM_METRICS', { totalUsers })
}
```

**⚠️ WARNING**: This pattern should be **extremely rare**. Prefer Pattern 2 (iteration) whenever possible.

---

## Job-Specific Designs

### Job 1: Alert Generation

**Trigger**: User action (login, password change, etc.)

**Tenant Context**: From authenticated user's JWT

**Flow**:
```
User Action (e.g., login from new device)
  ↓
API Handler (has user context from JWT)
  ↓
Extract: { userId, tenantId } from AuthUser
  ↓
Enqueue Job: generateSecurityAlert(tenantId, userId, alertType, metadata)
  ↓
Background Worker
  ↓
Validate tenantId > 0
  ↓
Create Alert:
  prisma.securityAlert.create({
    data: {
      userId,  // Implicitly scoped to tenantId via user relation
      type: alertType,
      ...
    }
  })
```

**Job Signature**:
```typescript
async function generateSecurityAlert(
  tenantId: number,
  userId: number,
  alertType: string,
  metadata: object
) {
  // Fail-fast validation
  if (!tenantId || tenantId <= 0) {
    throw new Error('ALERT_JOB_MISSING_TENANT')
  }
  
  // Verify user belongs to tenant
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId }
  })
  
  if (!user) {
    throw new Error('USER_TENANT_MISMATCH')
  }
  
  // Create alert (tenant-scoped via user relation)
  await prisma.securityAlert.create({
    data: {
      userId,
      type: alertType,
      title: generateTitle(alertType),
      message: generateMessage(alertType, metadata),
      severity: getSeverity(alertType),
      metadata: JSON.stringify(metadata)
    }
  })
  
  logger.info('ALERT_GENERATED', { tenantId, userId, alertType })
}
```

**Tenant Enforcement**: ✅ Explicit `tenantId` parameter + user validation

---

### Job 2: Audit Log Archival

**Trigger**: Scheduled (cron: daily at 2 AM)

**Tenant Context**: Iterate over all tenants

**Flow**:
```
Cron Trigger (daily)
  ↓
Fetch Active Tenants
  ↓
For Each Tenant:
  ↓
  archiveOldAuditLogs(tenantId, retentionDays)
  ↓
  Find audit logs older than retention period
  ↓
  Archive to cold storage (S3, etc.)
  ↓
  Delete from database
  ↓
  Log archival stats
```

**Job Signature**:
```typescript
async function archiveOldAuditLogsGlobal() {
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true }
  })
  
  for (const tenant of tenants) {
    try {
      await archiveOldAuditLogs(tenant.id, 90)  // 90-day retention
    } catch (error) {
      logger.error('AUDIT_ARCHIVAL_FAILED', { 
        tenantId: tenant.id, 
        error 
      })
      // Continue to next tenant
    }
  }
}

async function archiveOldAuditLogs(
  tenantId: number,
  retentionDays: number
) {
  // Fail-fast validation
  if (!tenantId || tenantId <= 0) {
    throw new Error('AUDIT_ARCHIVAL_MISSING_TENANT')
  }
  
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
  
  // Find old audit logs (tenant-scoped)
  const oldLogs = await prisma.auditLog.findMany({
    where: {
      tenantId,
      createdAt: { lt: cutoffDate }
    }
  })
  
  if (oldLogs.length === 0) {
    logger.info('AUDIT_ARCHIVAL_NONE', { tenantId })
    return
  }
  
  // Archive to cold storage
  await archiveToColdStorage(tenantId, oldLogs)
  
  // Delete from database
  await prisma.auditLog.deleteMany({
    where: {
      tenantId,
      createdAt: { lt: cutoffDate }
    }
  })
  
  logger.info('AUDIT_ARCHIVAL_COMPLETE', { 
    tenantId, 
    archivedCount: oldLogs.length 
  })
}
```

**Tenant Enforcement**: ✅ Explicit `tenantId` parameter + tenant iteration

---

### Job 3: Session Cleanup

**Trigger**: Scheduled (cron: hourly)

**Tenant Context**: Iterate over all tenants

**Flow**:
```
Cron Trigger (hourly)
  ↓
Fetch Active Tenants
  ↓
For Each Tenant:
  ↓
  cleanupExpiredSessions(tenantId)
  ↓
  Find expired refresh tokens
  ↓
  Mark as revoked
  ↓
  Log cleanup stats
```

**Job Signature**:
```typescript
async function cleanupExpiredSessionsGlobal() {
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true }
  })
  
  for (const tenant of tenants) {
    try {
      await cleanupExpiredSessions(tenant.id)
    } catch (error) {
      logger.error('SESSION_CLEANUP_FAILED', { 
        tenantId: tenant.id, 
        error 
      })
      // Continue to next tenant
    }
  }
}

async function cleanupExpiredSessions(tenantId: number) {
  // Fail-fast validation
  if (!tenantId || tenantId <= 0) {
    throw new Error('SESSION_CLEANUP_MISSING_TENANT')
  }
  
  const now = new Date()
  
  // Find expired sessions (tenant-scoped via user relation)
  const expiredTokens = await prisma.refreshToken.findMany({
    where: {
      user: { tenantId },
      expiresAt: { lt: now },
      revokedAt: null  // Not already revoked
    }
  })
  
  if (expiredTokens.length === 0) {
    logger.info('SESSION_CLEANUP_NONE', { tenantId })
    return
  }
  
  // Mark as revoked
  await prisma.refreshToken.updateMany({
    where: {
      id: { in: expiredTokens.map(t => t.id) }
    },
    data: {
      revokedAt: now,
      revokedByIp: 'system-cleanup'
    }
  })
  
  logger.info('SESSION_CLEANUP_COMPLETE', { 
    tenantId, 
    revokedCount: expiredTokens.length 
  })
}
```

**Tenant Enforcement**: ✅ Explicit `tenantId` parameter + tenant iteration

---

### Job 4: MFA Reset Flow

**Trigger**: Admin action (API request)

**Tenant Context**: From target user's tenant

**Flow**:
```
Admin Request: POST /api/admin/users/:id/mfa/reset
  ↓
API Handler (has admin context from JWT)
  ↓
Extract: { adminTenantId, adminUserId } from JWT
  ↓
Fetch Target User
  ↓
Validate: targetUser.tenantId === adminTenantId
  ↓
Enqueue Job: resetUserMfa(targetUser.tenantId, targetUser.id)
  ↓
Background Worker
  ↓
Validate tenantId > 0
  ↓
Reset MFA:
  - Clear mfaSecret
  - Delete backup codes
  - Set mfaEnabled = false
  - Generate security alert
```

**Job Signature**:
```typescript
async function resetUserMfa(
  tenantId: number,
  userId: number,
  adminUserId: number
) {
  // Fail-fast validation
  if (!tenantId || tenantId <= 0) {
    throw new Error('MFA_RESET_MISSING_TENANT')
  }
  
  // Verify user belongs to tenant
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId }
  })
  
  if (!user) {
    throw new Error('USER_TENANT_MISMATCH')
  }
  
  // Reset MFA settings
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaSetupRequired: false
    }
  })
  
  // Delete backup codes
  await prisma.mfaBackupCode.deleteMany({
    where: { 
      user: { id: userId, tenantId }  // Tenant-scoped
    }
  })
  
  // Generate security alert
  await generateSecurityAlert(
    tenantId,
    userId,
    'MFA_RESET',
    { resetBy: adminUserId }
  )
  
  // Audit log
  await prisma.auditLog.create({
    data: {
      tenantId,
      actorUserId: adminUserId,
      targetUserId: userId,
      action: 'MFA_RESET',
      details: 'Admin reset user MFA'
    }
  })
  
  logger.info('MFA_RESET_COMPLETE', { tenantId, userId, adminUserId })
}
```

**Tenant Enforcement**: ✅ Explicit `tenantId` parameter + user validation

---

## Bypass Rules for Background Jobs

### Allowed Bypass Cases

#### Case 1: System Metrics (Aggregation)

**Use Case**: Count total users across all tenants

**Justification**: No tenant-specific data accessed, only counts

**Pattern**:
```typescript
async function collectSystemMetrics() {
  const totalUsers = await prisma.user.count({
    ctx: {
      _bypassTenantCheck: true,
      _bypassReason: 'System metrics: total user count',
      _bypassAuthorizedBy: 'system-cron'
    }
  })
  
  const totalTenants = await prisma.tenant.count({
    where: { isActive: true }
  })
  
  logger.info('SYSTEM_METRICS', { totalUsers, totalTenants })
}
```

**Audit**: Logged with bypass reason

---

#### Case 2: Tenant Health Check (Read-Only)

**Use Case**: Check active users per tenant (for monitoring)

**Justification**: Read-only, no data modification

**Pattern**:
```typescript
async function checkTenantHealth() {
  const tenants = await prisma.tenant.findMany({ 
    where: { isActive: true } 
  })
  
  for (const tenant of tenants) {
    const activeUsers = await prisma.user.count({
      where: { tenantId: tenant.id, isActive: true }
    })
    
    // Alert if tenant has zero active users
    if (activeUsers === 0) {
      logger.warn('TENANT_NO_ACTIVE_USERS', { 
        tenantId: tenant.id 
      })
    }
  }
}
```

**Audit**: Logged per-tenant

**Note**: This does NOT use bypass (uses tenant iteration instead)

---

### Forbidden Bypass Cases

#### ❌ Case 1: Data Modification Without Tenant Context

**Example**:
```typescript
// ❌ FORBIDDEN
async function deactivateInactiveUsers() {
  await prisma.user.updateMany({
    where: { lastLoginAt: { lt: sixMonthsAgo } },
    data: { isActive: false },
    ctx: { _bypassTenantCheck: true }  // ❌ FORBIDDEN
  })
}
```

**Why Forbidden**: Modifies data across tenants without isolation

**Correct Pattern**:
```typescript
// ✅ CORRECT
async function deactivateInactiveUsersGlobal() {
  const tenants = await prisma.tenant.findMany({ 
    where: { isActive: true } 
  })
  
  for (const tenant of tenants) {
    await deactivateInactiveUsers(tenant.id)
  }
}

async function deactivateInactiveUsers(tenantId: number) {
  await prisma.user.updateMany({
    where: { 
      tenantId,  // ✅ Tenant-scoped
      lastLoginAt: { lt: sixMonthsAgo } 
    },
    data: { isActive: false }
  })
}
```

---

#### ❌ Case 2: Cross-Tenant Data Access

**Example**:
```typescript
// ❌ FORBIDDEN
async function findUserByEmail(email: string) {
  return await prisma.user.findFirst({
    where: { email },
    ctx: { _bypassTenantCheck: true }  // ❌ FORBIDDEN
  })
}
```

**Why Forbidden**: Email is not globally unique (unique per tenant)

**Correct Pattern**:
```typescript
// ✅ CORRECT
async function findUserByEmail(tenantId: number, email: string) {
  return await prisma.user.findFirst({
    where: { tenantId, email }  // ✅ Tenant-scoped
  })
}
```

---

## Fail-Fast Validation

### Validation Rules

#### Rule 1: Explicit tenantId Required

```typescript
function validateTenantContext(tenantId: number, jobName: string) {
  if (!tenantId || tenantId <= 0) {
    throw new Error(
      `BACKGROUND_JOB_MISSING_TENANT: ${jobName} requires explicit tenantId`
    )
  }
}

// Usage
async function myBackgroundJob(tenantId: number) {
  validateTenantContext(tenantId, 'myBackgroundJob')
  // ... job logic
}
```

---

#### Rule 2: User-Tenant Validation

```typescript
async function validateUserBelongsToTenant(
  userId: number,
  tenantId: number
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

// Usage
async function processUser(tenantId: number, userId: number) {
  await validateUserBelongsToTenant(userId, tenantId)
  // ... job logic
}
```

---

#### Rule 3: Bypass Requires Justification

```typescript
function validateBypassContext(ctx: any) {
  if (ctx._bypassTenantCheck) {
    if (!ctx._bypassReason || !ctx._bypassAuthorizedBy) {
      throw new Error(
        'BYPASS_MISSING_JUSTIFICATION: Bypass requires reason and authorizedBy'
      )
    }
    
    logger.warn('TENANT_BYPASS_USED', {
      reason: ctx._bypassReason,
      authorizedBy: ctx._bypassAuthorizedBy,
      timestamp: new Date().toISOString()
    })
  }
}
```

---

## Job Scheduling Patterns

### Pattern 1: Per-Tenant Scheduled Jobs

**Use Case**: Each tenant has independent schedule

**Example**: Tenant-specific report generation

```typescript
// Scheduler configuration (pseudo-code)
for (const tenant of activeTenants) {
  schedule.cron(`0 2 * * *`, () => {
    generateTenantReport(tenant.id)
  })
}
```

---

### Pattern 2: Global Job with Tenant Iteration

**Use Case**: Single job processes all tenants

**Example**: Session cleanup

```typescript
// Scheduler configuration
schedule.cron(`0 * * * *`, () => {
  cleanupExpiredSessionsGlobal()
})

// Job implementation
async function cleanupExpiredSessionsGlobal() {
  const tenants = await prisma.tenant.findMany({ 
    where: { isActive: true } 
  })
  
  for (const tenant of tenants) {
    await cleanupExpiredSessions(tenant.id)
  }
}
```

---

### Pattern 3: Event-Driven Jobs

**Use Case**: Job triggered by user action

**Example**: Alert generation

```typescript
// API handler
async function handleLogin(req: Request) {
  const user = requireAuth(req)
  
  // Detect new device
  if (isNewDevice(req)) {
    // Enqueue job with tenant context
    await queue.enqueue('generateSecurityAlert', {
      tenantId: user.tenantId,
      userId: user.sub,
      alertType: 'NEW_DEVICE',
      metadata: { device: req.headers['user-agent'] }
    })
  }
}
```

---

## Error Handling

### Error Types

```typescript
class BackgroundJobError extends Error {
  constructor(
    public code: string,
    public message: string,
    public tenantId?: number,
    public userId?: number
  ) {
    super(message)
  }
}

// Error codes
const ERRORS = {
  MISSING_TENANT: 'BACKGROUND_JOB_MISSING_TENANT',
  USER_TENANT_MISMATCH: 'USER_TENANT_MISMATCH',
  BYPASS_MISSING_JUSTIFICATION: 'BYPASS_MISSING_JUSTIFICATION',
  INVALID_TENANT_ID: 'INVALID_TENANT_ID'
}
```

### Error Handling Pattern

```typescript
async function backgroundJobWrapper(
  jobFn: Function,
  tenantId: number,
  ...args: any[]
) {
  try {
    // Validate tenant context
    validateTenantContext(tenantId, jobFn.name)
    
    // Execute job
    await jobFn(tenantId, ...args)
    
    logger.info('BACKGROUND_JOB_SUCCESS', { 
      job: jobFn.name, 
      tenantId 
    })
  } catch (error) {
    logger.error('BACKGROUND_JOB_FAILED', {
      job: jobFn.name,
      tenantId,
      error: error.message,
      stack: error.stack
    })
    
    // Re-throw for job queue retry logic
    throw error
  }
}
```

---

## Monitoring & Observability

### Metrics

```typescript
// Job execution metrics
background_job_executions_total{job="generateSecurityAlert", status="success"} 145
background_job_executions_total{job="generateSecurityAlert", status="error"} 2

// Tenant context validation
background_job_tenant_validation_errors_total{error="MISSING_TENANT"} 0
background_job_tenant_validation_errors_total{error="USER_TENANT_MISMATCH"} 1

// Bypass usage
background_job_bypass_usage_total{job="collectSystemMetrics"} 24
```

### Alerts

```yaml
# Alert on missing tenant context
- alert: BackgroundJobMissingTenant
  expr: increase(background_job_tenant_validation_errors_total[5m]) > 0
  severity: critical
  summary: "Background job executed without tenant context"

# Alert on bypass usage spike
- alert: BackgroundJobBypassSpike
  expr: rate(background_job_bypass_usage_total[1h]) > 10
  severity: warning
  summary: "Unusual bypass usage in background jobs"
```

---

## Summary Table

| Job | Tenant Context | Pattern | Bypass Allowed? |
|-----|---------------|---------|-----------------|
| Alert Generation | Explicit `tenantId` param | Per-Tenant | ❌ No |
| Audit Log Archival | Tenant iteration | Cross-Tenant | ❌ No |
| Session Cleanup | Tenant iteration | Cross-Tenant | ❌ No |
| MFA Reset | Explicit `tenantId` param | Per-Tenant | ❌ No |
| System Metrics | N/A | Bypass | ✅ Yes (read-only) |
| Tenant Health Check | Tenant iteration | Cross-Tenant | ❌ No |

---

## Waiting for next instruction.
