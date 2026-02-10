# Test Coverage Analysis

## Alert Coverage Matrix

The codebase contains **no automated testing framework** (e.g., Jest, Mocha). Validation relies on manual execution of scripts in `scripts/`. None of the existing scripts verify that an alert is actually created/persisted in the database.

| Alert Type | Status | Existing Test Script | Verification | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **New session / new device** | 🔴 **MISSING** | `test-login-api.js` (Partial) | ❌ None | `AUTH_LOGIN_NEW_DEVICE` is defined but **not implemented** in `alert-service.ts`. Current logic only checks IP (Location). |
| **Session revoked** | 🔴 **MISSING** | None | ❌ None | No script triggers the revoke session endpoint. |
| **Logout from all devices** | 🔴 **MISSING** | None | ❌ None | No script triggers the global logout endpoint. |
| **Security settings changed (MFA)** | 🔴 **MISSING** | None | ❌ None | No script triggers MFA enable/disable. |
| **Admin-assisted MFA reset** | 🟠 **PARTIAL** | `debug-mfa-reset.js` | ❌ None | Trigger exists, but `AlertService.evaluateEvent` **missing logic** to handle `MFA_RESET` action. |
| **New login location** | 🟠 **PARTIAL** | `test-login-api.js` | ❌ None | Script tests login, but does not simulate IP change. Logic exists in Service (`AUTH_LOGIN_NEW_LOCATION`). |

## Missing Test Cases & Logic Gaps

### 1. Missing Alert Logic (Source Code Gap)
The following alert types are defined in `AlertEventType` but have **no implementation** in `AlertService.evaluateEvent`:
- `AUTH_LOGIN_NEW_DEVICE` (New Device detection is currently identical to New Location/IP).
- `MFA_RESET_ADMIN` (Admin reset action is not caught by the switch statement).

### 2. Missing Test Scenarios
- **TC-001: Admin Revoke Session**
  - **Action:** Admin calls `DELETE /api/secure/sessions/revoke`.
  - **Expected:** Alert `SESSION_REVOKED_MANUAL` created for target user.
- **TC-002: Global Logout**
  - **Action:** User/Admin calls `DELETE /api/secure/sessions/revoke-all`.
  - **Expected:** Alert `SESSION_REVOKED_GLOBAL` created.
- **TC-003: MFA Enable/Disable**
  - **Action:** User calls `/api/auth/mfa/confirm` or `/api/auth/mfa/disable`.
  - **Expected:** Alert `MFA_SETUP_COMPLETED` or `MFA_DISABLED` created.
- **TC-004: New Location Simulation**
  - **Action:** Login with a distinct `x-forwarded-for` mock header or new IP.
  - **Expected:** Alert `AUTH_LOGIN_NEW_LOCATION` created.

### 3. Missing Coverage for Overlapping Cases
- **Self-Revocation vs Admin-Revocation:** `SESSION_REVOKED_MANUAL` has logic for `isSelf`, but this branch is untestable with current scripts.
