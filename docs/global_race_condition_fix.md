# Implementation Plan: Global Auth Loading Guard

## Problem
When a user refreshes the page (F5), React components mount and trigger `useEffect` data fetches immediately. However, `auth-context` is still performing the async `restore()` process to validate the session from local storage.
*   **Result**: `fetchWithAuth` runs with `accessToken = null`.
*   **Symptom**: 401 Unauthorized error in console.

## Proposed Solution
Modify `fetchWithAuth` to check the `loading` state. If `loading` is true (meaning initialization is in progress), it should **wait** until initialization completes before attempting the fetch.

### Mechanism
1.  **Promise-based Wait**: Use a simple polling loop or a resolved Promise to pause execution. A generic `waitUntilReady` helper is sufficient here.
2.  **Implementation**:
    *   In `fetchWithAuth`, check `if (loading)`.
    *   If true, await a helper that checks `loading` state every 50ms (or uses an event emitter, but polling is simpler/safer for this context).
    *   Once resolved, proceed with the standard token check logic.
    *   This effectively "queues" the requests during the startup phase.

### Code Change: `src/lib/auth/auth-context.tsx`
```typescript
// Add inside AuthProvider or as a helper
const waitForAuth = async () => {
    while (loading) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

// In fetchWithAuth
if (loading) {
    await waitForAuth();
}
// ... proceed
```
*Note: Since `loading` in `fetchWithAuth` (which is a closure) might be stale, we need to be careful. A better approach is to use a `ref` for `loading` state to ensure we read the live value.*

## Verification Plan
1.  **Manual Verification**:
    *   Go to `/admin/users` (or any protected page).
    *   Open Console.
    *   Hard Refresh (F5).
    *   **Success**: No "401 Unauthorized" red error logs. The data eventually loads.
