
# 🔐 Authentication & Authorization – README

This document describes the **authentication system** implemented in this project, including **JWT access tokens**, **rotating refresh tokens**, **forgot-password flow**, **rate-limiting**, and **cleanup jobs**.

The system is **DB-first**, **Prisma-backed**, and designed for **enterprise-grade security**.

---

## 📌 High-Level Overview

### Auth Architecture
- **Access Token**: Short-lived JWT (15 minutes)
- **Refresh Token**: Long-lived, opaque token (7 days)
- **Refresh Token Rotation**: Enabled (single-use refresh tokens)
- **Password Reset Tokens**: Hashed, single-use, time-bound
- **Rate-Limiting**: Applied to forgot-password endpoint
- **Cleanup Jobs**: Automated cleanup of expired/revoked tokens

---

## 🔑 Token Strategy

| Token Type | Format | Lifetime | Storage |
|-----------|--------|----------|---------|
| Access Token | JWT | 15 minutes | Client memory |
| Refresh Token | Random string | 7 days | DB (hashed) |
| Password Reset Token | Random string | 30 minutes | DB (hashed) |

---

## 📂 Database Tables (Auth-related)

### Users
- Stores user identity and account status
- Flags: `IsActive`, `IsLocked`

### RefreshTokens
- Stores hashed refresh tokens
- Supports rotation and revocation

Key columns:
- `UserId`
- `TokenHash`
- `ExpiresAt`
- `RevokedAt`

### PasswordResetTokens
- Stores hashed password reset tokens

Key columns:
- `UserId`
- `TokenHash`
- `ExpiresAt`
- `UsedAt`

### PasswordResetRequests
- Used for rate-limiting forgot-password requests

Key columns:
- `Email`
- `IpAddress`
- `RequestedAt`

---

## 🔐 Auth API Endpoints

### 1️⃣ Login
**POST** `/api/auth/login`

Request:
```json
{
  "email": "admin@dms.com",
  "password": "Admin@123"
}
```

Response:
```json
{
  "accessToken": "<JWT>",
  "refreshToken": "<opaque-token>",
  "expiresIn": 900
}
```

---

### 2️⃣ Refresh Access Token (Rotating)
**POST** `/api/auth/refresh`

Request:
```json
{
  "refreshToken": "<current-refresh-token>"
}
```

Response:
```json
{
  "accessToken": "<new-jwt>",
  "refreshToken": "<new-refresh-token>",
  "expiresIn": 900
}
```

---

### 3️⃣ Logout
**POST** `/api/auth/logout`

Request:
```json
{
  "refreshToken": "<refresh-token>"
}
```

---

## 🔁 Forgot Password Flow

### Forgot Password
**POST** `/api/auth/forgot-password`

Response (always):
```json
{
  "message": "If the email exists, a reset link has been sent"
}
```

### Reset Password
**POST** `/api/auth/reset-password`

---

## 🧹 Cleanup Jobs

Cleanup logic lives in:
```
src/lib/auth/cleanup-auth-tokens.ts
```

Triggered via:
```
POST /api/internal/cleanup/reset-tokens
```

---

## 🔒 Security Guarantees

✔ JWT issuer/audience enforced  
✔ Passwords hashed with bcrypt  
✔ Tokens stored hashed  
✔ Refresh token replay protection  
✔ Enumeration-safe forgot password  
✔ Rate-limiting  
✔ DB-first design  

---

## ✅ Status

**Auth system is production-ready and complete.**
