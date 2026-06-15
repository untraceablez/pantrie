# Implementation Plan: Bidirectional Mealie Integration

**Branch**: `002-mealie-integration` | **Date**: 2026-06-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-mealie-integration/spec.md`

## Summary

Add machine-to-machine integration between Pantrie and Mealie, in two phases.
**Phase 1 (MVP, Mealie → Pantrie)**: household admins issue API client credentials;
external clients exchange them for a short-lived token (client-credentials grant)
and call household-scoped, permission-gated endpoints to check ingredient
availability (single + bulk) and decrement item quantities. **Phase 2
(Pantrie → Mealie)**: Pantrie calls a per-household-configured Mealie instance to
pull recipes, compute makeability from inventory, and push missing ingredients to
a Mealie shopping list.

Technical approach reuses existing primitives: JWT helpers in
`backend/src/core/security.py`, bcrypt password hashing for the client secret,
the existing Redis cache for rate limiting, and the existing inventory name
search for ingredient matching. A new `get_current_api_client` dependency
authenticates clients alongside the existing `get_current_user`.

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript/React 18 (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2, `httpx` (Phase 2 outbound), Redis (`redis` async), `python-jose`/existing JWT helpers, `passlib[bcrypt]`
**Storage**: PostgreSQL 16 (primary), Redis 7 (rate-limit counters)
**Testing**: pytest + pytest-asyncio + httpx AsyncClient (backend, fixtures already in `backend/tests/conftest.py`); Vitest/Playwright (frontend, Phase 2 UI)
**Target Platform**: Linux containers (existing Docker Compose dev stack)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: Bulk availability for 25 ingredients < ~1s under normal load (SC-003); external update reflected < ~5s (SC-005)
**Constraints**: New client auth MUST NOT interfere with existing user JWT auth (FR-012); client secrets non-recoverable (FR-003); no negative quantities (FR-006/SC-006); integer primary keys (match existing schema — **not** UUID as the original 001 data-model drafted)
**Scale/Scope**: Per-household; on the order of a handful of clients per household; rate limit ~1000 req/hour per client (dedicated setting, reconciled from existing `RATE_LIMIT_PER_MINUTE`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Specification-First**: ✅ `spec.md` complete, reviewed, merged (PR #8), with prioritized user stories and acceptance criteria.
- **II. Test-First Development**: ✅ Plan mandates contract tests (per endpoint), integration tests (token → query → decrement journey), and unit tests (client auth, scope enforcement, ingredient matching, clamp-to-zero). Tests written and confirmed failing before implementation. Reuses `backend/tests/conftest.py` fixtures (this is also the project's first real test suite — feeds epic #2).
- **III. Simplicity & YAGNI**: ✅ Reuse existing JWT/bcrypt/Redis/name-search rather than adding an OAuth framework or new auth library. No unit-conversion engine in MVP (explicitly out of scope). Client tokens are stateless JWTs (no new token store). See Complexity Tracking (empty).
- **IV. Observability**: ✅ Structured logging (existing `structlog`) at client auth, token issuance, availability queries, and quantity changes; secrets/keys redacted; quantity changes attributed to the client id for audit (FR-020/FR-022).
- **V. User-Centric Design**: ✅ Stories map to real workflows (let Mealie reason about what's in the pantry; keep inventory accurate after cooking; surface makeable recipes). Each story independently testable.

**Food Domain Specifics** (from constitution Technical Standards):
- [x] Measurement handling — availability compares quantity/unit; cross-unit sufficiency flagged as undeterminable in MVP (no silent wrong math); full conversion out of scope and documented.
- [x] Allergen and dietary information tracking — not modified; existing per-item allergen data is unaffected by this feature.
- [x] Recipe scaling — N/A in Phase 1; Phase 2 makeability uses ingredient presence/quantity, not proportional scaling.
- [x] Data integrity for nutrition/ingredient data — quantities never go negative (clamp-to-zero with reported outcome); all external mutations logged and attributed.

**Pass/Fail**: **PASS** — no violations; Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-mealie-integration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (openapi.yaml)
├── checklists/
│   └── requirements.md  # from /speckit.specify
└── spec.md
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/
│   │   ├── api_client.py            # NEW — APIClient model (Phase 1)
│   │   └── mealie_connection.py     # NEW — per-household Mealie config (Phase 2)
│   ├── schemas/
│   │   ├── api_client.py            # NEW — create/list/secret-once schemas
│   │   └── mealie.py                # NEW — availability, decrement, recipe schemas
│   ├── services/
│   │   ├── api_client_service.py    # NEW — create/list/revoke + secret hashing
│   │   ├── client_auth_service.py   # NEW — credential→token, token validation
│   │   ├── mealie_query_service.py  # NEW — ingredient matching + availability + decrement
│   │   └── mealie_client_service.py # NEW — outbound httpx calls to Mealie (Phase 2)
│   ├── core/
│   │   ├── security.py              # REUSE — JWT create/decode, bcrypt hash/verify
│   │   ├── deps.py                  # EXTEND — add get_current_api_client + scope guards
│   │   └── cache.py                 # REUSE — Redis for per-client rate limiting
│   ├── api/v1/
│   │   ├── api_clients.py           # NEW — admin client management endpoints
│   │   ├── client_gateway.py        # NEW — token + client-facing inventory endpoints
│   │   └── mealie.py                # NEW — recipes/makeable/shopping-list (Phase 2)
│   └── main.py                      # EXTEND — register new routers
└── alembic/versions/
    ├── XXXX_add_api_clients.py      # NEW migration (Phase 1)
    └── YYYY_add_mealie_connection.py# NEW migration (Phase 2)

backend/tests/
├── contract/   # NEW — per-endpoint contract tests
├── integration/# NEW — token→availability→decrement journey
└── unit/       # NEW — client auth, scopes, matching, clamp

frontend/
└── src/
    ├── pages/Recipes.tsx            # NEW — Phase 2 makeable-recipes view
    ├── components/settings/ApiClientManager.tsx  # NEW — Phase 1 admin UI
    ├── components/settings/MealieConnectionSettings.tsx # NEW — Phase 2
    └── services/{apiClients,mealie}.ts           # NEW — API services
```

**Structure Decision**: Existing web-app layout (`backend/` FastAPI + `frontend/` React). New code follows the established model/schema/service/api-router separation. Client-facing endpoints are grouped under a dedicated gateway router to keep the new auth surface isolated from the user-authenticated routers.

## Phasing

- **Phase 1 (MVP)** — US1, US2, US3 (backend + a minimal admin UI to issue/revoke clients). Independently shippable.
- **Phase 2** — US4, US5 (outbound Mealie connection + recipe UI). Built after Phase 1 ships.

## Complexity Tracking

> No constitution violations. No entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
