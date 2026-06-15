# Tasks: Bidirectional Mealie Integration

**Input**: Design documents from `/specs/002-mealie-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: INCLUDED — the project constitution mandates Test-First Development (NON-NEGOTIABLE). Within each story, test tasks come first and MUST be confirmed failing before implementation.

**Organization**: Tasks grouped by user story. Phase 1 of the feature (US1–US3, Mealie→Pantrie) is the MVP. Phase 2 (US4–US5, Pantrie→Mealie) is deferred and listed for completeness.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story the task belongs to

## Path Conventions

- **Backend**: `backend/src/`, `backend/tests/`
- **Frontend**: `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Minor groundwork; most infrastructure already exists in the repo.

- [ ] T001 Add `CLIENT_RATE_LIMIT_PER_HOUR: int = 1000` setting in `backend/src/config.py`
- [ ] T002 [P] Create test package directories `backend/tests/contract/`, `backend/tests/integration/`, `backend/tests/unit/` each with `__init__.py`
- [ ] T003 [P] Add a reusable test fixture for an admin user + household + auth headers in `backend/tests/conftest.py` (extend existing fixtures)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared entity + schemas required by every Phase-1 story. **No US work starts until this is done.**

- [ ] T004 Create `APIClient` SQLAlchemy model in `backend/src/models/api_client.py` (integer PK, `household_id` FK CASCADE, `name`, `client_id` unique, `client_secret_hash`, `permissions` JSONB default `{"read":true,"write":false,"delete":false}`, `is_active`, `last_used_at`, timestamps)
- [ ] T005 Register `APIClient` in `backend/src/models/__init__.py` so Alembic autogenerate sees it
- [ ] T006 Create Alembic migration `backend/alembic/versions/XXXX_add_api_clients.py` adding the `api_clients` table + indexes (unique `client_id`, index `household_id`), chained onto current head; run `alembic upgrade head` to verify
- [ ] T007 [P] Create Pydantic schemas in `backend/src/schemas/api_client.py`: `Permissions`, `APIClientCreate`, `APIClient` (no secret), `APIClientCreated` (with one-time `client_secret`), `TokenRequest`, `TokenResponse`

**Checkpoint**: Model + migration applied; schemas importable. User stories can begin.

---

## Phase 3: User Story 1 — Register & manage API clients (Priority: P1) 🎯 MVP

**Goal**: A household admin can create, list, and revoke household-scoped API clients; the secret is shown only once.

**Independent Test**: As an admin, create a client (receive id+secret once), list it (no secret), revoke it (gone/inactive); a non-admin is refused.

### Tests for US1 (write first, confirm failing)

- [ ] T008 [P] [US1] Unit test secret generation + bcrypt hash/verify in `backend/tests/unit/test_api_client_secret.py`
- [ ] T009 [P] [US1] Contract test POST/GET/DELETE `/households/{id}/api-clients` (status, schema, secret-once, admin-only 403) in `backend/tests/contract/test_api_clients_api.py`
- [ ] T010 [P] [US1] Integration test create→list→revoke flow in `backend/tests/integration/test_api_client_management.py`

### Implementation for US1

- [ ] T011 [US1] Implement `APIClientService` (create with secret gen+hash, list, revoke; admin role check via `HouseholdService._check_user_role`/`MemberRole.ADMIN`) in `backend/src/services/api_client_service.py`
- [ ] T012 [US1] Create admin management router (POST create, GET list, DELETE revoke) in `backend/src/api/v1/api_clients.py`, user-authenticated via `get_current_user`
- [ ] T013 [US1] Register the router in `backend/src/main.py` (`app.include_router(api_clients.router, prefix="/api/v1")`)
- [ ] T014 [US1] Add structured logging (create/revoke, client id never secret) in `APIClientService`
- [ ] T015 [P] [US1] Frontend API service `frontend/src/services/apiClients.ts` (create/list/revoke)
- [ ] T016 [P] [US1] Frontend `ApiClientManager.tsx` settings component in `frontend/src/components/settings/` (create form, list, revoke, one-time secret display)
- [ ] T017 [US1] Wire `ApiClientManager` into the settings page (admin-only visibility) in `frontend/src/pages/Settings.tsx`

**Checkpoint**: US1 independently testable and demoable.

---

## Phase 4: User Story 2 — External client checks availability (Priority: P1)

**Goal**: A client exchanges credentials for a token and queries ingredient availability (single + bulk).

**Independent Test**: With a valid client, get a token, query availability for a name and a bulk list; revoked/invalid creds are rejected.

### Tests for US2 (write first, confirm failing)

- [ ] T018 [P] [US2] Unit test client token issuance + `get_current_api_client` (rejects user tokens, rejects revoked/inactive, updates last_used) in `backend/tests/unit/test_client_auth.py`
- [ ] T019 [P] [US2] Unit test scope guard `require_client_scope` (read allowed, missing → 403) in `backend/tests/unit/test_client_scopes.py`
- [ ] T020 [P] [US2] Unit test ingredient matching (exact, fuzzy, none, ambiguous) and sufficiency flag (unit match vs mismatch) in `backend/tests/unit/test_ingredient_matching.py`
- [ ] T021 [P] [US2] Unit test per-client rate limit returns 429 with `Retry-After` in `backend/tests/unit/test_client_rate_limit.py`
- [ ] T022 [P] [US2] Contract test POST `/clients/token` and single+bulk `/clients/inventory/availability` in `backend/tests/contract/test_client_gateway_api.py`
- [ ] T023 [P] [US2] Integration test token→single→bulk availability in `backend/tests/integration/test_client_availability.py`

### Implementation for US2

- [ ] T024 [US2] Implement `ClientAuthService` (verify client_id+secret, issue JWT with `type:"client"`, `household_id`, `scopes` via `create_access_token`) in `backend/src/services/client_auth_service.py`
- [ ] T025 [US2] Add `get_current_api_client` dependency + `require_client_scope(scope)` factory in `backend/src/core/deps.py` (decode token, assert `type=="client"`, load + active check, update `last_used_at`, enforce household scope)
- [ ] T026 [US2] Implement per-client rate limiting helper using `backend/src/core/cache.py` (Redis fixed-window key `ratelimit:client:{client_id}:{window}`, 429 + `Retry-After`)
- [ ] T027 [US2] Implement `MealieQueryService.check_availability` (single + bulk): match by name within household reusing inventory name-search, exclude soft-deleted, build `AvailabilityResult` with `sufficiency_determinable` in `backend/src/services/mealie_query_service.py`
- [ ] T028 [P] [US2] Add availability/decrement schemas (`BulkAvailabilityRequest`, `AvailabilityResult`, `DecrementRequest`, `DecrementResult`) in `backend/src/schemas/mealie.py`
- [ ] T029 [US2] Create client gateway router: POST `/clients/token`, GET + POST `/clients/inventory/availability` in `backend/src/api/v1/client_gateway.py` (token endpoint unauthenticated; availability requires client + read scope + rate limit)
- [ ] T030 [US2] Register the gateway router in `backend/src/main.py`
- [ ] T031 [US2] Add sanitized structured logging for token issuance + availability queries

**Checkpoint**: US1+US2 = a usable read-only Mealie integration.

---

## Phase 5: User Story 3 — External client decrements after cooking (Priority: P2)

**Goal**: A write-scoped client decrements item quantity; clamps to zero and reports; read-only clients refused; cross-household refused.

**Independent Test**: Write client decrements an item (quantity drops, change recorded); over-decrement clamps to 0; read-only client → 403; other household's item → 403/404.

### Tests for US3 (write first, confirm failing)

- [ ] T032 [P] [US3] Unit test decrement clamp-to-zero + no-negative + result shape in `backend/tests/unit/test_decrement.py`
- [ ] T033 [P] [US3] Unit test write-scope required (read client → 403) and cross-household refusal in `backend/tests/unit/test_decrement_authz.py`
- [ ] T034 [P] [US3] Contract test POST `/clients/inventory/{item_id}/decrement` in `backend/tests/contract/test_client_decrement_api.py`
- [ ] T035 [P] [US3] Integration test token→decrement→availability reflects new quantity in `backend/tests/integration/test_client_decrement.py`

### Implementation for US3

- [ ] T036 [US3] Implement `MealieQueryService.decrement_item` (transactional, clamp-to-zero, return `DecrementResult`, refuse cross-household) in `backend/src/services/mealie_query_service.py`
- [ ] T037 [US3] Add POST `/clients/inventory/{item_id}/decrement` to `backend/src/api/v1/client_gateway.py` (client + write scope + rate limit)
- [ ] T038 [US3] Add structured logging attributing the quantity change to the client id (FR-020)

**Checkpoint**: Phase 1 (Mealie→Pantrie) complete and shippable.

---

## Phase 6 (DEFERRED — Phase 2): User Story 4 — See makeable Mealie recipes (Priority: P3)

**Goal**: With a configured Mealie connection, list recipes and show makeability vs inventory.

> Build only after Phase 1 ships. Tests-first as above.

- [ ] T039 [US4] `MealieConnection` model in `backend/src/models/mealie_connection.py` + register in models `__init__`
- [ ] T040 [US4] Alembic migration adding `mealie_connection` table
- [ ] T041 [P] [US4] Symmetric encryption helper for the Mealie API key (encrypt at rest, never returned) in `backend/src/core/security.py`
- [ ] T042 [US4] `MealieConnectionService` (configure/get/update, admin-only, key encrypted) in `backend/src/services/mealie_connection_service.py`
- [ ] T043 [US4] `MealieClientService` outbound `httpx` client (fetch recipes + ingredients; handle unreachable/bad-key gracefully) in `backend/src/services/mealie_client_service.py`
- [ ] T044 [US4] Makeability computation (reuse `MealieQueryService` matching) in `mealie_client_service.py`
- [ ] T045 [US4] Recipes endpoints (GET recipes with makeable/missing) in `backend/src/api/v1/mealie.py` + register router
- [ ] T046 [P] [US4] Frontend `MealieConnectionSettings.tsx` + `Recipes.tsx` + `frontend/src/services/mealie.ts`
- [ ] T047 [US4] Tests: contract (recipes, connection config), integration (configured→list→makeability), unit (makeability, error handling)

---

## Phase 7 (DEFERRED — Phase 2): User Story 5 — Send missing ingredients to Mealie (Priority: P3)

**Goal**: Push a recipe's missing ingredients to a Mealie shopping list, reporting per-item success/failure.

- [ ] T048 [US5] `MealieClientService.add_to_shopping_list` (outbound, partial-success reporting) in `backend/src/services/mealie_client_service.py`
- [ ] T049 [US5] POST shopping-list endpoint in `backend/src/api/v1/mealie.py`
- [ ] T050 [P] [US5] Frontend "send missing to Mealie" action in `Recipes.tsx`
- [ ] T051 [US5] Tests: contract + integration (partial success path) + unit

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T052 [P] Add API usage doc (register a client, token, availability, decrement) at `docs/docs/api/mealie-integration.md` and add to `docs/mkdocs.yml` nav
- [ ] T053 [P] Migrate/remove ad-hoc `backend/test_login.py` and `backend/test_setup.py` into the new `backend/tests/` suite (advances epic #2)
- [ ] T054 [P] Add a CI workflow running backend tests (pytest) on PRs in `.github/workflows/`
- [ ] T055 Update `specs/001-household-inventory/STATUS.md` to mark US6 (API integration) done for Phase 1
- [ ] T056 Verify all quickstart.md commands succeed against the running dev stack

---

## Dependencies & Execution Order

- **Setup (P1–P3)** → **Foundational (P4–P7)** block everything.
- **US1 (P3 phase)** depends only on Foundational. Ships as MVP.
- **US2 (P4 phase)** depends on Foundational (uses the `APIClient` model + schemas). Independent of US1 at runtime, but US1's create endpoint is the practical way to mint credentials for manual testing.
- **US3 (P5 phase)** depends on US2's client-auth + gateway router + `MealieQueryService`.
- **US4/US5 (Phase 2)** depend on Foundational + the matching logic from US2; otherwise independent of US1/US3.
- **Polish** last.

## Parallel Opportunities

- Setup: T002, T003 in parallel.
- Foundational: T007 parallel with T004–T006 sequence (schemas are independent of the migration).
- Within each story, all `[P]` test tasks run in parallel before implementation; frontend `[P]` tasks (T015/T016, T046, T050) run alongside backend work.

## Implementation Strategy

1. **MVP = Setup + Foundational + US1 + US2** — an admin can issue credentials and an external app can check availability (read-only integration). Deliverable on its own.
2. Add **US3** for write-back (keep inventory accurate after cooking) → completes Phase 1.
3. **Phase 2 (US4/US5)** in a later iteration.

## Notes

- Tests are written and confirmed failing before implementation within each story (constitution II).
- Reuse existing primitives: `create_access_token`/`decode_token`/`hash_password`/`verify_password` (`backend/src/core/security.py`), `get_current_user` (`backend/src/core/deps.py`), `MemberRole` role checks, Redis `backend/src/core/cache.py`, inventory name-search in `InventoryService`.
- Integer primary keys throughout (matches the live schema).
