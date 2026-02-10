# Implementation Plan: Client-Side Token Expiry Check

## Goal
Prevent the browser from logging "401 Unauthorized" errors in the console during the normal token refresh flow.

## Problem
Currently, `fetchWithAuth` blindly attempts a request with the current access token. If the token is expired, the server returns 401, which the browser logs as an error. Only then does the client refresh the token and retry.

## Proposed Change
Update `src/lib/auth/auth-context.tsx` to:
1.  Implement a lightweight `isTokenExpired(token)` helper using `atob` and `JSON.parse`.
2.  Check token expiration **before** the first `fetch` call.
3.  If expired, skip the failed request and trigger `refreshTokens` immediately.

### Files to Modify
*   `src/lib/auth/auth-context.tsx`

```typescript
// Helper Logic
const isTokenExpired = (token: string) => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 < Date.now();
    } catch {
        return true; // If invalid, assume expired
    }
}

// In fetchWithAuth
if (token && isTokenExpired(token)) {
    // Skip directly to refresh
    const newToken = await getRefreshTokenSingleton();
    // ... proceed with new token
}
```

## Verification Plan
1.  **Manual Verification**:
    *   Log in.
    *   Wait for 15 minutes (or hack `ACCESS_TOKEN_EXP` to "10s").
    *   Refresh the page or trigger an API call.
    *   Observe the console. **Should NOT see a red "401" error.**
    *   Observe the network tab. Should see `/refresh` called *before* or *instead of* the failed API call.
