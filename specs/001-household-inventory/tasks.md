# Tasks: Household Inventory Management System

**Input**: Design documents from `/specs/001-household-inventory/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included based on the constitution's Test-First Development principle. All tests must be written and verified to fail before implementing the corresponding functionality.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`, `backend/tests/`
- **Frontend**: `frontend/src/`, `frontend/tests/`
- **Infrastructure**: `infrastructure/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create backend/ directory structure with src/ and tests/ subdirectories
- [ ] T002 Create frontend/ directory structure with src/, tests/, and public/ subdirectories
- [ ] T003 Create infrastructure/ directory with kubernetes/ and docker-compose.yml
- [ ] T004 [P] Initialize backend Python project with requirements.txt and pyproject.toml
- [ ] T005 [P] Initialize frontend Node.js project with package.json and tsconfig.json
- [ ] T006 [P] Create docker-compose.yml with PostgreSQL, Redis, and Mail services in infrastructure/
- [ ] T007 [P] Create .env.example files for backend/ and frontend/ with configuration templates
- [ ] T008 [P] Setup backend linting configuration (black, mypy, flake8) in backend/pyproject.toml
- [ ] T009 [P] Setup frontend linting configuration (ESLint, Prettier) in frontend/.eslintrc.js
- [ ] T010 [P] Create Dockerfile for backend in backend/Dockerfile
- [ ] T011 [P] Create Dockerfile for frontend in frontend/Dockerfile

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T012 Create FastAPI application entry point in backend/src/main.py with basic app setup
- [ ] T013 Create configuration management in backend/src/config.py for environment variables
- [ ] T014 Setup SQLAlchemy base and session management in backend/src/db/base.py and backend/src/db/session.py
- [ ] T015 Initialize Alembic for database migrations in backend/src/db/migrations/
- [ ] T016 Create initial Alembic migration for all tables in backend/src/db/migrations/versions/001_initial.py
- [ ] T017 [P] Create Redis cache service wrapper in backend/src/cache/cache_service.py
- [ ] T018 [P] Setup structured logging with structlog in backend/src/utils/logging.py
- [ ] T019 [P] Create custom exception classes in backend/src/utils/exceptions.py
- [ ] T020 [P] Create security utilities (password hashing, JWT) in backend/src/utils/security.py
- [ ] T021 Create Category model (seed data: Produce, Dairy, Meat, etc.) in backend/src/models/category.py
- [ ] T022 Create Location model (seed data: Refrigerator, Freezer, Pantry, etc.) in backend/src/models/location.py
- [ ] T023 [P] Create seed script for categories and locations in backend/src/db/seed.py
- [ ] T024 [P] Setup pytest configuration and fixtures in backend/tests/conftest.py
- [ ] T025 [P] Create test database utilities in backend/tests/utils.py
- [ ] T026 [P] Setup Vitest configuration in frontend/vitest.config.ts
- [ ] T027 [P] Setup Playwright configuration for E2E tests in frontend/playwright.config.ts
- [ ] T028 Create React app entry point in frontend/src/main.tsx with router setup
- [ ] T029 Create App component with basic layout in frontend/src/App.tsx
- [ ] T030 [P] Setup Tailwind CSS configuration in frontend/tailwind.config.js
- [ ] T031 [P] Create Axios API client base configuration in frontend/src/services/api.ts
- [ ] T032 [P] Create authentication store with Zustand in frontend/src/stores/authStore.ts
- [ ] T033 Create API dependency injection helpers in backend/src/api/deps.py (get_db, get_current_user)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Manual Inventory Addition (Priority: P1) 🎯 MVP

**Goal**: Enable users to manually add food items to inventory (foundation of the system)

**Independent Test**: Create user account, login, manually enter item details (name, quantity, expiration, location), verify item appears in inventory list

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T034 [P] [US1] Create contract test for POST /api/v1/households/{id}/inventory in backend/tests/contract/test_inventory_api.py
- [ ] T035 [P] [US1] Create integration test for complete add item flow in backend/tests/integration/test_inventory_flow.py
- [ ] T036 [P] [US1] Create E2E test for manual item addition in frontend/tests/e2e/inventory.spec.ts

### Implementation for User Story 1

- [ ] T037 [P] [US1] Create User model in backend/src/models/user.py
- [ ] T038 [P] [US1] Create Household model in backend/src/models/household.py
- [ ] T039 [P] [US1] Create HouseholdMembership model in backend/src/models/household_membership.py
- [ ] T040 [US1] Create InventoryItem model in backend/src/models/inventory_item.py (depends on T037, T038, T021, T022)
- [ ] T041 [P] [US1] Create User Pydantic schemas in backend/src/schemas/user.py
- [ ] T042 [P] [US1] Create Household Pydantic schemas in backend/src/schemas/household.py
- [ ] T043 [P] [US1] Create InventoryItem Pydantic schemas in backend/src/schemas/inventory.py
- [ ] T044 [P] [US1] Create RefreshToken model for JWT refresh in backend/src/models/refresh_token.py
- [ ] T045 [US1] Implement AuthService with registration and login in backend/src/services/auth_service.py (depends on T037, T044)
- [ ] T046 [US1] Implement HouseholdService with create household in backend/src/services/household_service.py (depends on T038, T039)
- [ ] T047 [US1] Implement InventoryService with create item method in backend/src/services/inventory_service.py (depends on T040)
- [ ] T048 [US1] Create authentication endpoints (register, login, refresh) in backend/src/api/v1/auth.py (depends on T045)
- [ ] T049 [US1] Create household endpoints (create household) in backend/src/api/v1/households.py (depends on T046)
- [ ] T050 [US1] Create inventory endpoint (POST create item) in backend/src/api/v1/inventory.py (depends on T047)
- [ ] T051 [P] [US1] Create Login page component in frontend/src/pages/Login.tsx
- [ ] T052 [P] [US1] Create Register page component in frontend/src/pages/Register.tsx
- [ ] T053 [P] [US1] Create AddItem page component in frontend/src/pages/AddItem.tsx
- [ ] T054 [P] [US1] Create AddItemForm component in frontend/src/components/inventory/AddItemForm.tsx
- [ ] T055 [P] [US1] Create authentication API service in frontend/src/services/auth.ts
- [ ] T056 [P] [US1] Create household API service in frontend/src/services/household.ts
- [ ] T057 [US1] Create inventory API service with create method in frontend/src/services/inventory.ts
- [ ] T058 [US1] Add validation for item fields (quantity > 0, name length, expiration date format) in backend/src/schemas/inventory.py
- [ ] T059 [US1] Add error handling for duplicate items (prompt to update quantity) in backend/src/services/inventory_service.py
- [ ] T060 [US1] Add responsive form styling for mobile devices in frontend/src/components/inventory/AddItemForm.tsx
- [ ] T061 [US1] Add logging for item creation events in backend/src/services/inventory_service.py

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - View and Search Inventory (Priority: P1)

**Goal**: Enable users to view and search their inventory

**Independent Test**: Add several items, search by name, filter by category/location, sort by expiration, verify results are accurate and responsive

### Tests for User Story 2

- [ ] T062 [P] [US2] Create contract test for GET /api/v1/households/{id}/inventory with filters in backend/tests/contract/test_inventory_api.py
- [ ] T063 [P] [US2] Create contract test for GET /api/v1/households/{id}/inventory/search in backend/tests/contract/test_inventory_api.py
- [ ] T064 [P] [US2] Create integration test for inventory list with pagination in backend/tests/integration/test_inventory_flow.py
- [ ] T065 [P] [US2] Create E2E test for search and filter functionality in frontend/tests/e2e/inventory.spec.ts

### Implementation for User Story 2

- [ ] T066 [US2] Add list_inventory method with pagination to InventoryService in backend/src/services/inventory_service.py
- [ ] T067 [US2] Add search_inventory method with fuzzy name matching to InventoryService in backend/src/services/inventory_service.py
- [ ] T068 [US2] Add filter and sort support (category, location, expiration) to InventoryService in backend/src/services/inventory_service.py
- [ ] T069 [US2] Implement GET list inventory endpoint with query params in backend/src/api/v1/inventory.py
- [ ] T070 [US2] Implement GET search endpoint with real-time results in backend/src/api/v1/inventory.py
- [ ] T071 [P] [US2] Create Inventory page component in frontend/src/pages/Inventory.tsx
- [ ] T072 [P] [US2] Create InventoryList component with pagination in frontend/src/components/inventory/InventoryList.tsx
- [ ] T073 [P] [US2] Create InventoryItem card component in frontend/src/components/inventory/InventoryItem.tsx
- [ ] T074 [P] [US2] Create SearchBar component with debounced input in frontend/src/components/inventory/SearchBar.tsx
- [ ] T075 [P] [US2] Create FilterPanel component (category, location, expiration) in frontend/src/components/inventory/FilterPanel.tsx
- [ ] T076 [US2] Add list and search methods to inventory API service in frontend/src/services/inventory.ts
- [ ] T077 [US2] Create inventory store with Zustand for client-side caching in frontend/src/stores/inventoryStore.ts
- [ ] T078 [US2] Add GIN index for fuzzy text search on inventory_item.name (pg_trgm extension) via Alembic migration
- [ ] T079 [US2] Add composite indexes for filtering (household_id + category_id, household_id + location_id) via Alembic migration
- [ ] T080 [US2] Add responsive grid layout for tablet and mobile in frontend/src/pages/Inventory.tsx
- [ ] T081 [US2] Add logging for search queries and filter usage in backend/src/services/inventory_service.py

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Inventory Updates and Management (Priority: P1)

**Goal**: Enable users to update item quantities, edit details, and delete items

**Independent Test**: Edit item quantity, change expiration/location, mark as consumed, verify changes persist and are visible

### Tests for User Story 3

- [ ] T082 [P] [US3] Create contract test for PUT /api/v1/households/{id}/inventory/{itemId} in backend/tests/contract/test_inventory_api.py
- [ ] T083 [P] [US3] Create contract test for DELETE /api/v1/households/{id}/inventory/{itemId} in backend/tests/contract/test_inventory_api.py
- [ ] T084 [P] [US3] Create integration test for concurrent updates by multiple users in backend/tests/integration/test_multiuser.py
- [ ] T085 [P] [US3] Create E2E test for edit and delete item flows in frontend/tests/e2e/inventory.spec.ts

### Implementation for User Story 3

- [ ] T086 [US3] Add update_inventory_item method to InventoryService in backend/src/services/inventory_service.py
- [ ] T087 [US3] Add soft delete method (set deleted_at timestamp) to InventoryService in backend/src/services/inventory_service.py
- [ ] T088 [US3] Add optimistic locking or conflict resolution for concurrent updates in backend/src/services/inventory_service.py
- [ ] T089 [US3] Implement PUT update endpoint in backend/src/api/v1/inventory.py
- [ ] T090 [US3] Implement DELETE soft delete endpoint in backend/src/api/v1/inventory.py
- [ ] T091 [P] [US3] Create ItemDetail page component with edit mode in frontend/src/pages/ItemDetail.tsx
- [ ] T092 [P] [US3] Create EditItemForm component in frontend/src/components/inventory/EditItemForm.tsx
- [ ] T093 [US3] Add update and delete methods to inventory API service in frontend/src/services/inventory.ts
- [ ] T094 [US3] Add optimistic updates to inventory store (update UI immediately, rollback on error) in frontend/src/stores/inventoryStore.ts
- [ ] T095 [US3] Add confirmation dialog for delete action in frontend/src/components/inventory/EditItemForm.tsx
- [ ] T096 [US3] Add validation for update operations (prevent negative quantities, invalid dates) in backend/src/schemas/inventory.py
- [ ] T097 [US3] Add logging for update and delete operations with user tracking in backend/src/services/inventory_service.py

**Checkpoint**: All P1 user stories (US1, US2, US3) should now be independently functional - this is a viable MVP!

---

## Phase 6: User Story 4 - Multi-User Access with Roles (Priority: P2)

**Goal**: Enable household members to collaborate with role-based permissions (Admin, Editor, Viewer)

**Independent Test**: Create multiple users, assign different roles, test permissions (add/edit/delete/view), verify role enforcement

### Tests for User Story 4

- [ ] T098 [P] [US4] Create contract test for POST /api/v1/households/{id}/invite in backend/tests/contract/test_household_api.py
- [ ] T099 [P] [US4] Create contract test for PUT /api/v1/households/{id}/members/{userId} in backend/tests/contract/test_household_api.py
- [ ] T100 [P] [US4] Create integration test for household invitation flow in backend/tests/integration/test_household_flow.py
- [ ] T101 [P] [US4] Create integration test for role permission enforcement in backend/tests/integration/test_permissions.py
- [ ] T102 [P] [US4] Create E2E test for multi-user collaboration in frontend/tests/e2e/multiuser.spec.ts

### Implementation for User Story 4

- [ ] T103 [P] [US4] Create InvitationToken model in backend/src/models/invitation_token.py
- [ ] T104 [P] [US4] Create InvitationToken Pydantic schemas in backend/src/schemas/household.py
- [ ] T105 [US4] Add invite_member method to HouseholdService in backend/src/services/household_service.py (depends on T103)
- [ ] T106 [US4] Add accept_invitation method to HouseholdService in backend/src/services/household_service.py
- [ ] T107 [US4] Add update_member_role method (admin only) to HouseholdService in backend/src/services/household_service.py
- [ ] T108 [US4] Add remove_member method (admin only) to HouseholdService in backend/src/services/household_service.py
- [ ] T109 [US4] Create permission checker decorators (require_role_admin, require_role_editor) in backend/src/utils/permissions.py
- [ ] T110 [US4] Implement POST invite endpoint in backend/src/api/v1/households.py
- [ ] T111 [US4] Implement GET accept invitation endpoint in backend/src/api/v1/households.py
- [ ] T112 [US4] Implement PUT update member role endpoint in backend/src/api/v1/households.py
- [ ] T113 [US4] Implement DELETE remove member endpoint in backend/src/api/v1/households.py
- [ ] T114 [US4] Add role-based permission checks to inventory endpoints in backend/src/api/v1/inventory.py
- [ ] T115 [US4] Create NotificationService for sending invitation emails in backend/src/services/notification_service.py
- [ ] T116 [US4] Setup email sending with SMTP configuration in backend/src/services/notification_service.py
- [ ] T117 [P] [US4] Create Household page component with member management in frontend/src/pages/Household.tsx
- [ ] T118 [P] [US4] Create MemberList component in frontend/src/components/household/MemberList.tsx
- [ ] T119 [P] [US4] Create InviteForm component in frontend/src/components/household/InviteForm.tsx
- [ ] T120 [P] [US4] Create RoleSelector component (Admin, Editor, Viewer) in frontend/src/components/household/RoleSelector.tsx
- [ ] T121 [US4] Add invitation methods to household API service in frontend/src/services/household.ts
- [ ] T122 [US4] Create household store for member management in frontend/src/stores/householdStore.ts
- [ ] T123 [US4] Add role-based UI permissions (hide edit/delete buttons for viewers) in frontend/src/components/inventory/InventoryItem.tsx
- [ ] T124 [US4] Add real-time updates using Redis pub/sub for household changes in backend/src/cache/cache_service.py
- [ ] T125 [US4] Setup Server-Sent Events endpoint for real-time updates in backend/src/api/v1/households.py
- [ ] T126 [US4] Create WebSocket/SSE client service in frontend/src/services/websocket.ts
- [ ] T127 [US4] Add logging for all permission checks and role changes in backend/src/utils/permissions.py

**Checkpoint**: Multi-user collaboration with RBAC is now functional

---

## Phase 7: User Story 5 - Barcode Scanning (Priority: P2)

**Goal**: Enable users to add items by scanning barcodes (barcode scanner device or mobile camera)

**Independent Test**: Scan product barcode, verify product info is retrieved and pre-filled, confirm item is added with correct details

### Tests for User Story 5

- [ ] T128 [P] [US5] Create contract test for POST /api/v1/barcodes/lookup in backend/tests/contract/test_barcode_api.py
- [ ] T129 [P] [US5] Create integration test for barcode lookup with Open Food Facts API in backend/tests/integration/test_barcode_service.py
- [ ] T130 [P] [US5] Create E2E test for barcode scanning flow in frontend/tests/e2e/barcode.spec.ts

### Implementation for User Story 5

- [ ] T131 [US5] Create BarcodeService with Open Food Facts API integration in backend/src/services/barcode_service.py
- [ ] T132 [US5] Add barcode caching to Redis (24 hour TTL) in backend/src/services/barcode_service.py
- [ ] T133 [US5] Store successful barcode lookups in PostgreSQL for faster repeat scans in backend/src/services/barcode_service.py
- [ ] T134 [US5] Add fallback to UPC Database API if Open Food Facts fails in backend/src/services/barcode_service.py
- [ ] T135 [US5] Implement POST barcode lookup endpoint in backend/src/api/v1/barcodes.py
- [ ] T136 [P] [US5] Create BarcodeScanner component with device input support in frontend/src/components/barcode/BarcodeScanner.tsx
- [ ] T137 [P] [US5] Create CameraCapture component for mobile camera scanning in frontend/src/components/barcode/CameraCapture.tsx
- [ ] T138 [US5] Integrate barcode scanning library (quagga2 or zxing) in frontend/src/components/barcode/BarcodeScanner.tsx
- [ ] T139 [US5] Add barcode lookup to AddItemForm (pre-fill fields from API response) in frontend/src/components/inventory/AddItemForm.tsx
- [ ] T140 [US5] Add manual entry fallback when barcode not found in frontend/src/components/inventory/AddItemForm.tsx
- [ ] T141 [US5] Add logging for barcode lookups and cache hits/misses in backend/src/services/barcode_service.py

**Checkpoint**: Barcode scanning functionality is complete

---

## Phase 8: User Story 6 - API Integration for External Apps (Priority: P2)

**Goal**: Provide REST API for external applications (like Mealie) to access inventory data

**Independent Test**: Register API client, authenticate, make read/write requests, verify responses match OpenAPI spec

### Tests for User Story 6

- [ ] T142 [P] [US6] Create contract test for API client authentication flow in backend/tests/contract/test_api_client.py
- [ ] T143 [P] [US6] Create integration test for Mealie integration scenario in backend/tests/integration/test_mealie_integration.py
- [ ] T144 [P] [US6] Create integration test for API rate limiting in backend/tests/integration/test_rate_limiting.py

### Implementation for User Story 6

- [ ] T145 [P] [US6] Create APIClient model in backend/src/models/api_client.py
- [ ] T146 [P] [US6] Create APIClient Pydantic schemas in backend/src/schemas/api_client.py
- [ ] T147 [US6] Create APIClientService with client creation and authentication in backend/src/services/api_client_service.py (depends on T145)
- [ ] T148 [US6] Add API client authentication method (client credentials flow) to AuthService in backend/src/services/auth_service.py
- [ ] T149 [US6] Implement POST create API client endpoint in backend/src/api/v1/api_clients.py
- [ ] T150 [US6] Implement POST API client token endpoint (client credentials) in backend/src/api/v1/auth.py
- [ ] T151 [US6] Add API key authentication dependency to api/deps.py in backend/src/api/deps.py
- [ ] T152 [US6] Add rate limiting middleware (1000 requests/hour per client) in backend/src/middleware/rate_limit.py
- [ ] T153 [P] [US6] Create APIClient management page in frontend/src/pages/APIClients.tsx
- [ ] T154 [US6] Add API client methods to household API service in frontend/src/services/household.ts
- [ ] T155 [US6] Add logging for all API client requests with client ID tracking in backend/src/middleware/logging.py

**Checkpoint**: External API integration is complete and Mealie-compatible

---

## Phase 9: User Story 7 - Image Recognition (Priority: P3)

**Goal**: Enable users to add items by uploading photos (food items or receipts)

**Independent Test**: Upload photo of food item or receipt, verify products are identified, confirm items added with reasonable accuracy

### Tests for User Story 7

- [ ] T156 [P] [US7] Create contract test for POST /api/v1/images/recognize in backend/tests/contract/test_image_api.py
- [ ] T157 [P] [US7] Create integration test for Google Vision API integration in backend/tests/integration/test_image_service.py
- [ ] T158 [P] [US7] Create E2E test for image upload and recognition flow in frontend/tests/e2e/image-recognition.spec.ts

### Implementation for User Story 7

- [ ] T159 [US7] Create ImageService with Google Cloud Vision API integration in backend/src/services/image_service.py
- [ ] T160 [US7] Add image optimization (resize, compress) before sending to API in backend/src/services/image_service.py
- [ ] T161 [US7] Add S3-compatible storage service for uploaded photos in backend/src/services/storage_service.py
- [ ] T162 [US7] Create Celery worker task for async image recognition in backend/src/tasks/image_recognition.py
- [ ] T163 [US7] Implement POST image recognize endpoint (returns task_id) in backend/src/api/v1/images.py
- [ ] T164 [US7] Implement GET task status endpoint for checking recognition progress in backend/src/api/v1/images.py
- [ ] T165 [P] [US7] Create ImageUpload component with drag-and-drop in frontend/src/components/image/ImageUpload.tsx
- [ ] T166 [P] [US7] Create RecognitionResults component for reviewing detected items in frontend/src/components/image/RecognitionResults.tsx
- [ ] T167 [US7] Add image upload to AddItemForm with async processing in frontend/src/components/inventory/AddItemForm.tsx
- [ ] T168 [US7] Add polling for task status and result display in frontend/src/components/image/RecognitionResults.tsx
- [ ] T169 [US7] Add confidence score threshold (>70%) for label filtering in backend/src/services/image_service.py
- [ ] T170 [US7] Add logging for image recognition requests and API costs in backend/src/services/image_service.py

**Checkpoint**: All user stories are now independently functional

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T171 [P] Setup Celery worker deployment for background tasks in infrastructure/kubernetes/worker-deployment.yaml
- [ ] T172 [P] Create Kubernetes manifests for all services in infrastructure/kubernetes/
- [ ] T173 [P] Create PostgreSQL StatefulSet configuration in infrastructure/kubernetes/postgres-statefulset.yaml
- [ ] T174 [P] Create Redis deployment configuration in infrastructure/kubernetes/redis-deployment.yaml
- [ ] T175 [P] Create Ingress configuration for routing in infrastructure/kubernetes/ingress.yaml
- [ ] T176 [P] Create Horizontal Pod Autoscaler configuration in infrastructure/kubernetes/hpa.yaml
- [ ] T177 [P] Add Prometheus metrics endpoints to backend in backend/src/main.py
- [ ] T178 [P] Add OpenTelemetry tracing instrumentation in backend/src/utils/tracing.py
- [ ] T179 [P] Create common UI components (Button, Input, Modal, Toast) in frontend/src/components/common/
- [ ] T180 [P] Create layout components (Header, Sidebar, MobileNav) in frontend/src/components/layout/
- [ ] T181 [P] Add error boundaries for React components in frontend/src/components/common/ErrorBoundary.tsx
- [ ] T182 [P] Add global error handling middleware to backend in backend/src/middleware/error_handler.py
- [ ] T183 [P] Create API documentation page (Swagger UI customization) in frontend/src/pages/APIDocs.tsx
- [ ] T184 [P] Add unit tests for services in backend/tests/unit/test_services/
- [ ] T185 [P] Add unit tests for React components in frontend/tests/unit/
- [ ] T186 [P] Create GitHub Actions workflow for backend tests in .github/workflows/backend-tests.yml
- [ ] T187 [P] Create GitHub Actions workflow for frontend tests in .github/workflows/frontend-tests.yml
- [ ] T188 [P] Create GitHub Actions workflow for E2E tests in .github/workflows/e2e-tests.yml
- [ ] T189 [P] Create deployment workflow for Kubernetes in .github/workflows/deploy.yml
- [ ] T190 Run quickstart.md validation (verify all setup steps work)
- [ ] T191 [P] Add security headers middleware (CORS, CSP, HSTS) in backend/src/middleware/security.py
- [ ] T192 [P] Add input sanitization for all user inputs in backend/src/utils/sanitization.py
- [ ] T193 [P] Create user documentation in docs/USER_GUIDE.md
- [ ] T194 [P] Create developer documentation in docs/ARCHITECTURE.md
- [ ] T195 [P] Create deployment guide in docs/DEPLOYMENT.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-9)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1: US1, US2, US3 → P2: US4, US5, US6 → P3: US7)
- **Polish (Phase 10)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories ✅ MVP
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories ✅ MVP
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories ✅ MVP
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 5 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 6 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 7 (P3)**: Can start after Foundational (Phase 2) - No dependencies on other stories

**KEY INSIGHT**: All user stories are independent! After Phase 2 (Foundational), all stories can be developed in parallel by different team members.

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before services
- Services before endpoints/UI
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "T034 [P] [US1] Create contract test for POST /api/v1/households/{id}/inventory"
Task: "T035 [P] [US1] Create integration test for complete add item flow"
Task: "T036 [P] [US1] Create E2E test for manual item addition"

# Launch all models for User Story 1 together:
Task: "T037 [P] [US1] Create User model in backend/src/models/user.py"
Task: "T038 [P] [US1] Create Household model in backend/src/models/household.py"
Task: "T039 [P] [US1] Create HouseholdMembership model"

# Launch all schemas for User Story 1 together:
Task: "T041 [P] [US1] Create User Pydantic schemas"
Task: "T042 [P] [US1] Create Household Pydantic schemas"
Task: "T043 [P] [US1] Create InventoryItem Pydantic schemas"
```

---

## Implementation Strategy

### MVP First (User Stories 1, 2, 3 Only - All P1)

**Timeline**: Fastest path to working product

1. Complete Phase 1: Setup (T001-T011)
2. Complete Phase 2: Foundational (T012-T033) - CRITICAL blocking phase
3. Complete Phase 3: User Story 1 - Manual Inventory Addition (T034-T061)
4. Complete Phase 4: User Story 2 - View and Search Inventory (T062-T081)
5. Complete Phase 5: User Story 3 - Inventory Updates and Management (T082-T097)
6. **STOP and VALIDATE**: Test all 3 stories independently
7. Deploy/demo if ready

**MVP Deliverable**: Fully functional household inventory system with manual entry, search, and updates. This is a complete, usable product!

### Incremental Delivery

**Timeline**: Continuous value delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP core!)
3. Add User Story 2 → Test independently → Deploy/Demo (MVP complete!)
4. Add User Story 3 → Test independently → Deploy/Demo (MVP enhanced!)
5. Add User Story 4 → Test independently → Deploy/Demo (Multi-user collaboration)
6. Add User Story 5 → Test independently → Deploy/Demo (Barcode convenience)
7. Add User Story 6 → Test independently → Deploy/Demo (Mealie integration)
8. Add User Story 7 → Test independently → Deploy/Demo (Premium feature)
9. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - **Developer A**: User Story 1 (Manual Addition)
   - **Developer B**: User Story 2 (View/Search)
   - **Developer C**: User Story 3 (Updates)
3. After P1 stories complete:
   - **Developer A**: User Story 4 (Multi-user)
   - **Developer B**: User Story 5 (Barcode)
   - **Developer C**: User Story 6 (API Integration)
4. **Developer A**: User Story 7 (Image Recognition)
5. **All**: Polish phase (can be done incrementally)

---

## Task Summary

**Total Tasks**: 195
**By Phase**:
- Phase 1 (Setup): 11 tasks
- Phase 2 (Foundational): 22 tasks
- Phase 3 (US1 - Manual Addition): 28 tasks
- Phase 4 (US2 - View/Search): 20 tasks
- Phase 5 (US3 - Updates): 16 tasks
- Phase 6 (US4 - Multi-user): 30 tasks
- Phase 7 (US5 - Barcode): 14 tasks
- Phase 8 (US6 - API Integration): 14 tasks
- Phase 9 (US7 - Image Recognition): 15 tasks
- Phase 10 (Polish): 25 tasks

**Parallel Opportunities**: 123 tasks marked [P] can run in parallel within their phases

**MVP Scope** (US1 + US2 + US3): 75 tasks (including setup and foundational) - approximately 2-3 weeks for a solo developer

---

## Notes

- [P] tasks = different files, no dependencies within phase
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
