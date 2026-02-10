# Tenant-Safe Authentication Test Cases

## 1. Login Flow (`POST /api/auth/login`)

### TC-001: Standard Login (Happy Path)
*   **Scenario**: User exists in **Single Tenant** (Standard case).
*   **Input**: `{ "email": "user@tenantA.com", "password": "valid" }`
*   **Database State**: 1 User record found for email.
*   **Expected Result**:
    *   **HTTP**: 200 OK.
    *   **Body**: Contains `accessToken`, `user` object with correct `tenantId`.
    *   **Logs**: Audit log created (if enabled).

### TC-002: Ambiguous Login (Duplicate Identity)
*   **Scenario**: Same email exists in **Tenant A** AND **Tenant B**.
*   **Input**: `{ "email": "ambiguous@shared.com", "password": "valid" }`
*   **Database State**: 2+ User records found for email.
*   **Expected Result**:
    *   **HTTP**: 401 Unauthorized.
    *   **Body**: `{ "error": "Invalid credentials" }` (Generic message).
    *   **Server Logic**: **BLOCKS** login. Does NOT process password check.
    *   **Logs**: `[AUTH_CRITICAL] Duplicate users found...`.

### TC-003: Non-Existent User
*   **Scenario**: Email does not exist in any tenant.
*   **Input**: `{ "email": "ghost@nowhere.com", "password": "..." }`
*   **Expected Result**:
    *   **HTTP**: 401 Unauthorized.
    *   **Body**: `{ "error": "Invalid credentials" }` (Same as TC-002 for security).

## 2. Forgot Password Flow (`POST /api/auth/forgot-password`)

### TC-004: Standard Reset (Happy Path)
*   **Scenario**: User exists in **Single Tenant**.
*   **Input**: `{ "email": "user@tenantA.com" }`
*   **Expected Result**:
    *   **HTTP**: 200 OK.
    *   **Body**: `{ "message": "If the email exists..." }`.
    *   **Database**: `PasswordResetToken` created linked to the correct user.

### TC-005: Ambiguous Reset (Duplicate Identity)
*   **Scenario**: Same email exists in **Tenant A** AND **Tenant B**.
*   **Input**: `{ "email": "ambiguous@shared.com" }`
*   **Expected Result**:
    *   **HTTP**: 200 OK (To prevent enumeration).
    *   **Body**: `{ "message": "If the email exists..." }`.
    *   **Database**: **NO** `PasswordResetToken` created.
    *   **Logs**: `[ForgotPW_CRITICAL] Duplicate users found...`.

## 3. Cross-Tenant Isolation (Admin APIs)

### TC-006: Admin User List Isolation
*   **Scenario**: Admin A (Tenant A) requests user list. Tenant B also has users.
*   **Action**: `GET /api/admin/users` (Auth Header: Admin A).
*   **Expected Result**:
    *   **HTTP**: 200 OK.
    *   **Data**: List contains **ONLY** users where `tenantId == Tenant A`.
    *   **Validation**: Verify no Tenant B users appear in JSON response.

### TC-007: Admin Role List Isolation
*   **Scenario**: Admin A (Tenant A) requests role list.
*   **Action**: `GET /api/admin/roles` (Auth Header: Admin A).
*   **Expected Result**:
    *   **HTTP**: 200 OK.
    *   **Data**: List contains **ONLY** roles where `tenantId == Tenant A`.
    *   **Validation**: Verify no hardcoded `tenantId: 1` results if Admin is Tenant 2.
