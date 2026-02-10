# AG RUNBOOK — Admin UI → Users Management
## User Management Interface

**Purpose:**  
This runbook defines a safe, UI-focused implementation for Admin → Users management in a multi-tenant SaaS. It strictly consumes existing APIs and must not introduce new backend logic.

---

## Global Constraints

- ❌ Do not modify backend APIs
- ❌ Do not introduce new permissions
- ❌ Do not bypass tenant isolation
- ❌ Do not expose audit or internal IDs unnecessarily
- ✅ Assume Phase 7.1 and 7.2 APIs already exist

---

## User Management Capabilities

- ✅ List users in tenant
- ✅ Invite new user
- ✅ Show user status (PENDING, ACTIVE, DISABLED)
- ✅ Deactivate user
- ✅ Reactivate user
- ✅ View assigned roles

---

## Implementation Steps

### Step 1 — Users List Page

**Route:** `/admin/users`

**File:** `src/app/(dashboard)/admin/users/page.tsx`

**Behavior:**
- Fetches users using `GET /api/admin/users`
- Scoped strictly to current tenant (enforced by API)
- Displays user information in responsive layout

**Columns Displayed:**
- Name (fullName)
- Email
- Status (with visual badge)
- Roles (as badges)
- Actions (View, Deactivate/Reactivate)

**Status Badges:**
| Status | Color | Icon | Label |
|--------|-------|------|-------|
| PENDING | Yellow | Clock | Pending |
| ACTIVE | Green | CheckCircle | Active |
| DISABLED | Red | XCircle | Disabled |

**Status:** ✅ Complete

---

### Step 2 — Invite User UI

**Component:** `InviteUserModal`

**Trigger:** "Invite User" button in page header

**Modal Fields:**
1. **Email** (required)
   - Type: email input
   - Validation: Valid email format
   
2. **Full Name** (required)
   - Type: text input
   - Validation: Non-empty string

3. **Roles** (optional)
   - Type: Multi-select checkboxes
   - Fetched from `GET /api/admin/roles`
   - User can select multiple roles

**Behavior:**
1. User clicks "Invite User" button
2. Modal opens with form
3. User fills in email, name, and selects roles
4. On submit, calls `POST /api/admin/users`
5. On success:
   - Modal closes
   - User list refreshes
   - Success confirmation shown
6. **Invite token is NOT displayed** (security)

**API Call:**
```typescript
POST /api/admin/users
{
  "email": "user@example.com",
  "fullName": "John Doe",
  "roleIds": [1, 2]
}
```

**Error Handling:**
- Generic error messages displayed
- No backend error details exposed
- Form remains open on error

**Status:** ✅ Complete

---

### Step 3 — User Status Actions

**Action Buttons Based on Status:**

#### ACTIVE User
- **Action:** "Deactivate" button
- **Color:** Red/Destructive
- **Behavior:** Opens confirmation modal

#### DISABLED User
- **Action:** "Reactivate" button
- **Color:** Green
- **Behavior:** Opens confirmation modal

#### PENDING User
- **Action:** Status badge only
- **Note:** No action buttons (user hasn't activated yet)
- **Future:** Could add "Resend Invite" button

**Status:** ✅ Complete

---

### Step 4 — Confirmation Guards

**Component:** `ConfirmModal`

**Purpose:** Prevent accidental user status changes

#### Deactivate Confirmation

**Title:** "Deactivate User"

**Message:**
> "This will immediately revoke all active sessions and prevent the user from logging in. The user's data will be preserved."

**Buttons:**
- Cancel (secondary)
- Deactivate (destructive/red)

**API Call:**
```typescript
POST /api/admin/users/{userId}/deactivate
```

#### Reactivate Confirmation

**Title:** "Reactivate User"

**Message:**
> "This will allow the user to log in again. The user will need to authenticate with their credentials."

**Buttons:**
- Cancel (secondary)
- Reactivate (primary/green)

**API Call:**
```typescript
POST /api/admin/users/{userId}/reactivate
```

**Effects Explained:**
- ✅ **Deactivate:** Sessions revoked, access removed
- ✅ **Reactivate:** Access restored, must re-login

**Status:** ✅ Complete

---

### Step 5 — Error Handling

**Error Display Strategy:**

1. **Generic Messages:**
   - "Failed to load users"
   - "Failed to invite user"
   - "Failed to deactivate user"
   - "Failed to reactivate user"

2. **No Backend Details Exposed:**
   - Stack traces hidden
   - Internal errors sanitized
   - Permission errors shown generically

3. **Error Placement:**
   - Page-level errors: Top of page in red banner
   - Modal errors: Inside modal above buttons
   - Inline errors: Below affected field

4. **Permission Denied:**
   - Handled gracefully
   - Generic "Operation failed" message
   - No indication of why (security)

**Status:** ✅ Complete

---

### Step 6 — Audit Awareness (UI Only)

**UI Behavior:**
- ✅ Does NOT display audit logs
- ✅ Does NOT write audit data
- ✅ Actions automatically generate audit events server-side
- ✅ UI is unaware of audit implementation

**Server-Side Audit Events (Automatic):**
- `USER.CREATE` - When user invited
- `USER.DEACTIVATE` - When user deactivated
- `USER.REACTIVATE` - When user reactivated

**UI Responsibility:**
- None - audit logging is purely server-side

**Status:** ✅ Complete

---

## User Interface Flows

### Flow 1: Invite New User

```
1. Admin clicks "Invite User" button
   ↓
2. Modal opens with form
   ↓
3. Admin enters:
   - Email: user@example.com
   - Name: John Doe
   - Roles: [Admin, Editor]
   ↓
4. Admin clicks "Send Invite"
   ↓
5. API call: POST /api/admin/users
   ↓
6. Success:
   - Modal closes
   - User list refreshes
   - New user appears with PENDING status
   ↓
7. User receives invite email (server-side)
```

### Flow 2: Deactivate Active User

```
1. Admin clicks "Deactivate" on ACTIVE user
   ↓
2. Confirmation modal appears:
   "This will immediately revoke all active sessions..."
   ↓
3. Admin clicks "Deactivate"
   ↓
4. API call: POST /api/admin/users/123/deactivate
   ↓
5. Success:
   - Modal closes
   - User list refreshes
   - User status changes to DISABLED
   - User's sessions revoked (server-side)
   ↓
6. User immediately loses access
```

### Flow 3: Reactivate Disabled User

```
1. Admin clicks "Reactivate" on DISABLED user
   ↓
2. Confirmation modal appears:
   "This will allow the user to log in again..."
   ↓
3. Admin clicks "Reactivate"
   ↓
4. API call: POST /api/admin/users/123/reactivate
   ↓
5. Success:
   - Modal closes
   - User list refreshes
   - User status changes to ACTIVE
   ↓
6. User can now log in (must authenticate)
```

---

## Component Architecture

### Page Component: `UsersPage`

**Responsibilities:**
- Fetch and display user list
- Manage modal states
- Handle user actions
- Refresh data after changes

**State:**
```typescript
users: User[]              // List of users
loading: boolean           // Loading state
error: string             // Error message
inviteModalOpen: boolean  // Invite modal state
confirmModal: {           // Confirmation modal state
  isOpen: boolean
  userId?: number
  action?: "deactivate" | "reactivate"
}
```

**Functions:**
- `loadUsers()` - Fetch users from API
- `handleDeactivate(userId)` - Deactivate user
- `handleReactivate(userId)` - Reactivate user

---

### Component: `InviteUserModal`

**Props:**
```typescript
{
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}
```

**State:**
```typescript
email: string
fullName: string
selectedRoles: number[]
roles: { id: number; name: string }[]
loading: boolean
error: string
```

**Behavior:**
- Fetches available roles on open
- Validates form inputs
- Calls invite API
- Resets form on success

---

### Component: `ConfirmModal`

**Props:**
```typescript
{
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText: string
  confirmVariant?: "danger" | "primary"
}
```

**Behavior:**
- Generic reusable confirmation dialog
- Supports different visual variants
- Calls onConfirm callback on confirmation

---

### Component: `StatusBadge`

**Props:**
```typescript
{
  status: "PENDING" | "ACTIVE" | "DISABLED"
}
```

**Behavior:**
- Displays colored badge with icon
- Visual indicator of user status
- Consistent styling across app

---

## Responsive Design

### Mobile View (< 1024px)
- Card-based layout
- Stacked information
- Touch-friendly buttons
- Scrollable role badges

### Desktop View (≥ 1024px)
- Table layout
- Columns: Name, Email, Status, Roles, Actions
- Hover effects
- Inline actions

---

## API Integration

### GET /api/admin/users
**Purpose:** Fetch all users in tenant

**Response:**
```typescript
{
  id: number
  fullName: string
  email: string
  status: "PENDING" | "ACTIVE" | "DISABLED"
  roles: string[]
  createdAt: string
}[]
```

---

### POST /api/admin/users
**Purpose:** Invite new user

**Request:**
```typescript
{
  email: string
  fullName: string
  roleIds: number[]
}
```

**Response:**
```typescript
{
  message: string
  user: {
    id: number
    email: string
    fullName: string
    status: "PENDING"
  }
  inviteToken: string  // NOT displayed in UI
  expiresAt: string
}
```

---

### POST /api/admin/users/[id]/deactivate
**Purpose:** Deactivate user and revoke sessions

**Response:**
```typescript
{
  message: string
  user: {
    id: number
    email: string
    fullName: string
    status: "DISABLED"
  }
}
```

---

### POST /api/admin/users/[id]/reactivate
**Purpose:** Reactivate disabled user

**Response:**
```typescript
{
  message: string
  user: {
    id: number
    email: string
    fullName: string
    status: "ACTIVE"
  }
}
```

---

### GET /api/admin/roles
**Purpose:** Fetch available roles for assignment

**Response:**
```typescript
{
  id: number
  name: string
}[]
```

---

## Success Criteria

### User Management
- ✅ Admin can manage users without touching auth flows
- ✅ UI reflects real user lifecycle states
- ✅ No backend behavior duplicated in UI
- ✅ Tenant isolation preserved (enforced by API)

### User Experience
- ✅ Clear visual status indicators
- ✅ Confirmation before destructive actions
- ✅ Responsive design (mobile + desktop)
- ✅ Loading states shown
- ✅ Errors handled gracefully

### Security
- ✅ Invite tokens not displayed
- ✅ Generic error messages
- ✅ No audit log exposure
- ✅ Permission checks server-side

---

## Out of Scope

The following are explicitly **NOT** included:

- ❌ Bulk actions (bulk deactivate, bulk invite)
- ❌ CSV upload/import
- ❌ Email preview
- ❌ Audit viewer integration
- ❌ Cross-tenant administration
- ❌ User deletion
- ❌ Password reset by admin
- ❌ Session viewer
- ❌ Advanced filtering/search
- ❌ Export functionality

---

## Testing Checklist

### Invite User
- [ ] "Invite User" button opens modal
- [ ] Email validation works
- [ ] Name validation works
- [ ] Roles fetched and displayed
- [ ] Multiple roles can be selected
- [ ] Submit creates user with PENDING status
- [ ] Success closes modal and refreshes list
- [ ] Error displays in modal
- [ ] Cancel closes modal without action

### User List
- [ ] Users displayed in table (desktop)
- [ ] Users displayed in cards (mobile)
- [ ] Status badges show correct color/icon
- [ ] Roles displayed as badges
- [ ] "View" link navigates to user detail
- [ ] Actions shown based on status

### Deactivate User
- [ ] "Deactivate" button shows for ACTIVE users
- [ ] Confirmation modal appears
- [ ] Message explains session revocation
- [ ] Cancel closes modal without action
- [ ] Confirm deactivates user
- [ ] Status changes to DISABLED
- [ ] List refreshes after action
- [ ] Error handled gracefully

### Reactivate User
- [ ] "Reactivate" button shows for DISABLED users
- [ ] Confirmation modal appears
- [ ] Message explains re-authentication needed
- [ ] Cancel closes modal without action
- [ ] Confirm reactivates user
- [ ] Status changes to ACTIVE
- [ ] List refreshes after action
- [ ] Error handled gracefully

### Pending Users
- [ ] PENDING users show status badge
- [ ] No action buttons for PENDING users
- [ ] Can view user details

### Error Handling
- [ ] Network errors shown generically
- [ ] Permission errors handled
- [ ] Invalid data errors shown
- [ ] Errors don't expose backend details

### Responsive Design
- [ ] Mobile view uses cards
- [ ] Desktop view uses table
- [ ] Modals work on mobile
- [ ] Touch targets adequate
- [ ] Scrolling works properly

---

## Visual Design

### Color Scheme

**Status Colors:**
- PENDING: Yellow (`yellow-500`)
- ACTIVE: Green (`green-500`)
- DISABLED: Red (`red-500`)

**Action Colors:**
- Primary: Blue (invite, reactivate)
- Destructive: Red (deactivate)
- Secondary: Gray (cancel, view)

### Icons

**Status Icons:**
- PENDING: Clock
- ACTIVE: CheckCircle
- DISABLED: XCircle

**Action Icons:**
- Invite: UserPlus
- User: UserIcon
- Email: Mail

### Typography

**Headings:**
- Page title: 2xl, bold
- Modal title: xl, semibold
- Card title: base, medium

**Body:**
- Table text: sm
- Card text: sm
- Labels: sm, medium

---

## Accessibility

### Keyboard Navigation
- ✅ Tab through interactive elements
- ✅ Enter to submit forms
- ✅ Escape to close modals

### Screen Readers
- ✅ Semantic HTML elements
- ✅ ARIA labels where needed
- ✅ Status announced

### Visual
- ✅ Sufficient color contrast
- ✅ Icons paired with text
- ✅ Focus indicators visible

---

## Performance

### Optimization Strategies
- ✅ Single API call to fetch users
- ✅ Roles fetched only when modal opens
- ✅ List refreshes only after actions
- ✅ No unnecessary re-renders

### Loading States
- ✅ Initial page load
- ✅ Form submission
- ✅ Action execution

---

## Future Enhancements

### Potential Additions (Not in Scope)
1. **Search/Filter**
   - Search by name or email
   - Filter by status or role

2. **Pagination**
   - Handle large user lists
   - Page size selection

3. **Resend Invite**
   - Button for PENDING users
   - Calls resend-invite API

4. **Bulk Actions**
   - Select multiple users
   - Bulk deactivate/reactivate

5. **User Details Quick View**
   - Slide-out panel
   - Avoid full page navigation

6. **Activity Timeline**
   - Show recent user actions
   - Status change history

---

## Deployment

### Prerequisites
- ✅ Phase 7.1 APIs deployed
- ✅ Phase 7.2 APIs deployed
- ✅ Database migration applied
- ✅ Prisma client regenerated

### Deployment Steps
1. **Deploy UI changes**
   - No backend changes required
   - UI consumes existing APIs

2. **Verify functionality**
   - Test invite flow
   - Test deactivate/reactivate
   - Check responsive design

3. **Monitor**
   - Watch for API errors
   - Check user feedback
   - Monitor performance

---

## Outcome

✅ **Complete, secure, user-friendly admin interface for user management**

### What Was Built:
- Users list page with status indicators
- Invite user modal with role selection
- Deactivate/reactivate actions with confirmations
- Responsive design (mobile + desktop)
- Error handling and loading states

### What Was NOT Changed:
- Backend APIs (consumed as-is)
- Authentication flows
- Audit logging
- Tenant isolation
- Permission system

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-29  
**Status:** Implementation Complete  
**Dependencies:** Phase 7.1, Phase 7.2
