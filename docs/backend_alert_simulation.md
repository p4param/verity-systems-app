# Backend Alert Generation Simulation

Based on static code analysis of the API routes and `alert-service.ts`:

## 1. New Session / New Device (`AUTH_LOGIN_NEW_DEVICE`)

*   **Backend Trigger**: `LOGIN_SUCCESS` (Audit Log).
*   **Current State**: 🔴 **BROKEN**.
    1.  `src/app/api/auth/login/route.ts` does **NOT** call `createAuditLog("LOGIN_SUCCESS")`.
    2.  `AlertService` has no implementation for `AUTH_LOGIN_NEW_DEVICE` in `checkLoginAnomaly`.
*   **Simulation Result**: No alert generated.
*   **Expected Payload**:
    *   **Type**: `AUTH_LOGIN_NEW_DEVICE`
    *   **Severity**: `NOTICE`
    *   **Title**: "New Device Detected"
    *   **Message**: "We detected a login from a new device (Browser/OS)."
    *   **Metadata**: `{ "userAgent": "Mozilla/...", "ip": "1.2.3.4" }`

## 2. New Login Location (`AUTH_LOGIN_NEW_LOCATION`)

*   **Backend Trigger**: `LOGIN_SUCCESS` (Audit Log).
*   **Current State**: 🔴 **BROKEN**.
    1.  Login route does NOT emit `LOGIN_SUCCESS`.
    2.  If it did, `AlertService.checkLoginAnomaly` **IS** implemented to check for new IPs.
*   **Simulation Result**: No alert generated (due to missing trigger).
*   **Expected Payload**:
    *   **Type**: `AUTH_LOGIN_NEW_LOCATION`
    *   **Severity**: `NOTICE`
    *   **Title**: "New Login Detected"
    *   **Message**: "We detected a successful login from a new IP address (1.2.3.4)."
    *   **Metadata**: `{ "ip": "1.2.3.4" }`

## 3. Session Revoked (`SESSION_REVOKED_MANUAL`)

*   **Backend Trigger**: `SESSION_REVOKED` (Audit Log).
*   **Current State**: 🟢 **FUNCTIONAL (Self-Revoke)**.
    *   Route `POST /api/secure/sessions/revoke` emits `SESSION_REVOKED`.
    *   `AlertService` handles it.
*   **Simulation Result**: Alert generated.
*   **Expected Payload**:
    *   **Type**: `SESSION_REVOKED_MANUAL`
    *   **Severity**: `INFO` (if self) / `NOTICE` (if admin)
    *   **Title**: "Session Revoked"
    *   **Message**: "A session was manually revoked."
    *   **Metadata**: `{ "sourceLogId": 123, "actorId": 1, "ip": "..." }`

## 4. Logout from All Devices (`SESSION_REVOKED_GLOBAL`)

*   **Backend Trigger**: `ALL_SESSIONS_REVOKED` (Audit Log).
*   **Current State**: 🟢 **FUNCTIONAL**.
    *   Route `POST /api/secure/sessions/revoke-all` emits `ALL_SESSIONS_REVOKED`.
    *   `AlertService` handles it.
*   **Simulation Result**: Alert generated.
*   **Expected Payload**:
    *   **Type**: `SESSION_REVOKED_GLOBAL`
    *   **Severity**: `NOTICE`
    *   **Title**: "Logged Out Everywhere"
    *   **Message**: "You have been logged out of all devices."

## 5. Security Settings Changed (`MFA_SETUP_COMPLETED`)

*   **Backend Trigger**: `MFA_ENABLED` (Audit Log).
*   **Current State**: 🟢 **FUNCTIONAL**.
    *   Route `POST /api/auth/mfa/confirm` emits `MFA_ENABLED`.
    *   `AlertService` handles it.
*   **Simulation Result**: Alert generated.
*   **Expected Payload**:
    *   **Type**: `MFA_SETUP_COMPLETED`
    *   **Severity**: `INFO`
    *   **Title**: "MFA Enabled"
    *   **Message**: "Multi-Factor Authentication was successfully enabled on your account."

## 6. Security Settings Changed (`MFA_DISABLED`)

*   **Backend Trigger**: `MFA_DISABLED` (Audit Log).
*   **Current State**: 🟢 **FUNCTIONAL**.
    *   Route `POST /api/auth/mfa/disable` emits `MFA_DISABLED`.
    *   `AlertService` handles it.
*   **Simulation Result**: Alert generated.
*   **Expected Payload**:
    *   **Type**: `MFA_DISABLED`
    *   **Severity**: `CRITICAL`
    *   **Title**: "MFA Disabled"
    *   **Message**: "Multi-Factor Authentication was disabled. If this wasn't you, secure your account immediately."

## 7. Admin-Assisted MFA Reset (`MFA_RESET_ADMIN`)

*   **Backend Trigger**: `USER_MFA_RESET_BY_ADMIN` (Audit Log).
*   **Current State**: 🔴 **BROKEN**.
    1.  Route emits `USER_MFA_RESET_BY_ADMIN`.
    2.  `AlertService` switch case **does not contain** `USER_MFA_RESET_BY_ADMIN`.
*   **Simulation Result**: No alert generated (Audit log ignored).
*   **Expected Payload**:
    *   **Type**: `MFA_RESET_ADMIN`
    *   **Severity**: `NOTICE`
    *   **Title**: "MFA Reset by Admin"
    *   **Message**: "Your Multi-Factor Authentication was reset by an administrator."
