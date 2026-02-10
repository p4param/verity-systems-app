# AG RUNBOOK — Phase 7.2
## User Deactivation & Reactivation

**Purpose:**  
This runbook defines a controlled, auditable process for deactivating and reactivating users within a tenant. The goal is to immediately remove access while preserving audit history and tenant isolation.

---

## Global Constraints

- ❌ Do not delete users
- ❌ Do not modify authentication or token logic
- ❌ Do not weaken tenant isolation
- ❌ Do not bypass audit logging
- ❌ Do not remove historical data
- ✅ Assume Phase 7.1 (invite-only provisioning) is complete

---

## User Lifecycle States

| Status | Description | Can Login? | Has Sessions? |
|--------|-------------|------------|---------------|
| **PENDING** | Invited, not yet activated | ❌ No | ❌ No |
| **ACTIVE** | Activated, can access system | ✅ Yes | ✅ Yes |
| **DISABLED** | Deactivated by admin | ❌ No | ❌ No (revoked) |

---

## Implementation Steps

### Step 1 — Schema Verification

**Requirement:** Ensure `UserStatus` enum contains PENDING, ACTIVE, DISABLED

**Status:** ✅ Complete (from Phase 7.1)

**Verification:**
```prisma
enum UserStatus {
  PENDING
  ACTIVE
  DISABLED
}
```

**No schema changes required** if Phase 7.1 is complete.

---

### Step 2 — Admin API: Deactivate User

**Endpoint:** `POST /api/admin/users/{userId}/deactivate`

**File:** `src/app/api/admin/users/[id]/deactivate/route.ts`

**Behavior:**
1. Require admin authentication (`USER_UPDATE` permission)
2. Verify target user belongs to same tenant
3. Prevent self-deactivation
4. Check user is not already disabled
5. Set user `status` to `DISABLED`
6. Revoke all active sessions for the user
7. Do NOT delete user data
8. Log audit event:
   - `action` = `USER.DEACTIVATE`
   - `actorUserId` = admin ID
   - `targetUserId` = user ID
   - `metadata` includes reason (optional)

**Request:**
```json
POST /api/admin/users/123/deactivate
{
  "reason": "Policy violation" // optional
}
```

**Response (200):**
```json
{
  "message": "User deactivated successfully",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "fullName": "John Doe",
    "status": "DISABLED"
  }
}
```

**Security Features:**
- ✅ Tenant isolation enforced
- ✅ Self-deactivation prevented
- ✅ All sessions revoked atomically
- ✅ Transaction-safe
- ✅ Full audit trail

**Status:** ✅ Complete

---

### Step 3 — Login Guard Enforcement

**File:** `src/app/api/auth/login/route.ts`

**Existing Code:**
```typescript
// Check user status (only ACTIVE users can log in)
if (user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Account is not available" }, { status: 401 })
}
```

**Behavior:**
- ✅ DISABLED users cannot log in
- ✅ PENDING users cannot log in
- ✅ Only ACTIVE users allowed
- ✅ Generic error message (no status leakage)

**Status:** ✅ Already enforced (from Phase 7.1)

**No changes required.**

---

### Step 4 — Admin API: Reactivate User

**Endpoint:** `POST /api/admin/users/{userId}/reactivate`

**File:** `src/app/api/admin/users/[id]/reactivate/route.ts`

**Behavior:**
1. Require admin authentication (`USER_UPDATE` permission)
2. Verify user belongs to same tenant
3. Check user is currently DISABLED
4. Reject if user is PENDING (use resend-invite instead)
5. Set user `status` to `ACTIVE`
6. Do NOT restore previous sessions
7. User must log in again
8. Log audit event:
   - `action` = `USER.REACTIVATE`
   - `actorUserId` = admin ID
   - `targetUserId` = user ID

**Request:**
```json
POST /api/admin/users/123/reactivate
```

**Response (200):**
```json
{
  "message": "User reactivated successfully. User must log in again.",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "fullName": "John Doe",
    "status": "ACTIVE"
  }
}
```

**Security Features:**
- ✅ Tenant isolation enforced
- ✅ Previous sessions NOT restored
- ✅ User must re-authenticate
- ✅ Transaction-safe
- ✅ Full audit trail

**Status:** ✅ Complete

---

### Step 5 — Audit Taxonomy Verification

**File:** `src/lib/audit-actions.ts`

**Added Actions:**
```typescript
export const USER_DEACTIVATE = "USER.DEACTIVATE"
export const USER_REACTIVATE = "USER.REACTIVATE"
```

**Updated Type:**
```typescript
export type AuditAction =
    | typeof USER_DEACTIVATE
    | typeof USER_REACTIVATE
    // ... other actions
```

**Status:** ✅ Complete

---

## Complete User Lifecycle Flows

### Flow 1: Deactivate User

```
1. Admin → POST /api/admin/users/123/deactivate
   {
     "reason": "Policy violation"
   }

2. System validates:
   - Admin has USER_UPDATE permission
   - User belongs to admin's tenant
   - User is not the admin themselves
   - User is not already DISABLED

3. System executes (transaction):
   - User.status = DISABLED
   - User.updatedAt = now
   - User.updatedBy = admin ID
   - RefreshToken.revokedAt = now (all active sessions)
   - AuditLog created (USER.DEACTIVATE)

4. User immediately loses access:
   - Existing sessions invalidated
   - Cannot login
   - Cannot access any endpoints
```

### Flow 2: Reactivate User

```
1. Admin → POST /api/admin/users/123/reactivate

2. System validates:
   - Admin has USER_UPDATE permission
   - User belongs to admin's tenant
   - User is currently DISABLED

3. System executes (transaction):
   - User.status = ACTIVE
   - User.updatedAt = now
   - User.updatedBy = admin ID
   - AuditLog created (USER.REACTIVATE)

4. User can now login:
   - Must authenticate with credentials
   - New session created
   - Previous sessions NOT restored
```

### Flow 3: Deactivated User Attempts Login

```
1. User → POST /api/auth/login
   {
     "email": "user@example.com",
     "password": "password123"
   }

2. System validates:
   - Email exists ✅
   - Password correct ✅
   - isActive = true ✅
   - isLocked = false ✅
   - status = ACTIVE ❌ (DISABLED)

3. System returns:
   {
     "error": "Account is not available"
   }
   Status: 401

4. User cannot access system
```

---

## Success Criteria

### Immediate Access Removal
- ✅ Deactivated users lose access immediately
- ✅ All sessions revoked on deactivation
- ✅ Login attempts blocked

### Re-authentication Required
- ✅ Reactivated users must log in again
- ✅ Previous sessions NOT restored
- ✅ New session created on login

### Audit Trail
- ✅ Full audit trail for deactivation
- ✅ Full audit trail for reactivation
- ✅ Actor and target tracked
- ✅ Reason captured (optional)

### Tenant Isolation
- ✅ No cross-tenant deactivation
- ✅ No cross-tenant reactivation
- ✅ Tenant boundary enforced

---

## API Reference

### POST /api/admin/users/[id]/deactivate
**Deactivate a user and revoke all sessions**

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Request Body (optional):**
```json
{
  "reason": "Policy violation"
}
```

**Success Response (200):**
```json
{
  "message": "User deactivated successfully",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "fullName": "John Doe",
    "status": "DISABLED"
  }
}
```

**Error Responses:**
- `400`: Invalid user ID, self-deactivation, already disabled
- `404`: User not found in tenant
- `500`: Internal server error

---

### POST /api/admin/users/[id]/reactivate
**Reactivate a disabled user**

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Success Response (200):**
```json
{
  "message": "User reactivated successfully. User must log in again.",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "fullName": "John Doe",
    "status": "ACTIVE"
  }
}
```

**Error Responses:**
- `400`: Invalid user ID, already active, user is pending
- `404`: User not found in tenant
- `500`: Internal server error

---

## Security Guarantees

### Tenant Isolation
- ✅ All operations scoped to admin's tenant
- ✅ Cross-tenant access prevented
- ✅ User lookup validates tenant ownership

### Session Management
- ✅ All sessions revoked on deactivation
- ✅ Sessions NOT restored on reactivation
- ✅ User must re-authenticate

### Audit Trail
- ✅ All deactivations logged
- ✅ All reactivations logged
- ✅ Actor tracked
- ✅ Reason captured
- ✅ IP address recorded

### Data Preservation
- ✅ User data NOT deleted
- ✅ Historical data preserved
- ✅ Audit logs maintained
- ✅ Role assignments preserved

---

## Testing Checklist

### Deactivation Tests
- [ ] Admin can deactivate user in same tenant
- [ ] Admin cannot deactivate user in different tenant
- [ ] Admin cannot deactivate themselves
- [ ] Cannot deactivate already disabled user
- [ ] All sessions revoked on deactivation
- [ ] Deactivated user cannot login
- [ ] Audit log created with USER.DEACTIVATE
- [ ] Reason captured in audit metadata

### Reactivation Tests
- [ ] Admin can reactivate disabled user
- [ ] Admin cannot reactivate user in different tenant
- [ ] Cannot reactivate already active user
- [ ] Cannot reactivate pending user (use resend-invite)
- [ ] Previous sessions NOT restored
- [ ] Reactivated user can login
- [ ] New session created on login
- [ ] Audit log created with USER.REACTIVATE

### Login Guard Tests
- [ ] ACTIVE user can login
- [ ] DISABLED user cannot login
- [ ] PENDING user cannot login
- [ ] Error message is generic (no status leakage)

### Tenant Isolation Tests
- [ ] Cross-tenant deactivation blocked
- [ ] Cross-tenant reactivation blocked
- [ ] User lookup validates tenant
- [ ] Audit logs scoped to tenant

---

## Out of Scope

The following are explicitly **NOT** included in Phase 7.2:

- ❌ User deletion
- ❌ Data anonymization
- ❌ Bulk deactivation
- ❌ UI changes
- ❌ Email notifications
- ❌ Scheduled deactivation
- ❌ Automatic reactivation
- ❌ Deactivation workflows
- ❌ Approval processes

---

## Database Impact

### User Table
**Modified Fields:**
- `status`: Updated to DISABLED or ACTIVE
- `updatedAt`: Set to current timestamp
- `updatedBy`: Set to admin userId

**Preserved Fields:**
- All other user data remains unchanged
- Historical data preserved
- Role assignments maintained

### RefreshToken Table
**Modified Fields (on deactivation):**
- `revokedAt`: Set to current timestamp
- `revokedByIp`: Set to admin's IP address

**Behavior:**
- All active sessions for user are revoked
- Revoked sessions cannot be used
- New sessions created on re-login

### AuditLog Table
**New Records:**
- Deactivation event (USER.DEACTIVATE)
- Reactivation event (USER.REACTIVATE)

**Metadata:**
- Actor userId
- Target userId
- Reason (optional)
- Previous status
- IP address

---

## Monitoring & Observability

### Metrics to Track
- Number of deactivations per day
- Number of reactivations per day
- Time between deactivation and reactivation
- Deactivation reasons (if provided)
- Failed deactivation attempts

### Audit Queries

**Find all deactivations:**
```sql
SELECT * FROM AuditLogs
WHERE action = 'USER.DEACTIVATE'
ORDER BY createdAt DESC
```

**Find all reactivations:**
```sql
SELECT * FROM AuditLogs
WHERE action = 'USER.REACTIVATE'
ORDER BY createdAt DESC
```

**Find users currently disabled:**
```sql
SELECT * FROM Users
WHERE status = 'DISABLED'
```

**Find deactivation/reactivation pairs:**
```sql
SELECT 
    d.targetUserId,
    d.createdAt as deactivatedAt,
    r.createdAt as reactivatedAt,
    DATEDIFF(hour, d.createdAt, r.createdAt) as hoursDisabled
FROM AuditLogs d
LEFT JOIN AuditLogs r ON d.targetUserId = r.targetUserId 
    AND r.action = 'USER.REACTIVATE'
    AND r.createdAt > d.createdAt
WHERE d.action = 'USER.DEACTIVATE'
```

---

## Rollback Plan

If issues arise after deployment:

1. **Identify affected users:**
   ```sql
   SELECT * FROM Users WHERE status = 'DISABLED' AND updatedAt > '<deployment-time>'
   ```

2. **Reactivate if needed:**
   ```
   POST /api/admin/users/{id}/reactivate
   ```

3. **Review audit logs:**
   ```sql
   SELECT * FROM AuditLogs 
   WHERE action IN ('USER.DEACTIVATE', 'USER.REACTIVATE')
   AND createdAt > '<deployment-time>'
   ```

4. **No code rollback needed** - endpoints are additive only

---

## Outcome

✅ **Controlled, auditable user deactivation and reactivation with immediate access removal**

### What Changed:
- Admins can deactivate users
- Deactivation revokes all sessions immediately
- Admins can reactivate users
- Reactivated users must re-authenticate
- Full audit trail of lifecycle changes

### What Stayed the Same:
- User data preservation
- Tenant isolation
- Authentication flows
- Session management
- Audit logging system

---

## Next Steps

1. **Deploy Endpoints:**
   - No migration required (uses existing schema from Phase 7.1)
   - Deploy deactivate and reactivate endpoints

2. **Build UI:**
   - Add deactivate button to user detail page
   - Add reactivate button for disabled users
   - Show user status badge
   - Display deactivation reason

3. **Add Notifications:**
   - Email user on deactivation
   - Email user on reactivation
   - Notify admins of status changes

4. **Monitor:**
   - Track deactivation/reactivation rates
   - Monitor for abuse patterns
   - Review audit logs regularly

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-29  
**Status:** Implementation Complete, Ready for Deployment  
**Dependencies:** Phase 7.1 (Invite-only Provisioning)
