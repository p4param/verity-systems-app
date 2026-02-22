- [x] Implement Tenant Identity Resolution <!-- id: 0 -->
    - [x] Update `POST /api/auth/login` to use `findMany` and check for duplicates <!-- id: 1 -->
    - [x] Update `POST /api/auth/forgot-password` to use `findMany` and check for duplicates <!-- id: 2 -->
    - [x] Verify changes with manual review <!-- id: 3 -->

# Task: Fix Tenant Isolation Leaks

- [x] Fix Tenant Isolation Leaks <!-- id: 4 -->
    - [x] Fix Global Data Leak in `GET /api/admin/users` <!-- id: 5 -->
    - [x] Fix Hardcoded Tenant in `GET /api/admin/roles` <!-- id: 6 -->
    - [x] Verify changes <!-- id: 7 -->

# Task: DMS Audit & Share Fixes (Post-Verification)

- [x] Fix Audit Page "Entity" Column Display <!-- id: 8 -->
    - [x] Add missing `entityType`, `entityId`, `metadata` to `FolderService` (create/update/delete) <!-- id: 9 -->
    - [x] Add missing `entityType`, `entityId`, `metadata` to `DocumentService` (update/delete) <!-- [x] Part 4: Permissions
    - [x] Add `LEGAL_HOLD_VIEW`, `LEGAL_HOLD_CREATE`, `LEGAL_HOLD_ATTACH`, `LEGAL_HOLD_RELEASE` to `permission-codes.ts`
    - [x] Update seeding scripts to include new permissions
- [x] Part 5: Retention & Expiry Integration
    - [x] Modify `getEffectiveDocumentStatus` to respect `isUnderLegalHold`
    - [x] Ensure document retention jobs skip held documents
- [x] Part 6: Audit Events
    - [x] Update `audit-formatter.ts` for new Legal Hold event types
- [/] Part 7: UI Implementation
    - [x] Admin console page for Legal Holds
    - [x] Document detail indicator/badge
    - [ ] Target attachment/release UI details
- [ ] Part 8: Comprehensive Testing
