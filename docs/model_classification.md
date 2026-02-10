# Prisma Model Classification: Tenant Ownership

## Classification Summary

| Model | Classification | Has tenantId Field? | Enforcement Strategy | Justification |
|-------|---------------|---------------------|---------------------|---------------|
| **User** | Tenant-Owned | ✅ Yes | Direct tenantId filter | Users belong to specific tenants |
| **Role** | Tenant-Owned | ✅ Yes | Direct tenantId filter | Roles are tenant-specific |
| **UserRole** | Tenant-Owned (Indirect) | ❌ No | Relation filter via User/Role | Junction table between tenant-owned models |
| **Permission** | Global/System | ❌ No | No enforcement | System-wide permission definitions |
| **RolePermission** | Tenant-Owned (Indirect) | ❌ No | Relation filter via Role | Links tenant roles to global permissions |
| **RefreshToken** | Tenant-Owned (Indirect) | ❌ No | Relation filter via User | Sessions belong to tenant users |
| **PasswordResetToken** | Tenant-Owned (Indirect) | ❌ No | Relation filter via User | Password resets for tenant users |
| **MfaBackupCode** | Tenant-Owned (Indirect) | ❌ No | Relation filter via User | MFA codes belong to tenant users |
| **SecurityAlert** | Tenant-Owned (Indirect) | ❌ No | Relation filter via User | Alerts belong to tenant users |
| **AuditLog** | Tenant-Owned | ✅ Yes | Direct tenantId filter | Audit logs are tenant-specific |
| **Tenant** | Global/System | N/A | No enforcement | Tenant registry itself |
| **PasswordResetRequest** | Global/System | ❌ No | No enforcement | Rate-limiting, no user association |

---

## Detailed Classification

### 🔒 TENANT-OWNED MODELS (Direct tenantId)

#### 1. User
**Schema Field**: `tenantId Int @map("TenantId")`

**Classification**: Tenant-Owned (Direct)

**Enforcement**: REQUIRED - Direct `tenantId` filter

**Justification**:
- Users are the core tenant-scoped entity
- Each user belongs to exactly one tenant
- Schema has unique constraint: `@@unique([tenantId, email])`
- Cross-tenant user access would be a critical security violation

**Query Pattern**:
```typescript
// ✅ REQUIRED
prisma.user.findMany({ where: { tenantId: 1 } })

// ❌ FORBIDDEN
prisma.user.findMany({ where: { email: "user@example.com" } })
```

**Risk if Unenforced**: **CRITICAL** - Cross-tenant data leak, PII exposure

---

#### 2. Role
**Schema Field**: `tenantId Int @map("TenantId")`

**Classification**: Tenant-Owned (Direct)

**Enforcement**: REQUIRED - Direct `tenantId` filter

**Justification**:
- Roles are tenant-specific (e.g., "Manager" in Tenant A ≠ "Manager" in Tenant B)
- Schema has unique constraint: `@@unique([tenantId, name])`
- Different tenants may have different role hierarchies
- System roles (`isSystem: true`) still belong to a tenant

**Query Pattern**:
```typescript
// ✅ REQUIRED
prisma.role.findMany({ where: { tenantId: 1 } })

// ❌ FORBIDDEN
prisma.role.findFirst({ where: { name: "Admin" } })
```

**Risk if Unenforced**: **HIGH** - Authorization bypass, privilege escalation

---

#### 3. AuditLog
**Schema Field**: `tenantId Int @map("TenantId")`

**Classification**: Tenant-Owned (Direct)

**Enforcement**: REQUIRED - Direct `tenantId` filter

**Justification**:
- Audit logs track tenant-specific actions
- Compliance requirement: tenants must not see each other's audit trails
- Schema has index: `@@index([tenantId])`
- Contains sensitive tenant business activity

**Query Pattern**:
```typescript
// ✅ REQUIRED
prisma.auditLog.findMany({ where: { tenantId: 1 } })

// ❌ FORBIDDEN
prisma.auditLog.findMany({ where: { action: "USER_LOGIN" } })
```

**Risk if Unenforced**: **CRITICAL** - Compliance violation, audit trail contamination

---

### 🔗 TENANT-OWNED MODELS (Indirect via Relations)

#### 4. UserRole
**Schema Field**: None (junction table)

**Classification**: Tenant-Owned (Indirect)

**Enforcement**: REQUIRED - Relation filter via `user.tenantId` OR `role.tenantId`

**Justification**:
- Links `User` (tenant-owned) to `Role` (tenant-owned)
- Both parent models are tenant-scoped
- No direct `tenantId` field, but inherits tenant context from parents
- Cross-tenant role assignments would be a security violation

**Query Pattern**:
```typescript
// ✅ ALLOWED
prisma.userRole.findMany({ 
  where: { user: { tenantId: 1 } } 
})

prisma.userRole.findMany({ 
  where: { role: { tenantId: 1 } } 
})

// ❌ FORBIDDEN
prisma.userRole.findMany({ where: { roleId: 5 } })
```

**Risk if Unenforced**: **HIGH** - Cross-tenant role assignment, authorization bypass

---

#### 5. RolePermission
**Schema Field**: None (junction table)

**Classification**: Tenant-Owned (Indirect)

**Enforcement**: REQUIRED - Relation filter via `role.tenantId`

**Justification**:
- Links `Role` (tenant-owned) to `Permission` (global)
- While permissions are global, their assignment to roles is tenant-specific
- Different tenants may assign different permissions to same-named roles

**Query Pattern**:
```typescript
// ✅ ALLOWED
prisma.rolePermission.findMany({ 
  where: { role: { tenantId: 1 } } 
})

// ❌ FORBIDDEN
prisma.rolePermission.findMany({ where: { permissionId: 3 } })
```

**Risk if Unenforced**: **MEDIUM** - Permission configuration leak (not data leak)

---

#### 6. RefreshToken (Sessions)
**Schema Field**: None (owned by User)

**Classification**: Tenant-Owned (Indirect)

**Enforcement**: REQUIRED - Relation filter via `user.tenantId`

**Justification**:
- Refresh tokens belong to users (tenant-owned)
- Session hijacking across tenants would be critical
- Contains session metadata (IP, device) specific to tenant user

**Query Pattern**:
```typescript
// ✅ ALLOWED
prisma.refreshToken.findFirst({ 
  where: { 
    tokenHash: "abc123",
    user: { tenantId: 1 }
  } 
})

// ❌ FORBIDDEN
prisma.refreshToken.findMany({ where: { tokenHash: "abc123" } })
```

**Risk if Unenforced**: **CRITICAL** - Session hijacking, authentication bypass

---

#### 7. PasswordResetToken
**Schema Field**: None (owned by User)

**Classification**: Tenant-Owned (Indirect)

**Enforcement**: REQUIRED - Relation filter via `user.tenantId`

**Justification**:
- Password reset tokens belong to users (tenant-owned)
- Cross-tenant password reset would be critical security issue
- Token validation must respect tenant boundaries

**Query Pattern**:
```typescript
// ✅ ALLOWED
prisma.passwordResetToken.findFirst({ 
  where: { 
    tokenHash: "xyz789",
    user: { tenantId: 1 }
  } 
})

// ❌ FORBIDDEN
prisma.passwordResetToken.findFirst({ where: { tokenHash: "xyz789" } })
```

**Risk if Unenforced**: **CRITICAL** - Account takeover across tenants

---

#### 8. MfaBackupCode
**Schema Field**: None (owned by User)

**Classification**: Tenant-Owned (Indirect)

**Enforcement**: REQUIRED - Relation filter via `user.tenantId`

**Justification**:
- MFA backup codes belong to users (tenant-owned)
- Cross-tenant MFA bypass would be critical
- Backup codes are sensitive authentication credentials

**Query Pattern**:
```typescript
// ✅ ALLOWED
prisma.mfaBackupCode.findMany({ 
  where: { 
    user: { tenantId: 1 },
    used: false
  } 
})

// ❌ FORBIDDEN
prisma.mfaBackupCode.findMany({ where: { userId: 5 } })
```

**Risk if Unenforced**: **CRITICAL** - MFA bypass, authentication compromise

---

#### 9. SecurityAlert
**Schema Field**: None (owned by User)

**Classification**: Tenant-Owned (Indirect)

**Enforcement**: REQUIRED - Relation filter via `user.tenantId`

**Justification**:
- Security alerts belong to users (tenant-owned)
- Alerts contain sensitive security events (device, location, IP)
- Cross-tenant alert access would leak security posture

**Query Pattern**:
```typescript
// ✅ ALLOWED
prisma.securityAlert.findMany({ 
  where: { 
    user: { tenantId: 1 },
    isRead: false
  } 
})

// ❌ FORBIDDEN
prisma.securityAlert.findMany({ where: { severity: "CRITICAL" } })
```

**Risk if Unenforced**: **HIGH** - Security event leak, privacy violation

---

### 🌐 GLOBAL/SYSTEM MODELS (No Tenant Enforcement)

#### 10. Tenant
**Schema Field**: N/A (is the tenant registry)

**Classification**: Global/System

**Enforcement**: NONE - No tenant filter required

**Justification**:
- The tenant registry itself
- Used for tenant lookup during authentication
- No concept of "tenant-owned tenant" (self-referential)
- Access control handled at application layer, not data layer

**Query Pattern**:
```typescript
// ✅ ALLOWED
prisma.tenant.findUnique({ where: { id: 1 } })
prisma.tenant.findMany({ where: { isActive: true } })
```

**Risk if Unenforced**: **NONE** - Tenant list is not sensitive (codes are public identifiers)

**Note**: Application-layer access control still applies (e.g., only admins can list all tenants)

---

#### 11. Permission
**Schema Field**: None (global definitions)

**Classification**: Global/System

**Enforcement**: NONE - No tenant filter required

**Justification**:
- Permissions are system-wide definitions (e.g., "USER_READ", "ROLE_WRITE")
- Same permission codes apply across all tenants
- Tenant-specific permission *assignment* is handled via `RolePermission` (tenant-owned)
- Permissions are not sensitive data (just capability definitions)

**Query Pattern**:
```typescript
// ✅ ALLOWED
prisma.permission.findMany()
prisma.permission.findUnique({ where: { code: "USER_READ" } })
```

**Risk if Unenforced**: **NONE** - Permission definitions are not tenant-specific

**Note**: Permission *assignment* to roles is tenant-scoped via `RolePermission`

---

#### 12. PasswordResetRequest
**Schema Field**: None (rate-limiting only)

**Classification**: Global/System

**Enforcement**: NONE - No tenant filter required

**Justification**:
- Used for rate-limiting password reset requests by email/IP
- No link to `User` model (pre-authentication)
- Contains only email + IP + timestamp (no sensitive data)
- Tenant context not available at password reset request time

**Query Pattern**:
```typescript
// ✅ ALLOWED
prisma.passwordResetRequest.findMany({ 
  where: { 
    email: "user@example.com",
    requestedAt: { gte: oneHourAgo }
  } 
})
```

**Risk if Unenforced**: **NONE** - No tenant-specific data

**Note**: Actual password reset tokens (`PasswordResetToken`) ARE tenant-scoped

---

## Summary Tables

### Tenant Enforcement Required (9 models)

| Model | Enforcement Type | Filter Required |
|-------|-----------------|-----------------|
| User | Direct | `tenantId: X` |
| Role | Direct | `tenantId: X` |
| AuditLog | Direct | `tenantId: X` |
| UserRole | Indirect | `user: { tenantId: X }` OR `role: { tenantId: X }` |
| RolePermission | Indirect | `role: { tenantId: X }` |
| RefreshToken | Indirect | `user: { tenantId: X }` |
| PasswordResetToken | Indirect | `user: { tenantId: X }` |
| MfaBackupCode | Indirect | `user: { tenantId: X }` |
| SecurityAlert | Indirect | `user: { tenantId: X }` |

### No Enforcement Required (3 models)

| Model | Reason |
|-------|--------|
| Tenant | Tenant registry itself |
| Permission | Global permission definitions |
| PasswordResetRequest | Rate-limiting, no user link |

---

## Risk Matrix

| Model | Risk Level if Unenforced | Impact Type |
|-------|-------------------------|-------------|
| User | 🔴 CRITICAL | PII leak, cross-tenant data access |
| Role | 🟠 HIGH | Authorization bypass, privilege escalation |
| AuditLog | 🔴 CRITICAL | Compliance violation, audit contamination |
| UserRole | 🟠 HIGH | Cross-tenant role assignment |
| RolePermission | 🟡 MEDIUM | Permission config leak (not data) |
| RefreshToken | 🔴 CRITICAL | Session hijacking, auth bypass |
| PasswordResetToken | 🔴 CRITICAL | Account takeover |
| MfaBackupCode | 🔴 CRITICAL | MFA bypass, auth compromise |
| SecurityAlert | 🟠 HIGH | Security event leak, privacy violation |
| Tenant | 🟢 NONE | Public tenant registry |
| Permission | 🟢 NONE | Global definitions |
| PasswordResetRequest | 🟢 NONE | No sensitive data |

---

## Enforcement Priority

### Phase 1: CRITICAL (Immediate)
1. User
2. RefreshToken
3. PasswordResetToken
4. MfaBackupCode
5. AuditLog

**Justification**: Authentication, authorization, and compliance

### Phase 2: HIGH (Next)
6. Role
7. UserRole
8. SecurityAlert

**Justification**: Authorization and security monitoring

### Phase 3: MEDIUM (Final)
9. RolePermission

**Justification**: Configuration leak (lower impact)

---

## Edge Cases & Ambiguities

### ⚠️ AMBIGUITY DETECTED: System Roles

**Question**: Should system roles (`isSystem: true`) be exempt from tenant enforcement?

**Current Schema**: System roles still have `tenantId` field

**Analysis**:
- System roles are created per-tenant (e.g., each tenant gets "Admin" role)
- System roles are NOT shared across tenants
- `isSystem` flag only means "cannot be deleted", not "global"

**Decision**: ✅ System roles REQUIRE tenant enforcement (same as regular roles)

**Justification**: Schema has `@@unique([tenantId, name])`, proving roles are tenant-scoped even when `isSystem: true`

---

### ⚠️ AMBIGUITY DETECTED: Cross-Tenant Admin Access

**Question**: Should super-admins be able to query across tenants?

**Analysis**:
- This is an **application-layer** concern, not data-layer
- Middleware enforces data-layer isolation
- Super-admin access should use explicit bypass mechanism

**Decision**: ✅ Use bypass flag for cross-tenant admin queries

**Pattern**:
```typescript
// Super-admin viewing all users across tenants
await prisma.user.findMany({
  ctx: { 
    _bypassTenantCheck: true,
    _bypassReason: "Super-admin: tenant management",
    _bypassAuthorizedBy: currentUser.id
  }
})
```

---

## Validation Checklist

- [x] All models classified (12 total)
- [x] Justification provided for each
- [x] Risk assessment completed
- [x] Edge cases identified and resolved
- [x] No ambiguities remaining
- [x] Enforcement priority defined
- [x] Query patterns documented

---

## Waiting for next instruction.
