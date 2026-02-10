# Safe Rollout Strategy: Global Tenant Enforcement

## Executive Summary

This strategy enables tenant enforcement in production with **zero downtime** and **zero risk** through:
- 4-phase gradual rollout
- Feature flag controls
- Logging-only detection phase
- Per-model enforcement granularity
- Instant rollback capability

**Timeline**: 2-4 weeks (adjustable based on violation discovery rate)

---

## Rollout Phases

### Phase 0: Preparation (Pre-Deployment)
**Duration**: 1-2 days
**Goal**: Deploy middleware infrastructure in **disabled** state

#### Actions
1. Deploy Prisma middleware code to production
2. Set feature flag: `TENANT_ENFORCEMENT_ENABLED=false`
3. Verify middleware loads without errors
4. Confirm zero performance impact

#### Success Criteria
- ✅ Middleware deployed
- ✅ No errors in logs
- ✅ No change in query performance
- ✅ All queries pass through unchanged

#### Rollback
- Remove middleware from Prisma client initialization
- Redeploy previous version

---

### Phase 1: Detection (Logging Only)
**Duration**: 1 week
**Goal**: Identify ALL non-compliant queries without blocking them

#### Feature Flags
```env
TENANT_ENFORCEMENT_ENABLED=true
TENANT_ENFORCEMENT_MODE=log_only
TENANT_ENFORCEMENT_MODELS=all
```

#### Middleware Behavior
```typescript
// Pseudo-code
if (violation detected) {
  logger.warn("TENANT_VIOLATION", {
    model: params.model,
    action: params.action,
    violation: "missing_tenant_id",
    stackTrace: getStackTrace(),
    endpoint: getRequestContext()
  })
  
  // ✅ ALLOW query to proceed (no blocking)
  return next(params)
}
```

#### Monitoring
- **Metric**: `tenant_violations_total` (counter by model)
- **Alert**: Daily summary of violations
- **Dashboard**: Violation trends by model, endpoint, time

#### Actions During Phase
1. **Day 1-2**: Collect violation data
2. **Day 3-5**: Fix high-frequency violations in code
3. **Day 6-7**: Verify violation rate decreasing

#### Success Criteria
- ✅ Violation rate < 10 per hour
- ✅ All CRITICAL models (User, RefreshToken, etc.) have zero violations
- ✅ No production incidents

#### Rollback
```env
TENANT_ENFORCEMENT_ENABLED=false
```
(Instant - no code deployment needed)

---

### Phase 2: Selective Enforcement (CRITICAL Models Only)
**Duration**: 3-5 days
**Goal**: Enforce tenant isolation on CRITICAL models, log violations on others

#### Feature Flags
```env
TENANT_ENFORCEMENT_ENABLED=true
TENANT_ENFORCEMENT_MODE=selective
TENANT_ENFORCEMENT_ENFORCE_MODELS=User,RefreshToken,PasswordResetToken,MfaBackupCode,AuditLog
TENANT_ENFORCEMENT_LOG_MODELS=Role,UserRole,SecurityAlert,RolePermission
```

#### Middleware Behavior
```typescript
const ENFORCE_MODELS = process.env.TENANT_ENFORCEMENT_ENFORCE_MODELS.split(',')
const LOG_MODELS = process.env.TENANT_ENFORCEMENT_LOG_MODELS.split(',')

if (violation detected) {
  if (ENFORCE_MODELS.includes(params.model)) {
    // ❌ BLOCK query
    throw new Error(`TENANT_CONTEXT_REQUIRED: ${params.model}`)
  }
  
  if (LOG_MODELS.includes(params.model)) {
    // ⚠️ LOG but allow
    logger.warn("TENANT_VIOLATION", { ... })
    return next(params)
  }
}
```

#### Monitoring
- **Metric**: `tenant_enforcement_errors_total` (counter by model)
- **Alert**: Error rate > 0.1% of requests
- **Dashboard**: Error rate by model, endpoint

#### Actions During Phase
1. **Day 1**: Enable enforcement for CRITICAL models
2. **Day 2-3**: Monitor error rates, fix any breaking queries
3. **Day 4-5**: Verify zero errors, prepare for full enforcement

#### Success Criteria
- ✅ Zero errors on CRITICAL models
- ✅ Violation rate on LOG models < 5 per hour
- ✅ No user-facing errors

#### Rollback
```env
# Option 1: Back to logging only
TENANT_ENFORCEMENT_MODE=log_only

# Option 2: Disable specific model
TENANT_ENFORCEMENT_ENFORCE_MODELS=User,RefreshToken  # Remove problematic model
```

---

### Phase 3: Full Enforcement (All Models)
**Duration**: 3-5 days
**Goal**: Enforce tenant isolation on ALL tenant-owned models

#### Feature Flags
```env
TENANT_ENFORCEMENT_ENABLED=true
TENANT_ENFORCEMENT_MODE=enforce
TENANT_ENFORCEMENT_ENFORCE_MODELS=all
```

#### Middleware Behavior
```typescript
if (violation detected) {
  // ❌ BLOCK all violations
  throw new Error(`TENANT_CONTEXT_REQUIRED: ${params.model}`)
}
```

#### Monitoring
- **Metric**: `tenant_enforcement_errors_total`
- **Alert**: Error rate > 0.01% of requests
- **Dashboard**: Error distribution by endpoint

#### Actions During Phase
1. **Day 1**: Enable full enforcement
2. **Day 2-3**: Monitor for edge cases
3. **Day 4-5**: Verify stability

#### Success Criteria
- ✅ Error rate < 0.01%
- ✅ All errors are legitimate (not false positives)
- ✅ No production incidents

#### Rollback
```env
# Back to selective enforcement
TENANT_ENFORCEMENT_MODE=selective
TENANT_ENFORCEMENT_ENFORCE_MODELS=User,RefreshToken,PasswordResetToken,MfaBackupCode,AuditLog
```

---

### Phase 4: Hardening (Remove Feature Flags)
**Duration**: Ongoing
**Goal**: Make enforcement permanent, remove bypass mechanisms

#### Actions
1. Remove feature flag checks from code
2. Make enforcement always-on
3. Remove logging-only mode option
4. Audit bypass usage

#### Success Criteria
- ✅ Enforcement is permanent
- ✅ No feature flag dependencies
- ✅ Bypass mechanism only used for documented system jobs

---

## Feature Flag Configuration

### Environment Variables

```env
# Master switch
TENANT_ENFORCEMENT_ENABLED=true|false

# Enforcement mode
TENANT_ENFORCEMENT_MODE=disabled|log_only|selective|enforce

# Model-specific enforcement (comma-separated)
TENANT_ENFORCEMENT_ENFORCE_MODELS=User,Role,AuditLog|all
TENANT_ENFORCEMENT_LOG_MODELS=UserRole,RolePermission|all

# Bypass controls
TENANT_ENFORCEMENT_ALLOW_BYPASS=true|false
TENANT_ENFORCEMENT_BYPASS_REQUIRES_REASON=true|false

# Sampling (for high-traffic environments)
TENANT_ENFORCEMENT_LOG_SAMPLE_RATE=1.0  # 1.0 = 100%, 0.1 = 10%
```

### Feature Flag Precedence

```
TENANT_ENFORCEMENT_ENABLED=false
  → All enforcement disabled, middleware is no-op

TENANT_ENFORCEMENT_MODE=disabled
  → Same as ENABLED=false

TENANT_ENFORCEMENT_MODE=log_only
  → Log violations, never block

TENANT_ENFORCEMENT_MODE=selective
  → Block models in ENFORCE_MODELS
  → Log models in LOG_MODELS
  → Allow models not in either list

TENANT_ENFORCEMENT_MODE=enforce
  → Block all violations
  → Ignore ENFORCE_MODELS/LOG_MODELS
```

---

## Violation Detection Strategy

### Logging Schema

```typescript
interface TenantViolation {
  timestamp: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  model: string
  action: string
  violation: 'missing_tenant_id' | 'missing_relation_filter'
  endpoint: string
  method: string
  userId?: number
  tenantId?: number  // From JWT if available
  stackTrace: string
  queryArgs: object  // Sanitized query arguments
}
```

### Log Aggregation

```typescript
// Example log entry
{
  "timestamp": "2026-01-28T23:00:00Z",
  "severity": "CRITICAL",
  "model": "User",
  "action": "findMany",
  "violation": "missing_tenant_id",
  "endpoint": "/api/admin/users",
  "method": "GET",
  "userId": 5,
  "tenantId": 1,
  "stackTrace": "at requireAuth (/src/lib/auth/auth-guard.ts:12)\n...",
  "queryArgs": {
    "where": { "isActive": true }  // Missing tenantId
  }
}
```

### Violation Analysis

#### Daily Report
```
Tenant Enforcement Violations - 2026-01-28

Total Violations: 47
By Severity:
  CRITICAL: 12 (User: 8, RefreshToken: 4)
  HIGH: 23 (Role: 15, UserRole: 8)
  MEDIUM: 12 (RolePermission: 12)

Top Violating Endpoints:
  1. /api/admin/users (23 violations)
  2. /api/admin/roles (15 violations)
  3. /api/secure/sessions (9 violations)

Recommended Actions:
  - Fix /api/admin/users endpoint (CRITICAL)
  - Review /api/admin/roles queries (HIGH)
```

#### Violation Trends
```
Week 1: 450 violations/day → Fix high-frequency issues
Week 2: 120 violations/day → Fix medium-frequency issues
Week 3: 25 violations/day → Fix edge cases
Week 4: 5 violations/day → Ready for enforcement
```

---

## Monitoring & Alerting

### Metrics

```typescript
// Prometheus-style metrics

// Violation count (Phase 1)
tenant_violations_total{model="User", severity="CRITICAL"} 8

// Enforcement errors (Phase 2+)
tenant_enforcement_errors_total{model="User", endpoint="/api/admin/users"} 3

// Bypass usage
tenant_bypass_usage_total{reason="system_maintenance"} 2

// Performance impact
tenant_middleware_duration_ms{percentile="p95"} 0.5
```

### Alerts

#### Phase 1 (Logging Only)
```yaml
# No blocking alerts, just daily summaries
- alert: TenantViolationSummary
  expr: increase(tenant_violations_total[24h]) > 0
  severity: info
  summary: "Daily tenant violation report"
```

#### Phase 2 (Selective Enforcement)
```yaml
# Alert on errors for enforced models
- alert: TenantEnforcementErrors
  expr: rate(tenant_enforcement_errors_total[5m]) > 0.001
  severity: warning
  summary: "Tenant enforcement blocking queries"
  
# Alert on high violation rate for logged models
- alert: TenantViolationSpike
  expr: rate(tenant_violations_total[5m]) > 1
  severity: info
  summary: "High rate of tenant violations detected"
```

#### Phase 3 (Full Enforcement)
```yaml
# Alert on any errors
- alert: TenantEnforcementErrors
  expr: rate(tenant_enforcement_errors_total[5m]) > 0.0001
  severity: critical
  summary: "Tenant enforcement errors in production"
  
# Alert on bypass usage
- alert: TenantBypassUsage
  expr: increase(tenant_bypass_usage_total[1h]) > 5
  severity: warning
  summary: "Unusual tenant bypass usage"
```

### Dashboards

#### Violation Dashboard (Phase 1)
```
┌─────────────────────────────────────────┐
│ Tenant Violations (Last 24h)           │
├─────────────────────────────────────────┤
│ Total: 47                               │
│ CRITICAL: 12 | HIGH: 23 | MEDIUM: 12   │
├─────────────────────────────────────────┤
│ By Model:                               │
│ ████████ User (8)                       │
│ ███████████████ Role (15)               │
│ ████████████ RolePermission (12)        │
│ ████ RefreshToken (4)                   │
├─────────────────────────────────────────┤
│ Trend: ↓ 15% vs yesterday               │
└─────────────────────────────────────────┘
```

#### Enforcement Dashboard (Phase 2+)
```
┌─────────────────────────────────────────┐
│ Tenant Enforcement Status               │
├─────────────────────────────────────────┤
│ Mode: SELECTIVE                         │
│ Enforced Models: 5                      │
│ Logged Models: 4                        │
├─────────────────────────────────────────┤
│ Error Rate: 0.002%                      │
│ Errors (Last 1h): 3                     │
│ Bypasses (Last 1h): 0                   │
├─────────────────────────────────────────┤
│ Performance Impact: +0.3ms (p95)        │
└─────────────────────────────────────────┘
```

---

## Rollback Plan

### Instant Rollback (Feature Flag)

**Trigger**: Error rate > 1% OR user-facing errors

**Action**: Update environment variable
```bash
# Disable enforcement immediately
kubectl set env deployment/api TENANT_ENFORCEMENT_MODE=log_only

# OR disable completely
kubectl set env deployment/api TENANT_ENFORCEMENT_ENABLED=false
```

**Recovery Time**: < 1 minute (no code deployment)

**Impact**: Zero downtime, queries immediately allowed

---

### Partial Rollback (Model-Specific)

**Trigger**: Specific model causing errors

**Action**: Remove model from enforcement list
```bash
# Remove problematic model (e.g., Role)
kubectl set env deployment/api \
  TENANT_ENFORCEMENT_ENFORCE_MODELS=User,RefreshToken,PasswordResetToken,MfaBackupCode,AuditLog
```

**Recovery Time**: < 1 minute

**Impact**: Only affected model queries allowed, others still enforced

---

### Full Rollback (Code Deployment)

**Trigger**: Middleware causing performance issues OR critical bugs

**Action**: Deploy previous version
```bash
# Revert to commit before middleware
git revert <middleware-commit>
git push origin main

# Deploy
kubectl rollout undo deployment/api
```

**Recovery Time**: 5-10 minutes (deployment time)

**Impact**: Zero downtime (rolling deployment)

---

## Risk Mitigation

### Risk 1: False Positives (Legitimate Queries Blocked)

**Mitigation**:
- Phase 1 (logging only) identifies all violations before blocking
- Selective enforcement allows fixing violations incrementally
- Feature flags enable instant rollback

**Detection**:
- Monitor error logs for unexpected models
- User reports of "access denied" errors
- Spike in error rate

**Response**:
- Immediate rollback to logging mode
- Analyze query pattern
- Add to bypass list if legitimate system query
- Fix query to include tenant context

---

### Risk 2: Performance Degradation

**Mitigation**:
- Middleware runs before query execution (minimal overhead)
- Simple object property checks (O(1) complexity)
- No additional database queries

**Detection**:
- Monitor `tenant_middleware_duration_ms` metric
- Compare p95/p99 latency before/after
- APM tools (e.g., New Relic, Datadog)

**Response**:
- If overhead > 5ms: Optimize middleware logic
- If overhead > 10ms: Disable enforcement, investigate

**Expected Overhead**: < 1ms per query

---

### Risk 3: Bypass Mechanism Abuse

**Mitigation**:
- Bypass requires explicit flag + reason + authorized user
- All bypass usage logged with stack trace
- Alert on unusual bypass rate

**Detection**:
- Monitor `tenant_bypass_usage_total` metric
- Review bypass logs weekly
- Alert if > 5 bypasses per hour

**Response**:
- Audit bypass usage
- Identify legitimate vs. illegitimate bypasses
- Refactor code to eliminate unnecessary bypasses

---

### Risk 4: Incomplete Violation Detection (Phase 1)

**Mitigation**:
- Run Phase 1 for full week (covers all code paths)
- Test enforcement in staging first
- Gradual rollout to production (canary deployment)

**Detection**:
- Violations discovered in Phase 2 (selective enforcement)
- User reports of errors after enforcement enabled

**Response**:
- Rollback to logging mode
- Extend Phase 1 duration
- Add missing violations to fix list

---

## Testing Strategy

### Pre-Deployment Testing

#### Unit Tests
```typescript
describe('Tenant Enforcement Middleware', () => {
  it('allows query with tenantId in log_only mode', async () => {
    process.env.TENANT_ENFORCEMENT_MODE = 'log_only'
    await expect(
      prisma.user.findMany({ where: { isActive: true } })
    ).resolves.toBeDefined()
  })
  
  it('blocks query without tenantId in enforce mode', async () => {
    process.env.TENANT_ENFORCEMENT_MODE = 'enforce'
    await expect(
      prisma.user.findMany({ where: { isActive: true } })
    ).rejects.toThrow('TENANT_CONTEXT_REQUIRED')
  })
  
  it('respects ENFORCE_MODELS in selective mode', async () => {
    process.env.TENANT_ENFORCEMENT_MODE = 'selective'
    process.env.TENANT_ENFORCEMENT_ENFORCE_MODELS = 'User'
    
    // User should be blocked
    await expect(
      prisma.user.findMany({ where: { isActive: true } })
    ).rejects.toThrow()
    
    // Role should be allowed (not in ENFORCE_MODELS)
    await expect(
      prisma.role.findMany({ where: { isActive: true } })
    ).resolves.toBeDefined()
  })
})
```

#### Integration Tests
```typescript
describe('API Endpoints with Tenant Enforcement', () => {
  it('GET /api/admin/users includes tenantId', async () => {
    process.env.TENANT_ENFORCEMENT_MODE = 'enforce'
    
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${validToken}`)
    
    expect(response.status).toBe(200)
    expect(response.body).toBeDefined()
  })
})
```

### Staging Deployment

1. Deploy to staging with `TENANT_ENFORCEMENT_MODE=log_only`
2. Run automated test suite
3. Review violation logs
4. Fix violations
5. Enable `TENANT_ENFORCEMENT_MODE=enforce`
6. Verify zero errors
7. Proceed to production

---

## Success Criteria

### Phase 1 (Logging Only)
- ✅ Middleware deployed to production
- ✅ Violation logs collected for 7 days
- ✅ Violation rate < 10 per hour
- ✅ All CRITICAL model violations fixed

### Phase 2 (Selective Enforcement)
- ✅ CRITICAL models enforced
- ✅ Error rate < 0.1%
- ✅ No user-facing errors
- ✅ Violation rate on logged models < 5 per hour

### Phase 3 (Full Enforcement)
- ✅ All tenant-owned models enforced
- ✅ Error rate < 0.01%
- ✅ No production incidents
- ✅ Bypass usage < 5 per day

### Phase 4 (Hardening)
- ✅ Feature flags removed
- ✅ Enforcement always-on
- ✅ Bypass mechanism audited
- ✅ Documentation updated

---

## Timeline

```
Week 1:
  Day 1-2: Deploy Phase 0 (middleware disabled)
  Day 3-7: Phase 1 (logging only)

Week 2:
  Day 1-3: Fix violations from Phase 1
  Day 4-7: Phase 2 (selective enforcement)

Week 3:
  Day 1-2: Monitor Phase 2
  Day 3-7: Phase 3 (full enforcement)

Week 4:
  Day 1-7: Monitor Phase 3, prepare for hardening

Week 5+:
  Phase 4 (hardening) - ongoing
```

**Total Duration**: 4-5 weeks (adjustable based on violation rate)

---

## Waiting for next instruction.
