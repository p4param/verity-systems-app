# Migration Plan: Tenant-Ambiguous User Resolution

## Problem Statement
The new authentication security enforcement blocks login for any email address that exists in multiple tenants. A migration plan is required to resolve these "Duplicate Identity" conflicts for existing users without data loss or forced logouts.

## 1. Compliance Audit (Discovery Phase)

**Action**: Run a diagnostic script to identify the scope of the conflict.

```sql
-- Conceptual Logic
SELECT Email, COUNT(DISTINCT TenantId) as TenantCount
FROM Users
GROUP BY Email
HAVING COUNT(DISTINCT TenantId) > 1;
```

**Output**: A list of `Critical Accounts` that are currently effectively locked out of the new login flow.

## 2. Session Continuity Strategy
**Policy**: "Do No Harm to Active Sessions"

*   **Mechanism**: Existing sessions operate on `UserId` via `RefreshTokens`, not Email.
*   **Result**: Users with duplicate emails who are *currently logged in* will **stay logged in**. They will observe no disruption until their session expires or they attempt to forgot-password/re-login.
*   **Action**: No action required. The system design naturally supports this (verified in `refresh/route.ts`).

## 3. Resolution Strategies

Since automated resolution implies guessing which account is "primary", which violates the "No silent reassignment" constraint, we must rely on **Deterministic Resolution**.

### Strategy A: Admin-Led Email Aliasing (Recommended)
We resolve the ambiguity by making the emails unique.

1.  **Identify**: Find duplicates.
2.  **Analyze**: Determine which account is "Primary" (e.g., most recent login, most data).
3.  **Action**: Rename the *Secondary* account's email to a tenant-scoped alias.
    *   *From*: `bob@company.com` (Tenant B)
    *   *To*: `bob+tenantB@company.com` (Tenant B)
    *   *Note*: Standard email alias syntax (`+tag`) allows email delivery to continue working (usually) while making the string unique in our DB.
4.  **Notify**: Send email to `bob@company.com` informing them of the updated login username for Tenant B context.

### Strategy B: "Ghost" Account Deactivation
If inspection reveals the duplicates are unused/zombie accounts (created by accident):

1.  **Action**: Soft-delete (`IsActive = false`) the unused duplicates.
2.  **Result**: The new Login Flow (`.findMany({ where: { isActive: true }})`) will potentially see only one active user, auto-resolving to the valid account.
3.  **Risk**: Low. Can be undone.

## 4. Execution Roadmap

1.  **Phase 1 (Audit)**:
    *   Deploy script to count and list duplicates.
    *   Do not modify data.

2.  **Phase 2 (Cleanup)**:
    *   Bulk deactivate accounts with `LastLoginAt IS NULL` and `CreatedAt < 30_DAYS_AGO` if they cause a conflict.

3.  **Phase 3 (Manual Resolution)**:
    *   Generate a report for Support/Admins to manually rename or merge remnants.

4.  **Phase 4 (Legacy Fallback - Optional)**:
    *   *Only if conflicts are massive (>5% of userbase)*.
    *   Temporarily re-enable a "Tenant Selector" UI for specifically flagged email addresses, allowing them to explicitly choose their tenant until migrated. (Out of scope for current codebase, but listed as safety valve).

## 5. Rollback Plan
Since no code changes or mass-deletes are automated in this plan, "Rollback" constitutes reverting the Alias/Deactivation changes manually via Admin API.
