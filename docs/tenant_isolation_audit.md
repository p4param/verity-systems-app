# Tenant Isolation Audit Report

## Categorized Risk List

### 🔴 HIGH / CRITICAL RISK (Immediate Data Leakage)

1.  **Admin User List (`GET /api/admin/users`)**
    *   **Risk**: **CRITICAL (Global Data Leak)**
    *   **Issue**: The Prisma query `prisma.user.findMany({...})` has **no `where` clause** filtering by `tenantId`.
    *   **Impact**: Any admin with `USER_VIEW` permission (regardless of their tenant) receives the entire database request return, including users from **all other tenants**.
    *   **Violation**: Explicit violation of multi-tenant architecture.

2.  **Admin Role List (`GET /api/admin/roles`)**
    *   **Risk**: **CRITICAL (Hardcoded Tenant)**
    *   **Issue**: The query uses `where: { tenantId: 1 }`.
    *   **Impact**:
        *   **Tenant 1**: Exposed to all other tenants if they have access to this endpoint.
        *   **Other Tenants**: Cannot see their own roles; they only see Tenant 1's roles.
    *   **Violation**: Hardcoded ID bypasses dynamic tenant context.

3.  **Authentication (`POST /api/auth/login`)**
    *   **Risk**: **HIGH (Ambiguous Identity)**
    *   **Issue**: `prisma.user.findFirst({ where: { email } })` is used without `tenantId`.
    *   **Impact**: Since `email` is only unique *per tenant* (composite key in schema), a user with the same email in multiple tenants will have their login resolved non-deterministically (likely the first created record).
    *   **Violation**: Users cannot select which tenant context to log into, potentially accessing the wrong tenant.

4.  **Forgot Password (`POST /api/auth/forgot-password`)**
    *   **Risk**: **HIGH (Ambiguous Target)**
    *   **Issue**: Uses `findFirst({ where: { email } })`.
    *   **Impact**: If an email exists in Tenant A and Tenant B, the system might send a reset token for Tenant A when the user intended to access Tenant B.

### 🟠 MEDIUM RISK (Logical/Context Gaps)

1.  **Session Management (`RefreshToken`)**
    *   **Issue**: `RefreshToken` queries usually rely on `tokenHash`. Since hashes are globally unique (crypto), cross-tenant collision is impossible. However, the lack of `tenantId` on the `RefreshToken` table means direct DB queries (for debugging/support) lack tenant context without a join. Is acceptable but harder to manage.

### 🟢 LOW RISK (Safe / Mitigated)

1.  **Audit Logs**
    *   **Status**: **Safe**. Schema includes `tenantId`. Routes creating logs (e.g., `audit.ts`) typically accept `tenantId` from the authenticated user context.
2.  **Background Cleanup**
    *   **Status**: **Safe**. Deleting expired tokens is a global maintenance task and does not leak data.

## High-Risk Query Patterns

*   `prisma.user.findMany()` **without** `where: { tenantId: ... }`.
*   `prisma.user.findFirst({ where: { email: ... } })` **without** `tenantId`.
*   Hardcoded IDs (e.g., `tenantId: 1`).

Waiting for next instruction.
