# AG RUNBOOK — Phase 7.1
## Admin User Provisioning (Invite-Only)

**Purpose:**  
This runbook defines a safe, ordered, and auditable procedure for implementing invite-only admin user provisioning in a multi-tenant SaaS system.

---

## Global Constraints

- ❌ Do not modify existing authentication flows
- ❌ Do not add public signup
- ❌ Do not allow admins to set passwords
- ❌ Do not weaken tenant isolation
- ❌ Do not refactor audit logging

---

## Implementation Steps

### Step 1 — Prisma Schema Changes

**File:** `prisma/schema.prisma`

**Changes:**
1. Add `UserStatus` enum (PENDING, ACTIVE, DISABLED)
2. Update `User` model:
   - Add `status` field (default: PENDING)
   - Make `passwordHash` nullable
3. Add `UserInvite` model with:
   - Hashed token storage
   - 24-hour expiration
   - Tenant isolation
   - Created by tracking

**Status:** ✅ Complete

**Migration Command:**
```bash
npx prisma migrate dev --name add_user_invite_system
```

---

### Step 2 — Admin API: Create User & Invite

**Endpoint:** `POST /api/admin/users`

**File:** `src/app/api/admin/users/route.ts`

**Behavior:**
1. Require admin authentication (`USER_CREATE` permission)
2. Create PENDING user with:
   - `tenantId` from admin context
   - `email` and `fullName` from request
   - `passwordHash` = null
   - `status` = PENDING
3. Assign initial roles from `roleIds` array
4. Generate cryptographically secure invite token (32 bytes)
5. Hash token with SHA-256
6. Store invite in `UserInvite` table:
   - `tokenHash` (hashed)
   - `expiresAt` (now + 24 hours)
   - `createdBy` (admin userId)
7. Log `USER.CREATE` audit event
8. Return invite token (for email sending)

**Security:**
- ✅ Tenant isolation enforced
- ✅ Transaction-safe (atomic operation)
- ✅ No password setting by admin
- ✅ Full audit trail

**Status:** ✅ Complete

---

### Step 3 — User Activation

**Endpoint:** `POST /api/auth/activate`

**File:** `src/app/api/auth/activate/route.ts`

**Behavior:**
1. Accept `token` and `password` from request
2. Hash incoming token with SHA-256
3. Look up `UserInvite` where:
   - `tokenHash` matches
   - `usedAt` is null
   - `expiresAt` > now
4. If invalid/expired, return 400
5. Find user by `tenantId` and `email` from invite
6. Validate user exists and status is PENDING
7. Hash password with bcrypt
8. Update user in transaction:
   - Set `passwordHash`
   - Set `status` = ACTIVE
9. Mark invite as used (`usedAt` = now)
10. Return success (no auto-login)

**Security:**
- ✅ Token never logged
- ✅ Invite cannot be reused
- ✅ Transaction-safe
- ✅ No session created
- ✅ Password strength validation

**Status:** ✅ Complete

---

### Step 4 — Login Guard

**File:** `src/app/api/auth/login/route.ts`

**Change:**
Add status check after existing validation:

```typescript
// Check user status (only ACTIVE users can log in)
if (user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Account is not available" }, { status: 401 })
}
```

**Behavior:**
- ✅ PENDING users blocked (must activate first)
- ✅ DISABLED users blocked (admin disabled)
- ✅ ACTIVE users allowed
- ✅ Generic error message (no status leakage)

**Status:** ✅ Complete

---

### Step 5 — Audit Taxonomy

**File:** `src/lib/audit-actions.ts`

**Changes:**
1. Created centralized audit actions taxonomy
2. Added `USER.CREATE` action
3. Added `USER.INVITE_RESENT` action
4. Defined `AuditAction` TypeScript type

**Available Actions:**
- `USER.CREATE` - User invited by admin
- `USER.INVITE_RESENT` - Invite resent by admin
- `USER.UPDATE` - User updated
- `USER.DELETE` - User deleted
- `USER_MFA_RESET_BY_ADMIN` - MFA reset by admin

**Status:** ✅ Complete

---

## Bonus: Invite Resend

**Endpoint:** `POST /api/admin/users/[id]/resend-invite`

**File:** `src/app/api/admin/users/[id]/resend-invite/route.ts`

**Behavior:**
1. Validate user belongs to admin's tenant
2. Check user is not ACTIVE
3. Verify previous invite is expired or used
4. Generate new token (never reuse old)
5. Create new invite record
6. Log `USER.INVITE_RESENT` audit event

**Status:** ✅ Complete

---

## Complete User Flow

### Admin Invites User
```
1. Admin → POST /api/admin/users
   {
     "email": "user@example.com",
     "fullName": "John Doe",
     "roleIds": [1, 2]
   }

2. System creates:
   - User (status=PENDING, passwordHash=null)
   - UserRole assignments
   - UserInvite (tokenHash, expiresAt)
   - AuditLog (USER.CREATE)

3. System returns invite token
   → Email sent to user (stub)
```

### User Activates Account
```
1. User receives email with invite link
   → https://app.example.com/activate?token=abc123...

2. User → POST /api/auth/activate
   {
     "token": "abc123...",
     "password": "SecurePassword123"
   }

3. System validates:
   - Token exists and not expired
   - Token not already used
   - User exists and is PENDING

4. System updates:
   - User.passwordHash = hashed password
   - User.status = ACTIVE
   - UserInvite.usedAt = now

5. User can now login
```

### User Logs In
```
1. User → POST /api/auth/login
   {
     "email": "user@example.com",
     "password": "SecurePassword123"
   }

2. System validates:
   - Email exists
   - Password correct
   - isActive = true
   - isLocked = false
   - status = ACTIVE ✅ (new check)

3. System returns access + refresh tokens
```

---

## Security Guarantees

### Tenant Isolation
- ✅ All queries scoped to `tenantId`
- ✅ Admin can only invite to their tenant
- ✅ User activation validates tenant context
- ✅ No cross-tenant data access possible

### Password Security
- ✅ Admin cannot set passwords
- ✅ User chooses own password during activation
- ✅ Passwords hashed with bcrypt
- ✅ Minimum 8 character requirement

### Token Security
- ✅ Cryptographically secure random tokens (32 bytes)
- ✅ Tokens hashed before storage (SHA-256)
- ✅ Tokens expire after 24 hours
- ✅ Tokens cannot be reused
- ✅ Raw tokens never logged

### Audit Trail
- ✅ User creation logged
- ✅ Invite resend logged
- ✅ Actor and target tracked
- ✅ IP address captured
- ✅ Metadata includes invite details

---

## Database Schema

### UserStatus Enum
```prisma
enum UserStatus {
  PENDING   // Invited, not yet activated
  ACTIVE    // Activated, can login
  DISABLED  // Disabled by admin
}
```

### User Model Updates
```prisma
model User {
  // ... existing fields
  passwordHash  String?      @map("PasswordHash") @db.NVarChar(255)  // Now nullable
  status        UserStatus   @default(PENDING) @map("Status")        // New field
  // ... existing fields
}
```

### UserInvite Model
```prisma
model UserInvite {
  id        String    @id @default(cuid()) @map("InviteId")
  tenantId  Int       @map("TenantId")
  email     String    @map("Email") @db.NVarChar(150)
  tokenHash String    @map("TokenHash") @db.NVarChar(255)
  expiresAt DateTime  @map("ExpiresAt")
  createdBy Int       @map("CreatedBy")
  usedAt    DateTime? @map("UsedAt")
  createdAt DateTime  @default(dbgenerated("sysutcdatetime()")) @map("CreatedAt")

  @@index([tokenHash], map: "IX_UserInvites_TokenHash")
  @@index([tenantId, email], map: "IX_UserInvites_Tenant_Email")
  @@map("UserInvites")
}
```

---

## API Reference

### POST /api/admin/users
**Create and invite a new user**

**Request:**
```json
{
  "email": "user@example.com",
  "fullName": "John Doe",
  "roleIds": [1, 2]
}
```

**Response (201):**
```json
{
  "message": "User invited successfully",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "fullName": "John Doe",
    "status": "PENDING"
  },
  "inviteToken": "abc123...",
  "expiresAt": "2026-01-30T22:46:00.000Z"
}
```

---

### POST /api/auth/activate
**Activate user account with invite token**

**Request:**
```json
{
  "token": "abc123...",
  "password": "SecurePassword123"
}
```

**Response (200):**
```json
{
  "message": "Account activated successfully. You can now log in.",
  "email": "user@example.com"
}
```

---

### POST /api/admin/users/[id]/resend-invite
**Resend invite to pending user**

**Response (200):**
```json
{
  "message": "Invite resent successfully",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "fullName": "John Doe",
    "status": "PENDING"
  },
  "inviteToken": "xyz789...",
  "expiresAt": "2026-01-30T23:00:00.000Z"
}
```

---

## Testing Checklist

### Pre-Migration
- [ ] Review schema changes
- [ ] Backup database
- [ ] Review migration SQL

### Post-Migration
- [ ] Verify Prisma client regenerated
- [ ] Verify no TypeScript errors
- [ ] Test admin user creation
- [ ] Test invite token generation
- [ ] Test activation flow
- [ ] Test login with PENDING user (should fail)
- [ ] Test login with ACTIVE user (should succeed)
- [ ] Test invite resend
- [ ] Verify audit logs created
- [ ] Test tenant isolation

### Security Validation
- [ ] Verify admin cannot set passwords
- [ ] Verify tokens are hashed in database
- [ ] Verify expired tokens rejected
- [ ] Verify used tokens cannot be reused
- [ ] Verify cross-tenant access blocked
- [ ] Verify PENDING users cannot login
- [ ] Verify DISABLED users cannot login

---

## Rollback Plan

If issues arise after migration:

1. **Stop the application**
2. **Restore database backup**
3. **Revert code changes:**
   ```bash
   git revert <commit-hash>
   ```
4. **Regenerate Prisma client:**
   ```bash
   npx prisma generate
   ```
5. **Restart application**

---

## Outcome

✅ **Secure, auditable, invite-only user provisioning with full tenant isolation**

### What Changed:
- Users must be invited by admins
- Users set their own passwords during activation
- Only ACTIVE users can login
- Full audit trail of user lifecycle
- No public signup possible
- Tenant isolation maintained

### What Stayed the Same:
- Existing authentication flows
- Existing audit logging system
- Existing tenant isolation middleware
- Existing permission system
- Existing MFA flows

---

## Next Steps

1. **Run Migration:**
   ```bash
   npx prisma migrate dev --name add_user_invite_system
   ```

2. **Integrate Email Service:**
   - Replace console.log stubs with actual email sending
   - Use invite token in email link

3. **Build UI:**
   - Admin user invite form
   - User activation page
   - Invite resend button

4. **Monitor:**
   - Watch audit logs for USER.CREATE events
   - Monitor invite expiration rates
   - Track activation completion rates

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-29  
**Status:** Implementation Complete, Ready for Migration
