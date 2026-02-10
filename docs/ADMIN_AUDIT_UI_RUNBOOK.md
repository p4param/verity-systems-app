# AG RUNBOOK — Admin UI → Audit Viewer
## Read-Only Audit Event Viewer

**Purpose:**  
This runbook defines a safe, UI-only implementation for the Admin Audit Viewer. It allows administrators and auditors to review audit events without any ability to modify data. The UI must strictly consume existing read-only audit APIs.

---

## Global Constraints

- ❌ Do not modify backend audit schema or APIs
- ❌ Do not introduce write, update, or delete operations
- ❌ Do not bypass tenant isolation
- ❌ Do not expose cross-tenant data
- ❌ Do not allow filtering by arbitrary fields
- ✅ Assume Phase 6 (Audit & Observability) is complete

---

## Capabilities Covered

- ✅ View audit events for the current tenant
- ✅ Filter audit events safely
- ✅ Paginate results
- ✅ Inspect event details (read-only)
- ✅ Copy correlation IDs

---

## Implementation Steps

### Step 1 — Audit Viewer Page

**Route:** `/admin/audit`

**File:** `src/app/(dashboard)/admin/audit/page.tsx`

**Status:** ✅ Complete

**Behavior:**
- Fetches audit events from `GET /api/admin/audit-events`
- Scoped strictly to authenticated tenant (enforced by API)
- Always paginated (50 events per page)
- Default sort: newest first

**Columns Displayed:**

| Column | Description | Format |
|--------|-------------|--------|
| Timestamp | When event occurred | MMM DD, HH:MM |
| Action | Audit action type | Monospace badge |
| Actor | User who performed action | Email + type |
| Target | Resource affected | Type + ID |
| IP Address | Source IP | Monospace |
| Correlation ID | Request correlation ID | Truncated + copyable |

**Features:**
- ✅ Responsive design (cards on mobile, table on desktop)
- ✅ Click row to view full details
- ✅ Copy correlation ID with one click
- ✅ Loading and error states
- ✅ Empty state with helpful message

---

### Step 2 — Safe Filters

**Status:** ✅ Complete

**Allowed Filters Only:**

1. **Action** (exact match)
   - Type: Text input
   - Example: `USER.CREATE`, `SESSION.LOGIN`
   - No wildcards or regex

2. **Actor Email** (exact match)
   - Type: Email input
   - Example: `admin@example.com`
   - No partial matching

3. **Date Range**
   - Date From: Date picker
   - Date To: Date picker
   - Both optional

**Filter Rules:**
- ✅ No free-text search across all fields
- ✅ No JSON metadata querying
- ✅ No cross-tenant filters
- ✅ Filters applied via query parameters
- ✅ Clear visual indicator when filters active

**Filter UI:**
- Collapsible filter panel
- "Apply Filters" button
- "Clear" button to reset
- Active filter count badge

---

### Step 3 — Event Detail View

**Status:** ✅ Complete

**Implementation:** Modal dialog

**Displayed Information:**

1. **Action** - Audit action type (monospace)
2. **Actor Type** - System, User, Admin, etc.
3. **Actor Email** - Email address (if available)
4. **Target Type** - Resource type (if applicable)
5. **Target ID** - Resource ID (if applicable)
6. **Timestamp** - Full date and time
7. **IP Address** - Source IP (monospace)
8. **Correlation ID** - Full ID with copy button
9. **Metadata** - JSON formatted, read-only

**Features:**
- ✅ Read-only display (no editing)
- ✅ JSON metadata formatted with syntax highlighting
- ✅ Copy correlation ID button
- ✅ Close button
- ✅ Scrollable content
- ✅ Responsive design

**No Editing or Deletion:**
- No edit buttons
- No delete buttons
- No modification capabilities
- Pure read-only view

---

### Step 4 — Pagination

**Status:** ✅ Complete

**Implementation:** Page-based pagination

**Features:**
- ✅ 50 events per page
- ✅ "Previous" and "Next" buttons
- ✅ Current page number display
- ✅ Disabled state when no more pages
- ✅ Resets to page 1 when filters change

**Not Implemented:**
- ❌ Infinite scrolling (by design)
- ❌ Jump to page
- ❌ Configurable page size

**Behavior:**
- Previous button disabled on page 1
- Next button disabled when no more results
- Page number persists during filtering
- Loading state shown during page changes

---

### Step 5 — Empty & Error States

**Status:** ✅ Complete

**Empty State:**
- Icon: FileText
- Message: "No audit events found"
- Context-aware:
  - With filters: "Try adjusting your filters"
  - Without filters: "Events will appear as actions are performed"

**Error State:**
- Red banner at top of page
- Generic error message
- No backend error details exposed
- Examples:
  - "Failed to load audit events"
  - "Operation failed"

**Loading State:**
- Centered loading message
- "Loading audit events..."
- Shown during initial load and pagination

---

## Audit Awareness (UI Only)

**UI Behavior:**
- ✅ UI never writes audit events
- ✅ UI never infers or calculates audit data
- ✅ All audit integrity guarantees enforced server-side
- ✅ UI is purely a read-only viewer

**Server-Side Guarantees:**
- Immutable audit logs
- Tenant isolation
- Timestamp integrity
- Correlation ID tracking

**UI Responsibility:**
- Display data only
- No data manipulation
- No audit event creation

---

## User Interface Flows

### Flow 1: View Audit Events

```
1. Admin navigates to /admin/audit
   ↓
2. Page loads with recent events (page 1)
   ↓
3. Events displayed in table (desktop) or cards (mobile)
   ↓
4. Admin can:
   - Scroll through events
   - Click "Next" for more
   - Click row to view details
```

### Flow 2: Filter Events

```
1. Admin clicks "Filters" button
   ↓
2. Filter panel expands
   ↓
3. Admin enters criteria:
   - Action: "USER.CREATE"
   - Date From: 2026-01-01
   ↓
4. Clicks "Apply Filters"
   ↓
5. Page reloads with filtered results
   ↓
6. Filter count badge shows (2)
   ↓
7. Admin can clear filters anytime
```

### Flow 3: View Event Details

```
1. Admin clicks on event row
   ↓
2. Modal opens with full details
   ↓
3. Admin can:
   - Read all event data
   - Copy correlation ID
   - View formatted JSON metadata
   ↓
4. Clicks "Close" to return to list
```

### Flow 4: Copy Correlation ID

```
1. Admin hovers over correlation ID
   ↓
2. Copy button appears
   ↓
3. Clicks copy button
   ↓
4. ID copied to clipboard
   ↓
5. Check icon shows briefly (2 seconds)
   ↓
6. Can paste ID elsewhere for investigation
```

---

## Component Architecture

### Page: `AuditViewerPage`

**Responsibilities:**
- Fetch and display audit events
- Manage pagination
- Handle filtering
- Show event details

**State:**
```typescript
events: AuditEvent[]
loading: boolean
error: string
selectedEvent: AuditEvent | null
showFilters: boolean
filters: FilterState
appliedFilters: FilterState
page: number
hasMore: boolean
copiedId: string | null
```

**Functions:**
- `loadEvents(page)` - Fetch events with filters
- `handleApplyFilters()` - Apply filter changes
- `handleClearFilters()` - Reset all filters
- `copyToClipboard(text, id)` - Copy correlation ID
- `formatDate(date)` - Format timestamp

---

### Component: `EventDetailModal`

**Props:**
```typescript
{
  isOpen: boolean
  onClose: () => void
  event: AuditEvent | null
}
```

**Responsibilities:**
- Display full event details
- Format JSON metadata
- Allow correlation ID copying
- Provide close action

**State:**
```typescript
copiedField: string | null
```

**Functions:**
- `copyToClipboard(text, field)` - Copy with feedback
- `formatDate(date)` - Full date formatting
- `formatMetadata(details)` - JSON formatting

---

## API Integration

### GET /api/admin/audit-events

**Purpose:** Fetch audit events for tenant

**Query Parameters:**
```typescript
{
  page?: number          // Page number (default: 1)
  limit?: number         // Events per page (default: 50)
  action?: string        // Filter by action
  actorEmail?: string    // Filter by actor email
  dateFrom?: string      // Filter by start date (ISO)
  dateTo?: string        // Filter by end date (ISO)
}
```

**Response:**
```typescript
{
  events: {
    id: string
    action: string
    actorUserId: number | null
    actorEmail: string | null
    actorType: string
    targetType: string | null
    targetId: number | null
    ipAddress: string
    correlationId: string | null
    details: string | null  // JSON string
    createdAt: string       // ISO timestamp
  }[]
  hasMore: boolean
}
```

**Tenant Scoping:**
- Automatically scoped to authenticated user's tenant
- No cross-tenant access possible
- Enforced server-side

---

## Responsive Design

### Mobile View (< 1024px)
- Card-based layout
- Stacked information
- Tap to view details
- Scrollable cards
- Touch-friendly buttons

### Desktop View (≥ 1024px)
- Full table layout
- 6 columns displayed
- Click row to view details
- Hover effects
- Inline copy buttons

---

## Success Criteria

### Audit Viewing
- ✅ Admins can review tenant audit history safely
- ✅ Audit data is immutable and read-only
- ✅ UI does not impact performance or security
- ✅ Tenant boundaries strictly preserved

### User Experience
- ✅ Clear, scannable event list
- ✅ Easy filtering
- ✅ Quick detail access
- ✅ Correlation ID copying
- ✅ Responsive design

### Security
- ✅ Read-only access only
- ✅ No data modification
- ✅ Tenant isolation enforced
- ✅ Generic error messages
- ✅ No sensitive data exposure

---

## Out of Scope

The following are explicitly **NOT** included:

- ❌ CSV or PDF export
- ❌ Cross-tenant audit views
- ❌ System-level audit dashboards
- ❌ Alerting or notifications
- ❌ Advanced analytics
- ❌ Audit event creation
- ❌ Audit event modification
- ❌ Audit event deletion
- ❌ Custom audit queries
- ❌ Audit data aggregation
- ❌ Real-time event streaming
- ❌ Audit event search (beyond safe filters)

---

## Testing Checklist

### Event List
- [x] Events load on page load
- [x] Events display in table (desktop)
- [x] Events display in cards (mobile)
- [x] Pagination works (next/previous)
- [x] Page number displayed
- [x] Loading state shown
- [x] Empty state shown when no events

### Filtering
- [x] Filter panel toggles
- [x] Action filter works
- [x] Actor email filter works
- [x] Date range filter works
- [x] Apply filters reloads data
- [x] Clear filters resets
- [x] Active filter count shown
- [x] Filters reset pagination

### Event Details
- [x] Click row opens modal
- [x] All fields displayed
- [x] JSON metadata formatted
- [x] Correlation ID copyable
- [x] Close button works
- [x] Modal scrollable
- [x] Responsive design

### Correlation ID Copy
- [x] Copy button visible
- [x] Click copies to clipboard
- [x] Check icon shows on success
- [x] Feedback disappears after 2s
- [x] Works in table view
- [x] Works in detail modal

### Error Handling
- [x] Network errors shown
- [x] Generic error messages
- [x] No backend details exposed
- [x] Error doesn't break UI

### Responsive Design
- [x] Mobile view uses cards
- [x] Desktop view uses table
- [x] Modal works on mobile
- [x] Touch targets adequate
- [x] Scrolling works properly

---

## Performance Considerations

### Optimization Strategies
- ✅ Pagination limits data fetched
- ✅ No infinite scrolling (prevents memory issues)
- ✅ Filters applied server-side
- ✅ Minimal client-side processing

### Loading States
- ✅ Initial page load
- ✅ Pagination navigation
- ✅ Filter application

### Data Handling
- ✅ Events fetched on demand
- ✅ No caching (ensures fresh data)
- ✅ JSON parsing only when viewing details

---

## Security Considerations

### Read-Only Access
- ✅ No write operations
- ✅ No update operations
- ✅ No delete operations
- ✅ Pure viewing only

### Tenant Isolation
- ✅ Events scoped to tenant (API enforced)
- ✅ No cross-tenant queries
- ✅ No tenant ID exposure

### Data Exposure
- ✅ Only authorized admins can access
- ✅ Generic error messages
- ✅ No stack traces
- ✅ No internal IDs unnecessarily exposed

### Filter Safety
- ✅ No SQL injection risk (parameterized)
- ✅ No arbitrary field filtering
- ✅ Whitelist of allowed filters
- ✅ Server-side validation

---

## Future Enhancements (Not in Scope)

### Potential Additions
1. **Export Functionality**
   - CSV export
   - PDF report generation
   - Date range selection

2. **Advanced Filtering**
   - Multiple action selection
   - Target type filtering
   - Correlation ID search

3. **Analytics Dashboard**
   - Event count by action
   - Activity timeline
   - Top actors

4. **Real-Time Updates**
   - WebSocket connection
   - Live event streaming
   - Auto-refresh option

5. **Saved Filters**
   - Save filter presets
   - Quick filter selection
   - Shared filter templates

---

## Deployment

### Prerequisites
- ✅ Phase 6 (Audit & Observability) complete
- ✅ Audit API endpoint exists
- ✅ Tenant isolation enforced
- ✅ Admin permissions configured

### Deployment Steps
1. **Deploy audit viewer page** ✅
2. **Verify API integration**
3. **Test filtering**
4. **Test pagination**
5. **Test responsive design**

### Verification
- Load audit page
- Verify events display
- Test all filters
- Test pagination
- Test event details
- Test correlation ID copy
- Verify mobile view

---

## Troubleshooting

### Events Not Loading
- Check API endpoint availability
- Verify authentication
- Check tenant isolation
- Review network errors

### Filters Not Working
- Verify query parameters
- Check API filter support
- Review filter validation
- Test with simple filters

### Pagination Issues
- Check hasMore flag
- Verify page parameter
- Review API response
- Test edge cases

### Modal Not Opening
- Check event selection state
- Verify modal component
- Review click handlers
- Test on different devices

---

## Outcome

✅ **Complete, secure, read-only audit viewer**

### What Was Built:
- Audit events list page
- Safe filtering system
- Pagination controls
- Event detail modal
- Correlation ID copying
- Responsive design
- Error handling

### What Was NOT Changed:
- Backend audit APIs (consumed as-is)
- Audit schema
- Audit logging system
- Tenant isolation
- Permission system

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-29  
**Status:** Implementation Complete  
**Dependencies:** Phase 6 (Audit & Observability)
