# AG RUNBOOK — Admin UI → Roles & Permissions
## Role and Permission Management Interface

**Purpose:**  
This runbook defines a safe, UI-focused implementation for Admin → Roles & Permissions management in a multi-tenant SaaS system. The UI must strictly consume existing backend APIs and must not introduce new authorization logic.

---

## Global Constraints

- ❌ Do not modify backend authorization or RBAC logic
- ❌ Do not introduce new permissions implicitly
- ❌ Do not bypass tenant isolation
- ❌ Do not allow cross-tenant role visibility
- ❌ Do not expose internal IDs unnecessarily
- ✅ Assume Roles, Permissions, and UserRole APIs already exist

---

## Capabilities Covered

- ✅ View roles for a tenant
- ✅ Create new roles
- ✅ Edit role permissions
- ✅ Assign roles to users
- ✅ Revoke roles from users
- ✅ Delete roles (with safeguards)

---

## Implementation Steps

### Step 1 — Roles List Page

**Route:** `/admin/roles`

**File:** `src/app/(dashboard)/admin/roles/page.tsx`

**Status:** ✅ Enhanced

**Behavior:**
- Fetches roles scoped to current tenant via `GET /api/admin/roles`
- Displays responsive layout (cards on mobile, table on desktop)

**Columns Displayed:**
| Column | Description |
|--------|-------------|
| Role | Name + SYSTEM badge if applicable |
| Description | Role description (truncated) |
| Permissions | Count of assigned permissions |
| Users | Count of users with this role |
| Created | Creation date (formatted) |
| Actions | Edit and Delete buttons |

**Features:**
- ✅ System role protection (cannot delete)
- ✅ User count display
- ✅ Delete confirmation modal
- ✅ Prevents deletion if role has users
- ✅ Responsive design
- ✅ Loading and error states

**Delete Safeguards:**
1. System roles cannot be deleted (button disabled)
2. Roles with assigned users cannot be deleted
3. Confirmation modal required
4. Clear warning message

---

### Step 2 — View Role Details

**Route:** `/admin/roles/[id]`

**File:** `src/app/(dashboard)/admin/roles/[id]/page.tsx`

**Status:** 🔄 To Be Implemented

**Behavior:**
- Fetch role details via `GET /api/admin/roles/[id]`
- Display read-only information:
  - Role name
  - Role description
  - System role indicator
  - Created date
  - Last modified date

**Sections:**

#### Assigned Permissions
- List all permissions assigned to role
- Display as read-only badges or list
- Show permission labels (not just codes)
- No inline editing

#### Assigned Users
- List users with this role
- Display email only (not full user details)
- Link to user detail page
- Show user count

**Actions:**
- "Edit Permissions" button → Navigate to edit page
- "Delete Role" button → Confirmation modal

---

### Step 3 — Create Role UI

**Route:** `/admin/roles/new`

**File:** `src/app/(dashboard)/admin/roles/new/page.tsx`

**Status:** 🔄 To Be Implemented

**Form Fields:**

1. **Role Name** (required)
   - Type: Text input
   - Validation: Non-empty, unique within tenant
   - Max length: 50 characters

2. **Role Description** (optional)
   - Type: Textarea
   - Max length: 200 characters

3. **Permission Selection** (required)
   - Type: Checkbox list
   - Fetched from `GET /api/admin/permissions`
   - Grouped by category (if available)
   - Search/filter capability
   - Select all/none buttons

**API Call:**
```typescript
POST /api/admin/roles
{
  "name": "Content Editor",
  "description": "Can create and edit content",
  "permissionIds": [1, 2, 5, 7]
}
```

**Behavior:**
1. User fills form
2. Selects permissions from list
3. Submits form
4. On success:
   - Redirect to role detail page
   - Show success message
5. On error:
   - Display error message
   - Keep form data

**Validation:**
- At least one permission must be selected
- Role name must be unique
- Generic error messages only

---

### Step 4 — Edit Role Permissions

**Route:** `/admin/roles/[id]/edit`

**File:** `src/app/(dashboard)/admin/roles/[id]/edit/page.tsx`

**Status:** 🔄 To Be Implemented

**Form Fields:**

1. **Role Name** (editable)
   - Pre-filled with current name
   - Validation: Non-empty, unique

2. **Role Description** (editable)
   - Pre-filled with current description

3. **Permission Selection** (editable)
   - Checkbox list with current permissions checked
   - Can add or remove permissions

**Warning Banner:**
> ⚠️ **Warning:** Changing permissions will affect all {userCount} users assigned to this role. Changes take effect immediately.

**Confirmation Modal:**
- Title: "Update Role Permissions"
- Message: "This will update permissions for all users with this role. Are you sure?"
- Buttons: Cancel, Confirm

**API Call:**
```typescript
PUT /api/admin/roles/[id]
{
  "name": "Content Editor",
  "description": "Updated description",
  "permissionIds": [1, 2, 5, 7, 9]
}
```

**Behavior:**
1. Load current role data
2. User modifies permissions
3. Click "Save Changes"
4. Confirmation modal appears
5. On confirm:
   - Submit API call
   - Redirect to role detail
   - Show success message

**System Role Protection:**
- System roles cannot be edited
- Show read-only view instead
- Display message: "System roles cannot be modified"

---

### Step 5 — Assign / Revoke Role to User

**Implementation Options:**

#### Option A: From User Detail Page
**Route:** `/admin/users/[id]/roles`

**Component:** Role assignment interface

**Features:**
- List current roles
- "Assign Role" button
- Modal with role selection
- "Revoke" button for each role

**Assign Flow:**
1. Click "Assign Role"
2. Modal shows available roles
3. Select role
4. Click "Assign"
5. API call: `POST /api/admin/users/[id]/roles`
6. Role appears in list

**Revoke Flow:**
1. Click "Revoke" on role
2. Confirmation modal
3. API call: `DELETE /api/admin/users/[id]/roles/[roleId]`
4. Role removed from list

#### Option B: From Role Detail Page
**Route:** `/admin/roles/[id]/users`

**Component:** User assignment interface

**Features:**
- List users with this role
- "Assign to User" button
- Modal with user selection
- "Remove" button for each user

**API Calls:**
```typescript
// Assign role to user
POST /api/admin/users/{userId}/roles
{
  "roleId": 5
}

// Revoke role from user
DELETE /api/admin/users/{userId}/roles/{roleId}
```

**Behavior:**
- Changes reflect immediately in UI
- No caching of authorization decisions
- Success/error messages shown
- List refreshes after action

---

### Step 6 — Delete Role Safeguards

**Implementation:** ✅ Complete (in roles list page)

**Safeguards:**

1. **System Role Protection**
   - Delete button disabled
   - Tooltip: "System roles cannot be deleted"
   - Visual indicator (grayed out)

2. **User Assignment Check**
   - If role has users, show error in modal
   - Message: "Cannot delete this role. It is assigned to {count} users."
   - Instruction: "Remove all user assignments before deleting."
   - Only "Close" button shown

3. **Confirmation Modal**
   - Title: "Delete Role"
   - Message: "Are you sure you want to delete '{roleName}'?"
   - Warning: "This action cannot be undone."
   - Buttons: Cancel, Delete Role (destructive)

**API Call:**
```typescript
DELETE /api/admin/roles/[id]
```

**Error Handling:**
- If role has users: 400 error
- If system role: 403 error
- Generic error message shown
- No backend details exposed

---

### Step 7 — Error Handling

**Error Display Strategy:**

1. **Generic Messages:**
   - "Failed to load roles"
   - "Failed to create role"
   - "Failed to update role"
   - "Failed to delete role"
   - "Failed to assign role"
   - "Failed to revoke role"

2. **No Backend Details:**
   - Stack traces hidden
   - Internal errors sanitized
   - Permission errors generic

3. **Error Placement:**
   - Page-level: Top banner
   - Form-level: Above form buttons
   - Field-level: Below affected field

4. **Permission Denied:**
   - Generic "Operation failed" message
   - No indication of missing permission
   - Logged server-side for admin review

**Status:** ✅ Implemented in enhanced roles page

---

## Audit Awareness (UI Only)

**UI Behavior:**
- ✅ Does NOT generate audit events
- ✅ Does NOT write audit data
- ✅ Actions trigger backend APIs only
- ✅ Backend emits audit events automatically

**Server-Side Audit Events (Automatic):**
- `ROLE.CREATE` - When role created
- `ROLE.UPDATE` - When role updated
- `ROLE.DELETE` - When role deleted
- `ROLE.ASSIGN` - When role assigned to user
- `ROLE.REVOKE` - When role revoked from user

**UI Responsibility:**
- None - audit logging is purely server-side

---

## User Interface Flows

### Flow 1: Create New Role

```
1. Admin navigates to /admin/roles
   ↓
2. Clicks "Create Role" button
   ↓
3. Form page opens (/admin/roles/new)
   ↓
4. Admin enters:
   - Name: "Content Editor"
   - Description: "Can create and edit content"
   - Permissions: [CREATE_CONTENT, EDIT_CONTENT, VIEW_CONTENT]
   ↓
5. Clicks "Create Role"
   ↓
6. API call: POST /api/admin/roles
   ↓
7. Success:
   - Redirect to role detail page
   - Success message shown
   ↓
8. Role appears in roles list
```

### Flow 2: Edit Role Permissions

```
1. Admin clicks "Edit" on role
   ↓
2. Edit page opens (/admin/roles/123/edit)
   ↓
3. Current permissions shown (checked)
   ↓
4. Admin adds/removes permissions
   ↓
5. Warning banner shows user count
   ↓
6. Clicks "Save Changes"
   ↓
7. Confirmation modal appears:
   "This will update permissions for all X users"
   ↓
8. Admin clicks "Confirm"
   ↓
9. API call: PUT /api/admin/roles/123
   ↓
10. Success:
    - Redirect to role detail
    - All users with role get new permissions immediately
```

### Flow 3: Delete Role (Success)

```
1. Admin clicks "Delete" on role
   ↓
2. Confirmation modal opens
   ↓
3. Modal shows:
   - Role name
   - Warning message
   - Delete button (red)
   ↓
4. Admin clicks "Delete Role"
   ↓
5. API call: DELETE /api/admin/roles/123
   ↓
6. Success:
   - Modal closes
   - Role removed from list
   - Success message shown
```

### Flow 4: Delete Role (Blocked - Has Users)

```
1. Admin clicks "Delete" on role
   ↓
2. Confirmation modal opens
   ↓
3. Modal shows:
   - Error message
   - "Cannot delete - assigned to 5 users"
   - Only "Close" button
   ↓
4. Admin must:
   - Remove all user assignments first
   - Then try delete again
```

### Flow 5: Assign Role to User

```
1. Admin navigates to user detail page
   ↓
2. Clicks "Assign Role" button
   ↓
3. Modal shows available roles
   ↓
4. Admin selects "Content Editor"
   ↓
5. Clicks "Assign"
   ↓
6. API call: POST /api/admin/users/456/roles
   ↓
7. Success:
   - Modal closes
   - Role appears in user's role list
   - User immediately gets new permissions
```

---

## Component Architecture

### Page: `RolesPage` (List)

**Status:** ✅ Enhanced

**Responsibilities:**
- Fetch and display roles
- Handle delete action
- Show delete confirmation

**State:**
```typescript
roles: Role[]
loading: boolean
error: string
deleteModal: {
  isOpen: boolean
  role: Role | null
}
```

**Functions:**
- `loadRoles()` - Fetch roles
- `handleDelete(roleId)` - Delete role
- `formatDate(date)` - Format creation date

---

### Page: `RoleDetailPage`

**Status:** 🔄 To Be Implemented

**Responsibilities:**
- Display role information
- Show assigned permissions
- List assigned users
- Navigate to edit page

**State:**
```typescript
role: Role | null
permissions: Permission[]
users: User[]
loading: boolean
error: string
```

---

### Page: `CreateRolePage`

**Status:** 🔄 To Be Implemented

**Responsibilities:**
- Render role creation form
- Fetch available permissions
- Validate input
- Submit to API

**State:**
```typescript
name: string
description: string
selectedPermissions: number[]
availablePermissions: Permission[]
loading: boolean
error: string
```

---

### Page: `EditRolePage`

**Status:** 🔄 To Be Implemented

**Responsibilities:**
- Load current role data
- Allow permission modification
- Show warning about user impact
- Confirm before saving

**State:**
```typescript
role: Role | null
name: string
description: string
selectedPermissions: number[]
availablePermissions: Permission[]
showConfirm: boolean
loading: boolean
error: string
```

---

### Component: `DeleteConfirmModal`

**Status:** ✅ Implemented

**Props:**
```typescript
{
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  role: Role | null
}
```

**Behavior:**
- Shows role name
- Checks user count
- Blocks deletion if users assigned
- Requires confirmation

---

## API Integration

### GET /api/admin/roles
**Purpose:** Fetch all roles in tenant

**Response:**
```typescript
{
  id: number
  name: string
  description: string
  isSystem: boolean
  permissions: string[]
  userCount: number
  createdAt: string
}[]
```

---

### GET /api/admin/roles/[id]
**Purpose:** Fetch single role details

**Response:**
```typescript
{
  id: number
  name: string
  description: string
  isSystem: boolean
  permissions: {
    id: number
    name: string
    description: string
  }[]
  users: {
    id: number
    email: string
  }[]
  createdAt: string
  updatedAt: string
}
```

---

### POST /api/admin/roles
**Purpose:** Create new role

**Request:**
```typescript
{
  name: string
  description: string
  permissionIds: number[]
}
```

**Response:**
```typescript
{
  message: string
  role: {
    id: number
    name: string
    description: string
  }
}
```

---

### PUT /api/admin/roles/[id]
**Purpose:** Update role

**Request:**
```typescript
{
  name: string
  description: string
  permissionIds: number[]
}
```

**Response:**
```typescript
{
  message: string
  role: {
    id: number
    name: string
    description: string
  }
}
```

---

### DELETE /api/admin/roles/[id]
**Purpose:** Delete role

**Response:**
```typescript
{
  message: string
}
```

**Errors:**
- 400: Role has assigned users
- 403: System role cannot be deleted
- 404: Role not found

---

### GET /api/admin/permissions
**Purpose:** Fetch available permissions

**Response:**
```typescript
{
  id: number
  name: string
  description: string
  category?: string
}[]
```

---

### POST /api/admin/users/[id]/roles
**Purpose:** Assign role to user

**Request:**
```typescript
{
  roleId: number
}
```

---

### DELETE /api/admin/users/[id]/roles/[roleId]
**Purpose:** Revoke role from user

---

## Responsive Design

### Mobile View (< 1024px)
- Card-based layout
- Stacked information
- Touch-friendly buttons
- Scrollable permission lists

### Desktop View (≥ 1024px)
- Table layout
- Columns: Role, Description, Permissions, Users, Created, Actions
- Hover effects
- Inline actions

---

## Success Criteria

### Role Management
- ✅ Admins can manage roles without touching auth flows
- ✅ UI reflects real permission state accurately
- ✅ No backend behavior duplicated in UI
- ✅ Tenant isolation preserved (enforced by API)

### User Experience
- ✅ Clear visual indicators
- ✅ Confirmation before destructive actions
- ✅ Responsive design
- ✅ Loading states shown
- ✅ Errors handled gracefully

### Security
- ✅ System roles protected
- ✅ Generic error messages
- ✅ No audit log exposure
- ✅ Permission checks server-side
- ✅ No cross-tenant access

---

## Out of Scope

The following are explicitly **NOT** included:

- ❌ Permission creation or deletion
- ❌ Policy-based authorization
- ❌ Cross-tenant role templates
- ❌ Bulk role assignment
- ❌ Role hierarchy
- ❌ Conditional permissions
- ❌ Time-based permissions
- ❌ Role approval workflows
- ❌ Permission inheritance
- ❌ Custom permission logic

---

## Testing Checklist

### Roles List
- [x] Roles displayed in table (desktop)
- [x] Roles displayed in cards (mobile)
- [x] System roles show badge
- [x] User count displayed
- [x] Created date formatted
- [x] "Create Role" button navigates
- [x] "Edit" link navigates
- [x] "Delete" button disabled for system roles
- [x] Delete confirmation modal works

### Create Role
- [ ] Form fields validate
- [ ] Permissions fetched and displayed
- [ ] Multiple permissions selectable
- [ ] Submit creates role
- [ ] Success redirects to detail
- [ ] Error displays in form
- [ ] Cancel returns to list

### Edit Role
- [ ] Current data pre-filled
- [ ] Permissions pre-checked
- [ ] Warning banner shows user count
- [ ] Confirmation modal appears
- [ ] Submit updates role
- [ ] System roles cannot be edited
- [ ] Changes affect all users immediately

### Delete Role
- [x] System roles cannot be deleted
- [x] Roles with users cannot be deleted
- [x] Confirmation required
- [x] Success removes from list
- [x] Error handled gracefully

### Role Assignment
- [ ] Can assign role to user
- [ ] Can revoke role from user
- [ ] Changes reflect immediately
- [ ] Confirmation required for revoke
- [ ] Error messages shown

### Error Handling
- [x] Network errors shown generically
- [x] Permission errors handled
- [x] Invalid data errors shown
- [x] No backend details exposed

---

## Implementation Status

### Completed ✅
1. **Roles List Page** - Enhanced with delete confirmation, user count, created date
2. **Delete Confirmation Modal** - With user assignment check
3. **Error Handling** - Generic messages, no backend exposure
4. **Responsive Design** - Mobile cards, desktop table

### To Be Implemented 🔄
1. **Role Detail Page** - View role, permissions, users
2. **Create Role Page** - Form with permission selection
3. **Edit Role Page** - Update permissions with confirmation
4. **Role Assignment UI** - Assign/revoke from user or role page

---

## Deployment

### Prerequisites
- ✅ Backend role APIs exist
- ✅ Backend permission APIs exist
- ✅ Backend user-role APIs exist
- ✅ Tenant isolation enforced
- ✅ Audit logging in place

### Deployment Steps
1. **Deploy enhanced roles list page** ✅
2. **Deploy role detail page** 🔄
3. **Deploy create role page** 🔄
4. **Deploy edit role page** 🔄
5. **Deploy role assignment UI** 🔄

### Verification
- Test role CRUD operations
- Verify system role protection
- Check user assignment blocking
- Test responsive design
- Verify error handling

---

## Outcome

✅ **Partial Implementation Complete**

### What Was Built:
- Enhanced roles list page
- Delete confirmation with safeguards
- User count and created date display
- Responsive design
- Error handling

### What Remains:
- Role detail page
- Create role page
- Edit role page
- Role assignment UI

### What Was NOT Changed:
- Backend APIs (consumed as-is)
- Authorization logic
- Audit logging
- Tenant isolation
- Permission system

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-29  
**Status:** Partial Implementation (List Page Complete)  
**Dependencies:** Backend Role/Permission APIs
