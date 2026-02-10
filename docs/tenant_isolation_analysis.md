# Tenant Isolation Test Analysis

## Tenant Isolation Guarantees

1.  **User-Scoped Alerts**
    *   **Mechanism**: The `SecurityAlert` entity is linked directly to a `User` via `userId`.
    *   **Guarantee**: Since the system enforces that a `User` belongs to a single `Tenant` (verified in `src/app/api/admin/users/[id]/mfa/reset/route.ts` where lookup is `where: { id: targetUserId, tenantId }`), any alert attached to that user is implicitly isolated to that tenant.
    *   **Result**: Users in Tenant B cannot see alerts for parameters or users in Tenant A because they cannot access the `User` records of Tenant A.

2.  **Action Isolation (Upstream Enforcement)**
    *   **Mechanism**: API endpoints targeting users (e.g., Admin Reset) strictly validate that the `targetUserId` belongs to the requestor's `tenantId` before performing the action.
    *   **Guarantee**: An Admin in Tenant A cannot trigger a `USER_MFA_RESET_BY_ADMIN` event for a user in Tenant B. Consequently, no audit log or alert for cross-tenant actions can be generated.

3.  **Anomaly Detection Isolation**
    *   **Mechanism**: The `checkLoginAnomaly` function queries previous logins using `actorUserId`.
    *   **Guarantee**: It asks "Has *this specific user* logged in from this IP?", not "Has *any user in this tenant* logged in from this IP?". This query is strictly scoped to the individual ID, ensuring no cross-user (and thus cross-tenant) metadata leakage.

## Potential Leakage Risks

1.  **Global IP Heuristics (Future Risk)**
    *   **Risk**: If the system evolves to use a "Global Bad IP List" or "Tenant-wide Trusted IP List" for anomaly detection.
    *   **Leakage Scenario**: If User A (Tenant A) logs in from IP X, and the system marks IP X as "safe for Tenant B", that confirms User A's location to Tenant B admins.
    *   **Current Status**: **Safe**. Current implementation only checks personal history.

2.  **Shared Infrastructure Logs**
    *   **Risk**: If internal server errors or panic logs (printed to stdout/files) contain alert details including `tenantId` and `userId` side-by-side, and these logs are accessible to super-admins or via a shared dashboard without row-level security.
    *   **Current Status**: **Operational Risk**. Requires secure logging infrastructure, not a code logic flaw.

3.  **Notification Dispatches (Email/SMS)**
    *   **Risk**: If the notification worker processes alerts in batches and fails to reset context between jobs.
    *   **Leakage Scenario**: Sending Tenant A's alert content to Tenant B's configured notification webhook.
    *   **Current Status**: **Out of Scope** (Notification dispatch logic not visible/analyzed here), but a common regression point.

Waiting for next instruction.
