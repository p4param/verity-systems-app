# Task: Implement Tenant Identity Resolution

- [x] Implement Tenant Identity Resolution <!-- id: 0 -->
    - [x] Update `POST /api/auth/login` to use `findMany` and check for duplicates <!-- id: 1 -->
    - [x] Update `POST /api/auth/forgot-password` to use `findMany` and check for duplicates <!-- id: 2 -->
    - [x] Verify changes with manual review <!-- id: 3 -->

# Task: Fix Tenant Isolation Leaks

- [x] Fix Tenant Isolation Leaks <!-- id: 4 -->
    - [x] Fix Global Data Leak in `GET /api/admin/users` <!-- id: 5 -->
    - [x] Fix Hardcoded Tenant in `GET /api/admin/roles` <!-- id: 6 -->
    - [x] Verify changes <!-- id: 7 -->
