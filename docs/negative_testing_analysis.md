# Negative Testing Analysis

## Negative Test Scenarios

### 1. Token Refresh (Rotation)
*   **Scenario**: User's access token expires, client calls `/api/auth/refresh` with a valid refresh token.
*   **Expected Behavior**: Old refresh token is revoked, new one issued.
*   **Alert Status**: 🟢 **NO ALERT** (Correct).
*   **Reasoning**:
    *   The refresh route (`src/app/api/auth/refresh/route.ts`) updates the DB but does **not** call `createAuditLog`.
    *   Even if it did log a generic event, `AlertService` does not listen for "REFRESH_SUCCESS".
    *   The `SESSION_REVOKED` alert is only triggered by explicit admin/user revocation, not by the internal rotation mechanism (which marks `revokedAt` but doesn't emit the `SESSION_REVOKED` audit action).

### 2. Access Token Expiry
*   **Scenario**: User tries to access a protected route with an expired JWT.
*   **Expected Behavior**: API returns 401 Unauthorized.
*   **Alert Status**: 🟢 **NO ALERT** (Correct).
*   **Reasoning**:
    *   Expiry is a passive state check in `src/lib/auth/auth-guard.ts`.
    *   No write operation occurs, no audit log is created.
    *   Alerts are event-driven, not state-driven.

### 3. Same-Device / Known-IP Login
*   **Scenario**: User logs in again from an IP address they have used before.
*   **Expected Behavior**: Login successful.
*   **Alert Status**: 🟢 **NO ALERT** (Correct Logic, despite broken trigger).
*   **Reasoning**:
    *   `AlertService.checkLoginAnomaly` (Lines 99-132) queries `AuditLog` to see if `userId` has successfully logged in from `ipAddress` before.
    *   If `previousLoginFromIp` exists, it returns `null`.
    *   Therefore, familiar locations do not trigger `AUTH_LOGIN_NEW_LOCATION`.

### 4. Read-Only Admin Actions
*   **Scenario**: Admin views the user list or a specific user profile (`GET /api/admin/users`).
*   **Expected Behavior**: Data returned.
*   **Alert Status**: 🟢 **NO ALERT** (Correct).
*   **Reasoning**:
    *   Standard GET requests do not generate `AuditLog` entries for performance reasons (checked `src/lib/audit.ts`, only explicit calls create logs).
    *   `AlertService` only evaluates created audit logs.
    *   Viewing data is not categorized as a security-critical event requiring user notification.

### 5. Background Cleanup Jobs
*   **Scenario**: Cron job runs `/api/internal/cleanup/reset-tokens` to delete expired tokens.
*   **Expected Behavior**: Expired/revoked tokens are hard-deleted from DB.
*   **Alert Status**: 🟢 **NO ALERT** (Correct).
*   **Reasoning**:
    *   `src/lib/auth/cleanup-auth-tokens.ts` uses `prisma.refreshToken.deleteMany()`.
    *   It does **not** invoke `createAuditLog`.
    *   Database deletions for maintenance do not trigger application-level event listeners.
