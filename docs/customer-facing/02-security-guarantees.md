# Security Guarantees & Enforcement

## Overview
This document defines the strict security properties that are architecturally guaranteed by the platform. These are not configuration options or best practices; they are hard constraints enforced by the system's core design.

## 1. Authentication Guarantees

### No Bypass Possible
*   All protected resources are gated by a unified authentication middleware.
*   The system fails closed: if authentication status cannot be definitively determined (e.g., due to a database outage or token parsing error), the request is rejected with a `401 Unauthorized` or `403 Forbidden` status.
*   Client-side checks are purely cosmetic. Access is granted solely based on the cryptographic validity of the session token presented to the API.

### Identity Integrity
*   **MFA Enforcement**: When MFA is enabled for a role or user, the system refuses to issue a standard access token until the second factor is verified. No API operations requiring that role can be performed without a fully upgraded session.
*   **Session Revocation**: A revocation signal (e.g., admin reset) invalidates all active sessions for that user immediately. There is no window of vulnerability where an old token remains valid after a termination event.

## 2. Authorization & Isolation

### Hard Tenant Isolation
*   Every data access operation includes a mandatory database-level filter for the authenticated user's Tenant ID.
*   It is cryptographically impossible for a user's token to be used to access data from another tenant, as the tenant context is embedded in the signed, tamper-proof session claim and verified on every request.

### Least Privilege Implementation
*   Access rights are additive and explicit. A user starts with zero permissions.
*   Role changes take effect immediately upon the next token refresh (maximum 15-minute window) or can be forced instantly via session revocation.

## 3. Data Integrity & Audit

### Immutable Audit Trail
*   The audit logging subsystem writes to a write-only data store.
*   It captures the "Three Ws" for every modifying action: **Who** (User ID + IP), **What** (Action + Target Resource), and **When** (UTC Timestamp).
*   Applications cannot delete or alter existing audit logs.

### Input Validation
*   No raw data is ever passed directly to the database. All inputs are sanitized and validated against strict schemas at the API boundary, neutralizing SQL injection and XSS vectors before they reach the data layer.

## 4. Operational Security

### Secure Recovery
*   Account recovery (e.g., lost MFA device) is strictly an administrative procedure.
*   There is no automated "email-bypass" for MFA. Recovery involves generating temporary, single-purpose tokens that track the recovery lifecycle, ensuring the process is visible and auditable.
