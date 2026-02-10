# SOC 2 Readiness Mapping

## Overview
This document maps our platform's security controls to the relevant Trust Services Criteria (TSC) for SOC 2 (Security Category). This mapping assists auditors and security reviewers in understanding how our architecture supports compliance requirements.

| SOC 2 Criterion | Requirement Summary | Platform Control / Implementation |
| :--- | :--- | :--- |
| **CC6.1** | The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events to meet its objectives. | **RBAC & Tenant Isolation**: Access is governed by a strict Role-Based Access Control system. All data access is scoped by Tenant ID at the database query level, preventing cross-tenant access. |
| **CC6.1** | (continued) | **Mandatory MFA**: Multi-Factor Authentication is enforced by the backend for all privileged access headers. Token issuance is gated by MFA verification steps. |
| **CC6.2** | Prior to issuing system credentials and granting system access, the entity registers and authorizes new internal and external users whose access is administered by the entity. | **Admin-Controlled Onboarding**: User creation is restricted to Tenant Administrators. The "Invite" and "MFA Setup" flows ensure that identity is established and verified (via email and TOTP) before active access is granted. |
| **CC6.3** | The entity authorizes requests to establish, modify, or close user accounts and related access privileges. | **Identity Lifecycle Management**: Administrators have a dedicated interface to lock accounts, revoke sessions, and reset credentials. All such actions are structurally impossible for non-admin users. |
| **CC6.7** | The entity restricts the transmission, movement, and removal of information to authorized internal and external users and processes. | **Token-Based API Security**: API endpoints require signed, short-lived JWTs. Data export capabilities are restricted to specific permission sets (`data.export`) and are logged. |
| **CC6.8** | The entity implements controls to prevent or detect and act upon the introduction of unauthorized or malicious software to meet its objectives. | **Backend Authority**: The application treats the frontend as untrusted. All business logic and security checks reside on the server, preventing client-side tampering or bypass scripts. |
| **A1.2** | The entity authorizes, designs, develops, or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures to meet its objectives. | **Audit Trail**: Critical mutations (Create/Update/Delete) generate immutable audit log entries. This provides a historical record of system state changes for forensic analysis. |
| **A1.3** | The entity tests system reliability and performance. | **Health Checks & Monitoring**: The platform includes dedicated health check endpoints (e.g., `/api/health`) to verify database connectivity and system status in real-time. |

## Notes for Auditors
*   **Evidence Collection**: Screenshots of Audit Logs and User Management screens can be provided as evidence of population and enforcement.
*   **Architecture Diagrams**: See *01-bulletproof-security-architecture.md* for the data flow and isolation diagrams.
