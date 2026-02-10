# Implementation Plan: Fix Tenant Isolation Leaks

## Goal
Fix critical data leakage in Admin APIs where data is not correctly scoped to the tenant.

## Proposed Changes

### 1. Fix `GET /api/admin/users` (Global Data Leak)
*   **Current**: `prisma.user.findMany({})` returns all users.
*   **Fix**: Capture `user` from `requirePermission`. Use `user.tenantId` in `where` clause.
    ```typescript
    const currentUser = await requirePermission(req, "USER_VIEW");
    const users = await prisma.user.findMany({
        where: { tenantId: currentUser.tenantId },
        // ...
    });
    ```

### 2. Fix `GET /api/admin/roles` (Hardcoded Tenant)
*   **Current**: `where: { tenantId: 1 }`.
*   **Fix**: Capture `user` from `requirePermission`. Use `user.tenantId`.
    ```typescript
    const currentUser = await requirePermission(req, "ROLE_VIEW");
    const roles = await prisma.role.findMany({
        where: { tenantId: currentUser.tenantId },
        // ...
    });
    ```

## Verification
*   Manual code review to ensure `tenantId` is passed correctly from the authenticated context.
