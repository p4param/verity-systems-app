# Verity Systems - Document Management System

This is the official repository for the Verity Systems Document Management System (DMS), a multi-tenant SaaS application built for secure document lifecycle management.

## 📖 Essential Documentation
For developers joining the project, please read the **[ARCHITECTURE.md](./ARCHITECTURE.md)** guide first. It covers:
- Complete Folder Structure
- Authentication & Session Management Logic
- Role-Based Access Control (RBAC) Hardening
- Tenant Isolation Standards
- API Documentation (Swagger)

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 20+
- PostgreSQL
- Git

### 2. Installation
```bash
npm install
```

### 3. Database Setup
Ensure your `.env.local` contains a valid `DATABASE_URL`. Then run:
```bash
npx prisma generate
npx prisma db push
node prisma/seed.js
```

### 4. Running the App
```bash
# Development mode
npm run dev

# Production build
npm run build
npm run start
```

---

## 🛠️ Key Scripts
- `npm run dev`: Starts the dev server with Turbopack.
- `npm run build`: Generates the optimized production build.
- `node prisma/seed.js`: Resets the default admin account and permissions.

## 🧪 Testing APIs
The API documentation is available at [http://localhost:3000/api/docs](http://localhost:3000/api/docs) once the server is running.
