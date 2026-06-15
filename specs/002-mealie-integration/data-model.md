# Data Model: Bidirectional Mealie Integration (Phase 1 design)

**Date**: 2026-06-15
**Branch**: `002-mealie-integration`

Conventions match the existing schema: **integer** primary keys, `created_at` /
`updated_at` timestamps (timezone-aware, server default `now()`), foreign keys
with `ondelete="CASCADE"` where a child cannot outlive its parent.

## New persisted entities

### APIClient (Phase 1)

External application credentials and access policy, scoped to one household.

| Field                | Type          | Constraints                                   | Purpose |
| -------------------- | ------------- | --------------------------------------------- | ------- |
| id                   | Integer       | PK                                            | Identifier |
| household_id         | Integer       | FK(households.id) ON DELETE CASCADE, NOT NULL, indexed | Owning household |
| name                 | String(100)   | NOT NULL                                      | Human-readable label (e.g. "Mealie") |
| client_id            | String(64)    | UNIQUE, NOT NULL, indexed                     | Public identifier (random token, e.g. `uuid4().hex`) |
| client_secret_hash   | String(255)   | NOT NULL                                      | bcrypt hash of the secret (non-recoverable) |
| permissions          | JSONB         | NOT NULL, default `{"read": true, "write": false, "delete": false}` | Scope flags |
| is_active            | Boolean       | NOT NULL, default `true`                      | Revocation flag |
| last_used_at         | DateTime(tz)  | NULLABLE                                      | Updated on each authenticated call |
| created_at           | DateTime(tz)  | NOT NULL, default `now()`                     | Creation |
| updated_at           | DateTime(tz)  | NOT NULL, default `now()`                     | Last update |

**Indexes**: PK on `id`; unique on `client_id`; index on `household_id`.

**Validation rules**:
- `name` non-empty, ≤ 100 chars.
- `permissions` keys constrained to `{read, write, delete}` booleans; at least
  `read` true on creation.
- The plaintext secret is generated server-side, returned **once** in the create
  response, and never stored or returned again.

**Relationships**: `Household 1—* APIClient`.

**Lifecycle / state**:
- Created (active) → Revoked (`is_active=false`). Revoked is terminal; no
  reactivation (create a new client instead).

### MealieConnection (Phase 2 — design only, not built in Phase 1)

Per-household configuration for outbound calls to a Mealie instance.

| Field         | Type         | Constraints                                | Purpose |
| ------------- | ------------ | ------------------------------------------ | ------- |
| id            | Integer      | PK                                         | Identifier |
| household_id  | Integer      | FK(households.id) ON DELETE CASCADE, UNIQUE, NOT NULL | One connection per household |
| base_url      | String(500)  | NOT NULL                                   | Mealie instance base URL |
| api_key_enc   | String       | NOT NULL                                   | **Encrypted** Mealie API key (recoverable for replay; never returned) |
| is_active     | Boolean      | NOT NULL, default `true`                   | Enable/disable |
| created_at    | DateTime(tz) | NOT NULL, default `now()`                  | Creation |
| updated_at    | DateTime(tz) | NOT NULL, default `now()`                  | Last update |

**Note**: `api_key_enc` is encrypted (symmetric, application key), **not** hashed,
because it must be replayed to Mealie. Contrast with `APIClient.client_secret_hash`,
which is hashed because Pantrie only ever needs to *verify* it.

## Transient / computed structures (not persisted)

### ClientToken (claims)

JWT payload for an authenticated client (stateless; not a table):
`{ "type": "client", "sub": client_id, "household_id": int, "scopes": ["read", ...], "exp": ... }`.

### IngredientAvailabilityResult

Per-ingredient result returned by availability queries:

| Field                    | Type    | Meaning |
| ------------------------ | ------- | ------- |
| query                    | string  | The requested ingredient name |
| in_stock                 | boolean | Whether a matching, non-deleted item exists with quantity > 0 |
| matched_item_id          | int?    | Inventory item id if matched |
| matched_name             | string? | Matched item's name |
| quantity                 | number? | Quantity on hand |
| unit                     | string? | Unit on hand |
| sufficiency_determinable | boolean | False when units differ / amount unparseable |
| sufficient               | boolean? | If determinable and a requested amount was given |
| ambiguous                | boolean | True when multiple plausible matches existed |

### DecrementResult

| Field     | Type    | Meaning |
| --------- | ------- | ------- |
| item_id   | int     | Affected item |
| removed   | number  | Amount actually removed |
| remaining | number  | Quantity after the update |
| clamped   | boolean | True if the request exceeded available and was clamped to zero |

## Changes to existing entities

- **InventoryItem**: no schema change. Quantity decrements reuse the existing
  `quantity` column; the existing `added_by_user_id` attribution is complemented
  by structured logs attributing client-driven changes to the `client_id`
  (no new column required for the MVP audit).

## Migrations

- **Phase 1**: one Alembic revision adding the `api_clients` table (+ indexes),
  chained onto the current head.
- **Phase 2**: a later revision adding `mealie_connection`.
