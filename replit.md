# Varity Systems

## Overview
Multi-tenant Document Management System (DMS) SaaS application built with Next.js 16, Prisma ORM, and PostgreSQL. Features include authentication with MFA, role-based access control, audit logging, security alerts, and admin dashboard.

## Project Architecture
- **Framework**: Next.js 16 (App Router) with Turbopack
- **Language**: TypeScript / JavaScript
- **Database**: PostgreSQL (via Prisma ORM)
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI, Lucide React icons
- **Auth**: JWT-based with MFA (TOTP via otplib), bcrypt for password hashing
- **Theme**: Azure-inspired corporate blue (oklch color space), Segoe UI font

## Project Structure
```
src/
  app/
    (auth)/         - Auth pages (login, register, forgot/reset password)
    (dashboard)/    - Dashboard pages (admin, profile, settings)
    api/            - API routes (auth, admin, secure endpoints)
  components/       - Shared UI components
  lib/
    auth/           - JWT, password, MFA, permissions utilities
    db/             - Tenant middleware, model classification
    security/       - Alert service
    swagger/        - OpenAPI/Swagger docs
prisma/
  schema.prisma     - Database schema (PostgreSQL)
public/
  logo.png          - Varity Systems logo (temporary)
```

## Key Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `JWT_SECRET` - Secret for JWT token signing
- `NEXT_PUBLIC_APP_URL` - Public URL of the application

## Development
- **Dev Server**: `npx next dev -p 5000 -H 0.0.0.0`
- **Build**: `npm run build`
- **Start**: `npm run start`

## Database
- Uses Replit's built-in PostgreSQL database
- Schema managed via Prisma (`prisma/schema.prisma`)
- Originally migrated from SQL Server to PostgreSQL

## User Preferences
- Branding: "Varity Systems" (previously "DMS SaaS")
- Theme: Corporate Azure-inspired blue, no indigo/purple
- Sidebar: Dark blue-grey with PanelLeftOpen/PanelLeftClose toggle icons
- Email functionality: Deferred — currently uses console log stubs

## Recent Changes
- 2026-02-06: Renamed from "DMS SaaS" to "Varity Systems", added temporary logo, updated sidebar with proper expand/collapse icons
- 2026-02-06: Applied Azure-inspired corporate blue theme, removed all hardcoded indigo/purple colors
- 2026-02-06: Imported from GitHub, converted from SQL Server to PostgreSQL, configured for Replit environment
