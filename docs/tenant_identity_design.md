# Tenant Identity Resolution Strategy (Simplified)

## Assumption
**"An email ID will exist in only one tenant."**
This business rule implies that while the database schema *technically* allows duplicates across tenants (`@@unique([tenantId, email])`), the application logic enforces global uniqueness.

## Recommended Strategy: "Implicit Resolution with Integrity Check"

We will maintain the current simple login flow (Email + Password) but add safety guards to detect violations of the single-tenant assumption.

### 1. The Strategy (How it works)

**Authentication Logic (Server-Side):**
1.  **Input**: User provides `email` and `password`.
2.  **Resolution**: Query `User` where `email = input.email`.
    *   **Case A: 0 records** -> Return generic "Invalid credentials".
    *   **Case B: 1 record** -> **Success**. Proceed to verify password for this user and their `tenantId`.
    *   **Case C: >1 records** -> **Critical Data Integrity Violation**.
        *   This state should be impossible under the business rule.
        *   **Action**: Block login. Return generic "Invalid credentials" to user (security).
        *   **Internal Action**: Log a high-severity system alert ("Duplicate users found for email ${email} violating global uniqueness").

### Why this is safest
*   **Zero UX Change**: Users continue to log in with just email/password.
*   **Fail-Safe**: If the data somehow gets corrupted (same email in 2 tenants), we block access rather than guessing/logging into the wrong one.
*   **Performance**: `findMany` on an indexed email field is extremely fast.

### Risks & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| **Data Corruption (Duplicates)** | If duplicates exist, the user is effectively locked out. <br> **Mitigation**: Admin intervention required to merge/delete the duplicate. The internal alert will flag this immediately. |
| **Registration Race Conditions** | Two tenants creating same email simultaneously. <br> **Mitigation**: (Future Work) The User Creation APls must check global uniqueness, not just tenant uniqueness. |

## Implementation Plan (Next Steps)
1.  **Modify `POST /api/auth/login`**:
    *   Change `prisma.user.findFirst` to `prisma.user.findMany({ where: { email } })`.
    *   Add logic: `if (users.length > 1) { console.error(...); return 401; }`.
    *   Use `users[0]` for the login process.

2.  **Modify `POST /api/auth/forgot-password`**:
    *   Apply identical logic (`findMany` -> check count -> use first or fail).

3.  **No UI changes required**.

Waiting for approval to proceed.
