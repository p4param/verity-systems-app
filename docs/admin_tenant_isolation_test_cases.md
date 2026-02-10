# Admin API Tenant Isolation Test Cases

## Goal
Verify that Admin APIs strictly respect the authenticated user's tenant context and leak NO data from other tenants.

## 1. User Management (`GET /api/admin/users`)

### TC-ADM-001: Own Tenant Users Only
*   **Setup**: Tenant A has User A1, User A2. Tenant B has User B1.
*   **Actor**: Admin (Tenant A).
*   **Action**: `GET /api/admin/users`
*   **Expected**: Response list contains [A1, A2]. Size = 2.
*   **Pass Criteria**: ID/Email of User B1 is NOT present in the JSON response.

### TC-ADM-002: Cross-Tenant Data Leak (Negative)
*   **Setup**: Create "Mole" user in Tenant B with distinct name "SecretUserB".
*   **Actor**: Admin (Tenant A).
*   **Action**: `GET /api/admin/users`
*   **Validation**: Grep response for "SecretUserB". Must be NOT FOUND.

## 2. Role Management (`GET /api/admin/roles`)

### TC-ADM-003: Own Tenant Roles Only
*   **Setup**: Tenant A has roles [Admin, Staff]. Tenant B has roles [Admin, Contractor].
*   **Actor**: Admin (Tenant A).
*   **Action**: `GET /api/admin/roles`
*   **Expected**: Response contains [Admin, Staff].
*   **Pass Criteria**: "Contractor" role from Tenant B is absent.

### TC-ADM-004: Role Name Collision
*   **Setup**: Both tenants have a role named "Manager", but with different IDs and Permissions.
    *   Tenant A "Manager": ID 101, Perms [READ]
    *   Tenant B "Manager": ID 202, Perms [READ, WRITE]
*   **Actor**: Admin (Tenant A).
*   **Action**: `GET /api/admin/roles`
*   **Expected**: Result includes Role ID 101.
*   **Pass Criteria**: Result does NOT include Role ID 202. Permissions must match Tenant A's definition.

## 3. Security Boundary

### TC-ADM-005: Parameter Tampering (Ignored Input)
*   **Actor**: Admin (Tenant A).
*   **Action**: `GET /api/admin/users?tenantId=999` (Attempt to override).
*   **Expected**: Return Tenant A users.
*   **Pass Criteria**: System ignores the query parameter and relies strictly on the Auth Token.

### TC-ADM-006: Missing Tenant Context (Internal)
*   **Setup**: Mock `requirePermission` to return a user with `tenantId: null`.
*   **Action**: Call API.
*   **Expected**: 500 Internal Server Error (Fail Safe).
*   **Pass Criteria**: No data returned.
