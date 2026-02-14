# Project Architecture & Developer Guide

Welcome to the Verity Systems Document Management System (DMS). This guide outlines the project's architecture, security patterns, and development standards to help new developers get up to speed quickly.

## 🚀 Tech Stack
- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **Database**: [Prisma ORM](https://www.prisma.io/) with PostgreSQL
- **Language**: TypeScript
- **Styling**: Tailwind CSS / Vanilla CSS
- **Authentication**: JWT (JSON Web Tokens) with manual session management
- **Documentation**: Swagger UI (OpenAPI 3.0)

---

## 📂 Folder Structure

```text
src/
├── app/                  # Next.js App Router (Pages & API Routes)
│   ├── (auth)/           # Authentication UI (Login, Register, MFA)
│   ├── (dashboard)/      # Protected UI (Admin, Profile, Documents)
│   └── api/              # Backend API Endpoints
│       ├── admin/        # Administrative APIs (Users, Roles, Audit)
│       ├── auth/         # Auth lifecycle (Login, Refresh, MFA)
│       └── secure/       # Protected application APIs
├── components/           # Shared UI Components
│   └── ui/               # Primary design system components
├── lib/                  # Core Business Logic & Utilities
│   ├── auth/             # JWT, Permission guards, Session logic
│   ├── db/               # Tenant enforcement and Prisma extensions
│   ├── security/         # Privileged area definitions
│   └── swagger/          # OpenAPI specification definitions
├── middleware.ts         # Next.js Middleware (Public vs Private routing)
└── proxy.ts              # Custom Security Proxy (RBAC & Session validation)
prisma/
├── schema.prisma         # Multi-tenant Database Schema
└── seed.js               # Initial data (Roles, Permissions, Admin user)
```

---

## 🔐 Core Security Patterns

### 1. The Proxy & Middleware Logic
Security is enforced in two layers:
1.  **`middleware.ts`**: Handles routing. It determines if a route is "public" (e.g., `/login`) or "private".
2.  **`proxy.ts`**: This is our **Privileged Area Security Standard (PASS)**. If you access a route defined in `src/lib/security/privileged-areas.ts` (like `/admin` or `/api/admin`), the proxy:
    - Checks for an `accessToken`.
    - Validates the session against the database (internal API).
    - Enforces required permissions (e.g., `ADMIN_ACCESS`).
    - Returns JSON for API routes and redirects for UI routes.

### 2. RBAC (Role-Based Access Control)
We use a granular permission system:
- **`requireAuth(req)`**: Ensures the user is logged in.
- **`requirePermission(req, code)`**: Ensures the user has a specific permission (e.g., `USER_VIEW`).
- **Permissions**: Defined in `src/lib/auth/permission-codes.ts`.

### 3. Session Grace Period (Race Condition Fix)
When a token is refreshed, the old session is revoked. To prevent concurrent API calls from failing during this transition, we implement a **30-second grace period**.
- **Found in**: `src/app/api/internal/validate-session/route.ts`.

### 4. Tenant Isolation
Every database query is automatically scoped to the user's `tenantId`.
- **Logic**: Enforced primarily in the API routes using `currentUser.tenantId`.

---

## 🛠️ How to...

### ...Add a New Protected Route
1.  Add the prefix to `src/lib/security/privileged-areas.ts`.
2.  Add the path to the `matcher` in `src/proxy.ts`.
3.  The Middleware/Proxy will now automatically apply protection.

### ...Expose an API in Swagger
1.  Define the path in `src/lib/swagger/`.
2.  Register the path in `src/lib/swagger/index.ts`.
3.  (In Prod) Run `npm run build` to update the spec.

### ...Update the Database
1.  Modify `prisma/schema.prisma`.
2.  Run `npx prisma db push` or `npx prisma generate`.
3.  Update `prisma/seed.js` if default roles/permissions changed.

---

## 📝 Developer Environment
- **Local IP Support**: The `isLocal` logic allows `Secure: false` cookies for development over local networks (192.168.x.x).
- **Environment Variables**: Managed in `.env.local`. Ensure `JWT_SECRET` and `DATABASE_URL` are set.
