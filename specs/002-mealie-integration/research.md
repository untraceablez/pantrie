# Research: Bidirectional Mealie Integration (Phase 0)

**Date**: 2026-06-15
**Branch**: `002-mealie-integration`

This document records the technical decisions that resolve the open questions
from the plan. Each is grounded in patterns already present in the codebase to
honor the Simplicity & YAGNI principle.

## 1. API client authentication & token issuance

- **Decision**: Client-credentials grant issuing a **stateless JWT**. Clients
  `POST` their `client_id` + `client_secret` to a token endpoint; the server
  verifies the secret (bcrypt) against the stored hash, checks the client is
  active, and returns a short-lived JWT via the existing
  `create_access_token(data, expires_delta)` in `backend/src/core/security.py`.
  The token payload carries `type: "client"`, `client_id`, `household_id`, and
  `scopes`. A new `get_current_api_client` dependency in `backend/src/core/deps.py`
  decodes the token (`decode_token`), rejects it unless `type == "client"`,
  loads the `APIClient`, verifies it is still active, and updates `last_used_at`.
- **Rationale**: Reuses the exact JWT + bcrypt machinery used for users, so no
  new crypto, no new token store, and no risk of interfering with user auth
  (the `type` claim cleanly separates the two — user tokens use `access`/`refresh`).
- **Alternatives considered**:
  - *Opaque tokens in Redis*: requires a lookup store and TTL management; more
    moving parts than stateless JWT for a low client count. Rejected (YAGNI).
  - *Full OAuth2 library (e.g. Authlib)*: heavyweight for a single
    client-credentials flow; adds a dependency. Rejected.
  - *Static API keys (no token exchange)*: simpler but means the long-lived
    secret travels on every request and can't expire. Rejected for security.

## 2. Permission scopes

- **Decision**: Store `permissions` as JSONB `{"read": bool, "write": bool,
  "delete": bool}` on `APIClient` (matches the original 001 data-model intent).
  Scopes are embedded in the token at issuance. Enforce with small dependency
  factories layered on `get_current_api_client` — e.g. `require_client_scope("read")`,
  `require_client_scope("write")` — returning 403 when missing.
- **Rationale**: JSONB mirrors the existing `metadata`/permissions pattern in the
  codebase and is easy to extend (delete reserved for later) without a migration.
- **Alternatives**: comma-separated string column (less structured); separate
  scope table (over-engineered for a fixed, tiny scope set). Rejected.

## 3. Per-client rate limiting

- **Decision**: Fixed-window counter in Redis via the existing
  `backend/src/core/cache.py`. Key `ratelimit:client:{client_id}:{window}`, TTL =
  window length; increment per request in the client dependency; return HTTP 429
  with a clear body + `Retry-After` when the limit is exceeded. Add a dedicated
  `CLIENT_RATE_LIMIT_PER_HOUR` setting (default 1000) rather than overloading the
  existing `RATE_LIMIT_PER_MINUTE`.
- **Rationale**: Redis is already a running dependency; a fixed-window counter is
  the simplest correct approach and satisfies FR-021/SC-007. A dedicated setting
  keeps client limits independent of any future user-facing limiting.
- **Alternatives**: `slowapi` (adds a dependency and is request-IP oriented);
  sliding-window/token-bucket (more accurate, unnecessary at this scale). Rejected
  for the MVP; can revisit if abuse appears.

## 4. Ingredient → inventory matching

- **Decision**: Match by item `name` within the client's household:
  case-insensitive exact match first, then an `ILIKE`/trigram substring fallback
  (reusing the inventory name-search behavior already in `InventoryService`),
  excluding soft-deleted items. Return the single best match; if none, report
  not-in-stock; if multiple ambiguous matches, return the closest and flag
  `ambiguous: true`.
- **Rationale**: Reuses existing search behavior, no new infra. Honors the spec's
  edge-case handling (no silent wrong guesses).
- **Alternatives**: maintain an explicit ingredient↔item alias mapping table
  (more accurate, but premature — YAGNI until users report mismatches);
  embeddings/semantic match (far out of scope). Rejected.

## 5. Quantity sufficiency & unit handling

- **Decision**: Report availability as `{in_stock, quantity, unit,
  sufficiency_determinable}`. When the requested unit matches the item unit,
  compare and report sufficiency; when units differ (or the recipe amount can't
  be parsed), set `sufficiency_determinable: false` and still report what's on
  hand. No unit conversion in the MVP.
- **Rationale**: Avoids shipping wrong math (constitution Data Integrity). Matches
  spec assumption that full conversion is out of MVP scope.
- **Alternatives**: a conversion table (grams↔kg↔count is ambiguous for count
  items). Deferred.

## 6. Quantity decrement semantics & concurrency

- **Decision**: Decrement within a single transaction; **clamp to zero** and
  report the outcome (`{removed, remaining, clamped}`) when the requested amount
  exceeds what's on hand. Guard against negatives at the DB write. Attribute the
  change to the API client (for FR-020 audit).
- **Rationale**: Clamp-to-zero is friendly for the cooking use case ("I used the
  rest") and satisfies FR-019/SC-006 deterministically. A transaction prevents a
  concurrent user edit from producing a negative.
- **Alternatives**: hard-reject when amount > available (returns 409). Considered,
  but clamp-and-report is closer to real cooking behavior and still observable.
  Documented so it can be revisited.

## 7. Phase 2 — outbound Mealie connection

- **Decision**: Store a per-household Mealie connection (`base_url` +
  `api_key`) in a new `mealie_connection` table. The `api_key` must be **usable**
  to call Mealie, so it is encrypted at rest (symmetric, app key) rather than
  hashed — and never returned in responses. Outbound calls use an async `httpx`
  client (`mealie_client_service.py`). The existing global `MEALIE_API_URL` /
  `MEALIE_API_KEY` settings serve only as an optional default/fallback.
- **Rationale**: Per-household config matches the multi-tenant model; encryption
  (not hashing) is required because the key is replayed to Mealie. `httpx` is the
  standard async HTTP client and pairs with the existing async stack.
- **Alternatives**: global-only Mealie config (doesn't fit multi-household);
  storing the key in plaintext (rejected — constitution Security). 
- **Status**: Detailed in data-model/contracts as Phase 2; not implemented until
  Phase 1 ships.

## Cross-cutting

- **Testing**: `backend/tests/conftest.py` already provides an async DB session
  and `TestClient`/`AsyncClient` fixtures; new tests build on these. This feature
  introduces the project's first real test suite (also advances epic #2).
- **Observability**: use existing `structlog`; log client id (never secret),
  endpoint, household, and outcome. Outbound Mealie calls log request/response
  metadata sanitized of the API key.
- **Primary keys**: integer PKs throughout, matching the live schema (the 001
  data-model's UUID notation does not reflect the implemented tables).
