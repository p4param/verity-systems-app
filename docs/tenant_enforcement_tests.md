# Test Cases: Global Tenant Enforcement

## Test Coverage Matrix

| Category | Test Cases | Priority |
|----------|-----------|----------|
| Missing tenantId | 12 | CRITICAL |
| Wrong tenantId | 8 | CRITICAL |
| Cross-tenant access | 10 | CRITICAL |
| Admin paths | 6 | HIGH |
| Background jobs | 8 | HIGH |
| Edge cases | 6 | MEDIUM |
| **TOTAL** | **50** | |

---

## Category 1: Missing tenantId (CRITICAL)

### Test 1.1: User Query Without tenantId
**Model**: User (tenant-scoped)
**Operation**: findMany
**Query**:
```typescript
await prisma.user.findMany({
  where: { isActive: true }
  // Missing: tenantId
})
```
**Expected**: ❌ Error `TENANT_CONTEXT_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Direct tenant-scoped model requires tenantId

---

### Test 1.2: Role Query Without tenantId
**Model**: Role (tenant-scoped)
**Operation**: findFirst
**Query**:
```typescript
await prisma.role.findFirst({
  where: { name: "Admin" }
  // Missing: tenantId
})
```
**Expected**: ❌ Error `TENANT_CONTEXT_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Role names are not globally unique

---

### Test 1.3: AuditLog Query Without tenantId
**Model**: AuditLog (tenant-scoped)
**Operation**: findMany
**Query**:
```typescript
await prisma.auditLog.findMany({
  where: { action: "USER_LOGIN" }
  // Missing: tenantId
})
```
**Expected**: ❌ Error `TENANT_CONTEXT_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Audit logs are tenant-specific

---

### Test 1.4: UserRole Query Without Relation Filter
**Model**: UserRole (tenant-related)
**Operation**: findMany
**Query**:
```typescript
await prisma.userRole.findMany({
  where: { roleId: 5 }
  // Missing: user.tenantId or role.tenantId
})
```
**Expected**: ❌ Error `TENANT_RELATION_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Junction table requires tenant-scoped relation

---

### Test 1.5: RefreshToken Query Without User Relation
**Model**: RefreshToken (tenant-related)
**Operation**: findFirst
**Query**:
```typescript
await prisma.refreshToken.findFirst({
  where: { tokenHash: "abc123" }
  // Missing: user.tenantId
})
```
**Expected**: ❌ Error `TENANT_RELATION_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Session tokens are user-owned (tenant-scoped)

---

### Test 1.6: SecurityAlert Query Without User Relation
**Model**: SecurityAlert (tenant-related)
**Operation**: findMany
**Query**:
```typescript
await prisma.securityAlert.findMany({
  where: { severity: "CRITICAL" }
  // Missing: user.tenantId
})
```
**Expected**: ❌ Error `TENANT_RELATION_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Alerts are user-owned (tenant-scoped)

---

### Test 1.7: User Create Without tenantId
**Model**: User (tenant-scoped)
**Operation**: create
**Query**:
```typescript
await prisma.user.create({
  data: {
    fullName: "Test User",
    email: "test@example.com",
    passwordHash: "hash"
    // Missing: tenantId
  }
})
```
**Expected**: ❌ Error `TENANT_CONTEXT_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: New users must belong to a tenant

---

### Test 1.8: User Update Without tenantId in Where
**Model**: User (tenant-scoped)
**Operation**: update
**Query**:
```typescript
await prisma.user.update({
  where: { id: 5 },  // Missing: tenantId
  data: { fullName: "Updated Name" }
})
```
**Expected**: ❌ Error `TENANT_CONTEXT_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Update must be tenant-scoped

---

### Test 1.9: User Delete Without tenantId
**Model**: User (tenant-scoped)
**Operation**: delete
**Query**:
```typescript
await prisma.user.delete({
  where: { id: 5 }  // Missing: tenantId
})
```
**Expected**: ❌ Error `TENANT_CONTEXT_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Delete must be tenant-scoped

---

### Test 1.10: User Count Without tenantId
**Model**: User (tenant-scoped)
**Operation**: count
**Query**:
```typescript
await prisma.user.count({
  where: { isActive: true }
  // Missing: tenantId
})
```
**Expected**: ❌ Error `TENANT_CONTEXT_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Count must be tenant-scoped

---

### Test 1.11: PasswordResetToken Without User Relation
**Model**: PasswordResetToken (tenant-related)
**Operation**: findFirst
**Query**:
```typescript
await prisma.passwordResetToken.findFirst({
  where: { tokenHash: "xyz789" }
  // Missing: user.tenantId
})
```
**Expected**: ❌ Error `TENANT_RELATION_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Password reset tokens are user-owned

---

### Test 1.12: MfaBackupCode Without User Relation
**Model**: MfaBackupCode (tenant-related)
**Operation**: findMany
**Query**:
```typescript
await prisma.mfaBackupCode.findMany({
  where: { userId: 5, used: false }
  // Missing: user.tenantId
})
```
**Expected**: ❌ Error `TENANT_RELATION_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: MFA codes are user-owned

---

## Category 2: Wrong tenantId (CRITICAL)

### Test 2.1: User Query with Wrong tenantId
**Scenario**: User in Tenant 1 queries Tenant 2 data
**Setup**:
- JWT: `{ sub: 5, tenantId: 1 }`
- Target: User in Tenant 2
**Query**:
```typescript
// User's JWT has tenantId: 1
await prisma.user.findMany({
  where: { tenantId: 2 }  // ❌ Wrong tenant
})
```
**Expected**: ✅ Success (returns empty array)
**Rationale**: Query is valid but returns no results (no cross-tenant data)

---

### Test 2.2: User Update with Wrong tenantId
**Scenario**: User in Tenant 1 tries to update user in Tenant 2
**Setup**:
- JWT: `{ sub: 5, tenantId: 1 }`
- Target: User ID 10 in Tenant 2
**Query**:
```typescript
await prisma.user.update({
  where: { id: 10, tenantId: 1 },  // User 10 is in Tenant 2
  data: { fullName: "Hacked" }
})
```
**Expected**: ❌ Error (record not found)
**Rationale**: User 10 doesn't exist in Tenant 1

---

### Test 2.3: Role Assignment Across Tenants
**Scenario**: Assign Tenant 1 role to Tenant 2 user
**Setup**:
- User ID 5 in Tenant 1
- Role ID 3 in Tenant 2
**Query**:
```typescript
await prisma.userRole.create({
  data: {
    userId: 5,   // Tenant 1
    roleId: 3    // Tenant 2
  }
})
```
**Expected**: ❌ Error (foreign key constraint OR middleware rejection)
**Rationale**: Cannot link users and roles from different tenants

---

### Test 2.4: Session Token with Wrong User Tenant
**Scenario**: Query session token with mismatched user tenant
**Setup**:
- Token belongs to User 5 (Tenant 1)
- Query with Tenant 2 context
**Query**:
```typescript
await prisma.refreshToken.findFirst({
  where: {
    tokenHash: "abc123",
    user: { tenantId: 2 }  // Token is for Tenant 1 user
  }
})
```
**Expected**: ✅ Success (returns null)
**Rationale**: Valid query, no matching record

---

### Test 2.5: Audit Log with Wrong tenantId
**Scenario**: Query audit logs with wrong tenant
**Query**:
```typescript
// User's JWT has tenantId: 1
await prisma.auditLog.findMany({
  where: { tenantId: 2 }  // ❌ Wrong tenant
})
```
**Expected**: ✅ Success (returns empty array)
**Rationale**: Query is valid but returns no results

---

### Test 2.6: Create User in Wrong Tenant
**Scenario**: Admin in Tenant 1 tries to create user in Tenant 2
**Setup**:
- Admin JWT: `{ sub: 1, tenantId: 1 }`
**Query**:
```typescript
await prisma.user.create({
  data: {
    tenantId: 2,  // ❌ Different tenant
    fullName: "Test User",
    email: "test@example.com",
    passwordHash: "hash"
  }
})
```
**Expected**: ⚠️ Success (if no application-layer check)
**Rationale**: Middleware allows, but application should prevent
**Recommendation**: Add application-layer validation: `data.tenantId === jwt.tenantId`

---

### Test 2.7: Delete User from Wrong Tenant
**Scenario**: Admin in Tenant 1 tries to delete user in Tenant 2
**Query**:
```typescript
await prisma.user.delete({
  where: { id: 10, tenantId: 1 }  // User 10 is in Tenant 2
})
```
**Expected**: ❌ Error (record not found)
**Rationale**: User 10 doesn't exist in Tenant 1

---

### Test 2.8: Alert for User in Wrong Tenant
**Scenario**: Create alert for user in different tenant
**Query**:
```typescript
// Admin JWT: tenantId: 1
await prisma.securityAlert.create({
  data: {
    userId: 10,  // User 10 is in Tenant 2
    type: "NEW_DEVICE",
    title: "Alert",
    message: "Test",
    severity: "INFO"
  }
})
```
**Expected**: ❌ Error (foreign key constraint)
**Rationale**: User 10 doesn't exist in Tenant 1 context

---

## Category 3: Cross-Tenant Access Attempts (CRITICAL)

### Test 3.1: List All Users Across Tenants
**Attack**: Omit tenantId to get all users
**Query**:
```typescript
await prisma.user.findMany({
  // No where clause at all
})
```
**Expected**: ❌ Error `TENANT_CONTEXT_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Must explicitly specify tenantId

---

### Test 3.2: Email Lookup Across Tenants
**Attack**: Find user by email without tenant scope
**Query**:
```typescript
await prisma.user.findFirst({
  where: { email: "admin@example.com" }
  // Missing: tenantId
})
```
**Expected**: ❌ Error `TENANT_CONTEXT_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Email is unique per tenant, not globally

---

### Test 3.3: Role Enumeration Across Tenants
**Attack**: List all roles without tenant filter
**Query**:
```typescript
await prisma.role.findMany({
  where: { name: { contains: "Admin" } }
  // Missing: tenantId
})
```
**Expected**: ❌ Error `TENANT_CONTEXT_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Role names are tenant-specific

---

### Test 3.4: Session Hijacking Attempt
**Attack**: Query session token without user tenant
**Query**:
```typescript
await prisma.refreshToken.findFirst({
  where: { tokenHash: "stolen-token" }
  // Missing: user.tenantId
})
```
**Expected**: ❌ Error `TENANT_RELATION_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Session tokens are user-owned (tenant-scoped)

---

### Test 3.5: Audit Log Snooping
**Attack**: Read audit logs from other tenants
**Query**:
```typescript
await prisma.auditLog.findMany({
  where: { action: "PASSWORD_CHANGE" }
  // Missing: tenantId
})
```
**Expected**: ❌ Error `TENANT_CONTEXT_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Audit logs are tenant-specific

---

### Test 3.6: Alert Enumeration
**Attack**: List all security alerts across tenants
**Query**:
```typescript
await prisma.securityAlert.findMany({
  where: { severity: "CRITICAL" }
  // Missing: user.tenantId
})
```
**Expected**: ❌ Error `TENANT_RELATION_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Alerts are user-owned (tenant-scoped)

---

### Test 3.7: Password Reset Token Theft
**Attack**: Find password reset token without tenant scope
**Query**:
```typescript
await prisma.passwordResetToken.findFirst({
  where: { tokenHash: "reset-token" }
  // Missing: user.tenantId
})
```
**Expected**: ❌ Error `TENANT_RELATION_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Reset tokens are user-owned

---

### Test 3.8: MFA Backup Code Enumeration
**Attack**: List MFA codes without tenant scope
**Query**:
```typescript
await prisma.mfaBackupCode.findMany({
  where: { used: false }
  // Missing: user.tenantId
})
```
**Expected**: ❌ Error `TENANT_RELATION_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: MFA codes are user-owned

---

### Test 3.9: Cross-Tenant Role Assignment
**Attack**: Assign role from Tenant 1 to user in Tenant 2
**Query**:
```typescript
await prisma.userRole.create({
  data: {
    userId: 5,   // Tenant 1
    roleId: 10   // Tenant 2
  }
})
```
**Expected**: ❌ Error (foreign key constraint)
**Rationale**: Database-level constraint prevents cross-tenant links

---

### Test 3.10: Bulk Update Across Tenants
**Attack**: Update all users without tenant filter
**Query**:
```typescript
await prisma.user.updateMany({
  where: { isActive: true },
  data: { isLocked: true }
  // Missing: tenantId
})
```
**Expected**: ❌ Error `TENANT_CONTEXT_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Bulk operations must be tenant-scoped

---

## Category 4: Admin Paths (HIGH)

### Test 4.1: Admin User List with tenantId
**Role**: Admin in Tenant 1
**Query**:
```typescript
// JWT: { sub: 1, tenantId: 1, roles: ["Admin"] }
await prisma.user.findMany({
  where: { tenantId: 1 }
})
```
**Expected**: ✅ Success (returns Tenant 1 users)
**Rationale**: Admin can list users in their tenant

---

### Test 4.2: Admin User List Without tenantId
**Role**: Admin in Tenant 1
**Query**:
```typescript
await prisma.user.findMany({
  // Missing: tenantId
})
```
**Expected**: ❌ Error `TENANT_CONTEXT_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Even admins must specify tenant

---

### Test 4.3: Admin Cross-Tenant User Access
**Role**: Admin in Tenant 1
**Query**:
```typescript
await prisma.user.findMany({
  where: { tenantId: 2 }  // Different tenant
})
```
**Expected**: ✅ Success (returns empty array)
**Rationale**: Query is valid but no access to Tenant 2 data

---

### Test 4.4: Admin Role Creation with tenantId
**Role**: Admin in Tenant 1
**Query**:
```typescript
await prisma.role.create({
  data: {
    tenantId: 1,
    name: "Custom Role",
    description: "Test"
  }
})
```
**Expected**: ✅ Success
**Rationale**: Admin can create roles in their tenant

---

### Test 4.5: Admin Role Creation in Wrong Tenant
**Role**: Admin in Tenant 1
**Query**:
```typescript
await prisma.role.create({
  data: {
    tenantId: 2,  // Different tenant
    name: "Custom Role",
    description: "Test"
  }
})
```
**Expected**: ⚠️ Success (if no application-layer check)
**Rationale**: Middleware allows, application should prevent
**Recommendation**: Add validation: `data.tenantId === jwt.tenantId`

---

### Test 4.6: Admin Audit Log Access
**Role**: Admin in Tenant 1
**Query**:
```typescript
await prisma.auditLog.findMany({
  where: { tenantId: 1 }
})
```
**Expected**: ✅ Success
**Rationale**: Admin can view audit logs in their tenant

---

## Category 5: Background Jobs (HIGH)

### Test 5.1: Alert Generation with tenantId
**Job**: generateSecurityAlert
**Parameters**: `(tenantId: 1, userId: 5, alertType: "NEW_DEVICE")`
**Query**:
```typescript
await prisma.securityAlert.create({
  data: {
    userId: 5,  // User in Tenant 1
    type: "NEW_DEVICE",
    title: "New Device",
    message: "Login from new device",
    severity: "INFO"
  }
})
```
**Expected**: ✅ Success
**Rationale**: Job has explicit tenantId parameter

---

### Test 5.2: Alert Generation Without tenantId
**Job**: generateSecurityAlert (malformed)
**Parameters**: `(userId: 5, alertType: "NEW_DEVICE")`  // Missing tenantId
**Validation**:
```typescript
if (!tenantId || tenantId <= 0) {
  throw new Error('ALERT_JOB_MISSING_TENANT')
}
```
**Expected**: ❌ Error `ALERT_JOB_MISSING_TENANT`
**Rationale**: Job validation fails before query

---

### Test 5.3: Session Cleanup with tenantId
**Job**: cleanupExpiredSessions
**Parameters**: `(tenantId: 1)`
**Query**:
```typescript
await prisma.refreshToken.updateMany({
  where: {
    user: { tenantId: 1 },
    expiresAt: { lt: new Date() }
  },
  data: { revokedAt: new Date() }
})
```
**Expected**: ✅ Success
**Rationale**: Job uses tenant-scoped relation filter

---

### Test 5.4: Session Cleanup Without tenantId
**Job**: cleanupExpiredSessions (malformed)
**Query**:
```typescript
await prisma.refreshToken.updateMany({
  where: {
    expiresAt: { lt: new Date() }
    // Missing: user.tenantId
  },
  data: { revokedAt: new Date() }
})
```
**Expected**: ❌ Error `TENANT_RELATION_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Middleware rejects query

---

### Test 5.5: Audit Log Archival with tenantId
**Job**: archiveOldAuditLogs
**Parameters**: `(tenantId: 1, retentionDays: 90)`
**Query**:
```typescript
await prisma.auditLog.findMany({
  where: {
    tenantId: 1,
    createdAt: { lt: cutoffDate }
  }
})
```
**Expected**: ✅ Success
**Rationale**: Job has explicit tenantId parameter

---

### Test 5.6: Audit Log Archival Without tenantId
**Job**: archiveOldAuditLogs (malformed)
**Query**:
```typescript
await prisma.auditLog.findMany({
  where: {
    createdAt: { lt: cutoffDate }
    // Missing: tenantId
  }
})
```
**Expected**: ❌ Error `TENANT_CONTEXT_REQUIRED`
**Enforcement Mode**: enforce
**Rationale**: Middleware rejects query

---

### Test 5.7: MFA Reset with Tenant Validation
**Job**: resetUserMfa
**Parameters**: `(tenantId: 1, userId: 5)`
**Validation**:
```typescript
const user = await prisma.user.findFirst({
  where: { id: 5, tenantId: 1 }
})
if (!user) throw new Error('USER_TENANT_MISMATCH')
```
**Expected**: ✅ Success (if user exists in tenant)
**Rationale**: Job validates user belongs to tenant

---

### Test 5.8: MFA Reset with Wrong Tenant
**Job**: resetUserMfa
**Parameters**: `(tenantId: 1, userId: 10)`  // User 10 is in Tenant 2
**Validation**:
```typescript
const user = await prisma.user.findFirst({
  where: { id: 10, tenantId: 1 }
})
if (!user) throw new Error('USER_TENANT_MISMATCH')
```
**Expected**: ❌ Error `USER_TENANT_MISMATCH`
**Rationale**: User 10 doesn't exist in Tenant 1

---

## Category 6: Edge Cases (MEDIUM)

### Test 6.1: Global Model Access (Permission)
**Model**: Permission (global)
**Query**:
```typescript
await prisma.permission.findMany()
```
**Expected**: ✅ Success
**Rationale**: Global models don't require tenantId

---

### Test 6.2: Global Model Access (Tenant Registry)
**Model**: Tenant (global)
**Query**:
```typescript
await prisma.tenant.findMany({
  where: { isActive: true }
})
```
**Expected**: ✅ Success
**Rationale**: Tenant registry is global

---

### Test 6.3: Rate Limiting Table (PasswordResetRequest)
**Model**: PasswordResetRequest (global)
**Query**:
```typescript
await prisma.passwordResetRequest.findMany({
  where: {
    email: "user@example.com",
    requestedAt: { gte: oneHourAgo }
  }
})
```
**Expected**: ✅ Success
**Rationale**: Rate-limiting table is global

---

### Test 6.4: Bypass with Justification
**Query**:
```typescript
await prisma.user.count({
  ctx: {
    _bypassTenantCheck: true,
    _bypassReason: 'System metrics',
    _bypassAuthorizedBy: 'system-cron'
  }
})
```
**Expected**: ✅ Success + Warning log
**Rationale**: Bypass allowed with audit trail

---

### Test 6.5: Bypass Without Justification
**Query**:
```typescript
await prisma.user.count({
  ctx: {
    _bypassTenantCheck: true
    // Missing: _bypassReason, _bypassAuthorizedBy
  }
})
```
**Expected**: ❌ Error `BYPASS_MISSING_JUSTIFICATION`
**Rationale**: Bypass requires reason and authorized by

---

### Test 6.6: Nested Relation Query
**Query**:
```typescript
await prisma.user.findMany({
  where: { tenantId: 1 },
  include: {
    userRoles: {
      include: {
        role: true
      }
    }
  }
})
```
**Expected**: ✅ Success
**Rationale**: Parent query has tenantId, relations inherit scope

---

## Test Execution Matrix

### By Enforcement Mode

| Mode | Missing tenantId | Wrong tenantId | Cross-tenant | Admin | Background | Edge |
|------|-----------------|----------------|--------------|-------|------------|------|
| **disabled** | ✅ Allow | ✅ Allow | ✅ Allow | ✅ Allow | ✅ Allow | ✅ Allow |
| **log_only** | ⚠️ Log + Allow | ✅ Allow | ⚠️ Log + Allow | ✅ Allow | ⚠️ Log + Allow | ✅ Allow |
| **selective** | ❌ Block (CRITICAL) | ✅ Allow | ❌ Block (CRITICAL) | ✅ Allow | ❌ Block (CRITICAL) | ✅ Allow |
| **enforce** | ❌ Block ALL | ✅ Allow | ❌ Block ALL | ✅ Allow | ❌ Block ALL | ✅ Allow |

### By Model Type

| Model Type | Missing tenantId | Wrong tenantId | Expected Behavior |
|-----------|-----------------|----------------|-------------------|
| Tenant-scoped (User, Role, AuditLog) | ❌ Error | ✅ Empty result | Strict enforcement |
| Tenant-related (UserRole, RefreshToken) | ❌ Error | ✅ Empty result | Relation filter required |
| Global (Permission, Tenant) | ✅ Allow | N/A | No enforcement |

---

## Test Scenarios Summary

### Expected Failures (Should Block)

| Test ID | Scenario | Error Code |
|---------|----------|------------|
| 1.1-1.12 | Missing tenantId on tenant-scoped models | `TENANT_CONTEXT_REQUIRED` |
| 3.1-3.10 | Cross-tenant access attempts | `TENANT_CONTEXT_REQUIRED` / `TENANT_RELATION_REQUIRED` |
| 4.2 | Admin without tenantId | `TENANT_CONTEXT_REQUIRED` |
| 5.2, 5.4, 5.6 | Background jobs without tenant context | `TENANT_CONTEXT_REQUIRED` / `ALERT_JOB_MISSING_TENANT` |
| 5.8 | MFA reset with wrong tenant | `USER_TENANT_MISMATCH` |
| 6.5 | Bypass without justification | `BYPASS_MISSING_JUSTIFICATION` |

**Total**: 32 test cases should fail (block)

### Expected Successes (Should Allow)

| Test ID | Scenario | Reason |
|---------|----------|--------|
| 2.1, 2.4, 2.5 | Wrong tenantId (valid query) | Returns empty result |
| 2.2, 2.7 | Update/delete with wrong tenant | Record not found |
| 4.1, 4.4, 4.6 | Admin with correct tenantId | Authorized access |
| 5.1, 5.3, 5.5, 5.7 | Background jobs with tenantId | Proper tenant context |
| 6.1-6.4, 6.6 | Global models and bypass | No enforcement needed |

**Total**: 18 test cases should succeed

---

## Test Automation Checklist

### Unit Tests (Middleware)
- [ ] Test all 12 missing tenantId scenarios
- [ ] Test bypass mechanism with/without justification
- [ ] Test model classification (tenant-scoped vs global)
- [ ] Test enforcement mode switching

### Integration Tests (API Routes)
- [ ] Test all 10 cross-tenant access attempts
- [ ] Test admin paths with correct/incorrect tenantId
- [ ] Test API error responses (401, 403, 500)

### Background Job Tests
- [ ] Test all 8 background job scenarios
- [ ] Test tenant iteration pattern
- [ ] Test job validation failures

### End-to-End Tests
- [ ] Test complete user flows with tenant isolation
- [ ] Test multi-tenant scenarios (2+ tenants)
- [ ] Test rollback scenarios (enforcement mode changes)

---

## Success Criteria

### Phase 1 (Logging Only)
- ✅ All 32 "should fail" tests log violations
- ✅ All 18 "should succeed" tests pass
- ✅ Zero false positives

### Phase 2 (Selective Enforcement)
- ✅ CRITICAL model tests (1.1-1.3, 3.1-3.8) fail with errors
- ✅ Other tests log violations
- ✅ All "should succeed" tests still pass

### Phase 3 (Full Enforcement)
- ✅ All 32 "should fail" tests fail with errors
- ✅ All 18 "should succeed" tests pass
- ✅ Zero production incidents

---

## Waiting for next instruction.
