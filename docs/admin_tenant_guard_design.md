# Design: Local Admin Tenant Guard

## Goal
Prevent accidental tenant omission in admin queries by enforcing a strict "Tenant Context" object retrieval at the start of every admin route handler.

## 1. Guard Helper: `requireTenantContext`
A new helper function located in `@/lib/auth/context-guard.ts` (or similar).

### Behavior
1.  **Wraps `requirePermission`**: Performs the standard auth & RBAC check.
2.  **Validates Tenant Integrity**: Explicitly checks that `user.tenantId` matches the authenticated session and is not null/undefined.
3.  **Returns Scoped Context**: Returns an object containing a pre-built Prisma `where` clause fragment (the "Scope") and the raw user.

### Signature
```typescript
export async function requireTenantContext(req: Request, permission: string) {
    const user = await requirePermission(req, permission);

    if (!user.tenantId) {
        // Critical Logic Failure - Fail Fast
        console.error(`[CRITICAL] User ${user.id} has valid token but missing tenantId`);
        throw new Error("Tenant context lost");
    }

    return {
        // The Scoped Context
        tenantId: user.tenantId,        // Raw ID
        tenantScope: { tenantId: user.tenantId }, // Prisma Fragment
        user: user                      // Full user object
    };
}
```

## 2. Application Logic
**Replaces** direct calls to `requirePermission` in `src/app/api/admin/*`.

### Usage Pattern
```typescript
// BEFORE (Vulnerable to forgetting tenantId)
const user = await requirePermission(req, "USER_VIEW");
prisma.user.findMany({ where: { something: true } }); // OOPS: Leaks all tenants

// AFTER (Encourages usage)
const { tenantScope } = await requireTenantContext(req, "USER_VIEW");
prisma.user.findMany({
    where: {
        ...tenantScope, // Spreads { tenantId: 123 }
        something: true
    }
});
```

*Note: While it doesn't strictly prevent a developer from ignoring `tenantScope`, it makes the intent explicit and provides the safety tool by default.*

## 3. Failure Behavior
*   **Missing Tenant ID**: Throws `500 Internal Server Error` (Fail Safe).
*   **Permission Denied**: Throws `403 Forbidden` (Standard).
*   **Unauthenticated**: Throws `401 Unauthorized` (Standard).

Waiting for next instruction.
