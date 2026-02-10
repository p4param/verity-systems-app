# Manual Testing Guide: Tenant Enforcement Violation Analysis

## Current Status
✅ Logging mode **ENABLED** in local environment
✅ Dev server running on http://localhost:3000
✅ Configuration: `TENANT_ENFORCEMENT_ENABLED=true`, `MODE=log_only`

---

## Testing Instructions

### Step 1: Open Browser Console
1. Open http://localhost:3000 in your browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Filter for "TENANT" to see violations

### Step 2: Test Authentication Flows

#### Test 2.1: Login
1. Navigate to http://localhost:3000/login
2. Enter credentials and submit
3. **Expected**: Login succeeds or fails normally
4. **Check Console**: Look for `TENANT_VIOLATION` warnings

#### Test 2.2: Logout
1. If logged in, click logout
2. **Check Console**: Look for violations

#### Test 2.3: Forgot Password
1. Navigate to /forgot-password (if exists)
2. Submit email
3. **Check Console**: Look for violations

---

### Step 3: Test Admin APIs

#### Test 3.1: Admin Users List
1. Navigate to http://localhost:3000/admin/users
2. Wait for page to load
3. **Check Console**: Look for violations on User model queries

#### Test 3.2: Admin Roles List
1. Navigate to http://localhost:3000/admin/roles
2. Wait for page to load
3. **Check Console**: Look for violations on Role model queries

#### Test 3.3: Admin Permissions List
1. Navigate to http://localhost:3000/admin/permissions
2. Wait for page to load
3. **Check Console**: Look for violations (should be none - Permission is global)

---

### Step 4: Test Session-Related Flows

#### Test 4.1: Profile Page
1. Navigate to http://localhost:3000/profile
2. View active sessions
3. **Check Console**: Look for RefreshToken violations

#### Test 4.2: Security Alerts
1. Navigate to alerts section (if visible)
2. **Check Console**: Look for SecurityAlert violations

---

### Step 5: Check Server Logs

Open the terminal where `npm run dev` is running and look for:
```
TENANT_VIOLATION { type: '...', model: '...', action: '...' }
```

---

## Violation Log Format

When you see violations, they will look like this:

```javascript
TENANT_VIOLATION {
  type: 'missing_tenant_id' | 'missing_relation_filter',
  model: 'User' | 'Role' | 'RefreshToken' | etc.,
  action: 'findMany' | 'findFirst' | 'count' | etc.,
  message: 'Model X requires tenantId in where clause',
  timestamp: '2026-01-29T00:18:05.000Z'
}
```

---

## Recording Violations

### Create a violations log file
Create a file: `violations_found.txt`

For each violation, record:
```
[TIMESTAMP] [MODEL] [ACTION] [TYPE]
Example:
[00:18:05] User findMany missing_tenant_id
[00:18:06] RefreshToken findFirst missing_relation_filter
```

---

## Expected Violations (Predictions)

Based on the codebase, we expect violations in:

### CRITICAL (Security Risk)
- **User queries** without tenantId in admin pages
- **RefreshToken queries** without user.tenantId in session management
- **Role queries** without tenantId in admin pages

### HIGH (Data Leak Risk)
- **AuditLog queries** without tenantId
- **SecurityAlert queries** without user.tenantId
- **UserRole queries** without relation filters

### MEDIUM (Potential Issue)
- **PasswordResetToken queries** without user.tenantId
- **MfaBackupCode queries** without user.tenantId

### LOW (Expected/Acceptable)
- **Permission queries** (global model, no violation expected)
- **Tenant queries** (global model, no violation expected)

---

## After Testing

### Collect Data
1. Copy all console violations
2. Copy all server log violations
3. Count frequency of each violation type
4. Group by model and endpoint

### Share Results
Paste the violations you found and I'll analyze them to create:
- Categorized violation report
- Severity assessment
- Fix priority recommendations

---

## STOP - Do Not Fix Anything Yet

**IMPORTANT**: 
- ❌ Do NOT modify any code
- ❌ Do NOT add tenantId to queries
- ❌ Do NOT change API routes
- ✅ Only collect and document violations

We'll analyze first, then create a fix plan.
