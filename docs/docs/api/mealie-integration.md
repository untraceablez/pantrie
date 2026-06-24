# Mealie Integration

Pantrie integrates with [Mealie](https://docs.mealie.io) in both directions:

- **Phase 1 (Mealie → Pantrie)** — an external app authenticates with API client
  credentials scoped to one household and queries (or updates) inventory. Covered
  in this page.
- **Phase 2 (Pantrie → Mealie)** — Pantrie pulls your Mealie recipes, computes
  what you can make from your current inventory, and pushes missing ingredients
  to a Mealie shopping list. This is now shipped and used from the in-app
  **Recipes** page; see the [Recipes & Mealie](../user-guide/recipes.md) user
  guide. It uses a Mealie connection configured under **Settings → Household
  Settings → Mealie Connection** (a Mealie base URL + API key), not the API
  clients described below.

## Concepts

- **API client** — a credential (`client_id` + `client_secret`) a household
  admin creates for an external app. Scoped to a single household with
  `read` and/or `write` permissions.
- **Access token** — a short-lived bearer token the client obtains by exchanging
  its credentials. Distinct from user login tokens.

## 1. Create an API client (household admin)

In the app: **Settings → Household Settings → API Clients → Create client**.
Give it a name (e.g. "Mealie") and choose whether it may write (decrement
quantities). The **client secret is shown only once** — copy it immediately.

Equivalently via the API (with a normal user token for an admin of the
household):

```bash
curl -X POST https://your-pantrie/api/v1/households/<HOUSEHOLD_ID>/api-clients \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Mealie", "permissions": {"read": true, "write": true}}'
```

## 2. Get an access token

```bash
curl -X POST https://your-pantrie/api/v1/clients/token \
  -H "Content-Type: application/json" \
  -d '{"client_id": "<CLIENT_ID>", "client_secret": "<CLIENT_SECRET>"}'
# -> { "access_token": "...", "token_type": "bearer", "expires_in": 900, "scopes": ["read","write"] }
```

Use the returned token as `Authorization: Bearer <token>` on the calls below.

## 3. Check ingredient availability (scope: read)

Single ingredient:

```bash
curl "https://your-pantrie/api/v1/clients/inventory/availability?name=flour&amount=200&unit=g" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Bulk:

```bash
curl -X POST https://your-pantrie/api/v1/clients/inventory/availability \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"ingredients": [{"name": "flour", "amount": 200, "unit": "g"}, {"name": "eggs"}]}'
```

Each result reports:

| Field | Meaning |
| ----- | ------- |
| `in_stock` | Whether a matching item exists with quantity > 0 |
| `matched_name`, `quantity`, `unit` | The matched inventory item |
| `sufficiency_determinable` | `false` when units differ and can't be compared |
| `sufficient` | Whether on-hand quantity meets the requested amount (when determinable) |
| `ambiguous` | `true` when more than one item plausibly matched |

Ingredient names are matched within the household: case-insensitive exact match
first, then a substring fallback. There is no unit conversion yet — if the
requested unit differs from the stored unit, `sufficiency_determinable` is
`false` and the on-hand quantity is still reported.

## 4. Decrement after cooking (scope: write)

```bash
curl -X POST https://your-pantrie/api/v1/clients/inventory/<ITEM_ID>/decrement \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 2}'
# -> { "item_id": 12, "removed": 2, "remaining": 4, "clamped": false }
```

If `amount` exceeds what's on hand, the quantity is clamped to zero and the
response has `"clamped": true`. Quantities never go negative.

## Revoking access

Revoke a client from **Settings → Household Settings → API Clients** (or
`DELETE /api/v1/households/<HOUSEHOLD_ID>/api-clients/<ID>`). A revoked client can
no longer obtain a token or call any endpoint.

## Limits & errors

- **Rate limit**: requests are limited per client; exceeding it returns
  `429 Too Many Requests` with a `retry_after` hint.
- `401` — missing, invalid, or revoked credentials.
- `403` — the client lacks the required scope (e.g. a read-only client
  attempting a decrement).
- `404` — the item is not in the client's household.

Full request/response schemas are in the interactive API docs at
`/api/docs` on your Pantrie instance.
