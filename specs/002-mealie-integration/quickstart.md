# Quickstart: Mealie Integration (Phase 1)

**Date**: 2026-06-15
**Audience**: developers implementing/testing, and integrators wiring Mealie to Pantrie.

This walks through the Phase 1 (Mealie → Pantrie) flow end to end against a local
dev stack (`docker compose up --build`, API at <http://localhost:8000>).

## 1. As a household admin, create an API client

Authenticate as a user who is an **admin** of the target household, then:

```bash
# USER_TOKEN = a normal user access token; HH = household id
curl -X POST http://localhost:8000/api/v1/households/$HH/api-clients \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Mealie", "permissions": {"read": true, "write": true}}'
```

Response (201) — **copy the secret now; it is never shown again**:

```json
{
  "id": 1,
  "name": "Mealie",
  "client_id": "a1b2c3...",
  "client_secret": "s3cr3t-shown-once",
  "permissions": {"read": true, "write": true, "delete": false},
  "is_active": true,
  "created_at": "2026-06-15T00:00:00Z"
}
```

List clients (secrets never returned):

```bash
curl http://localhost:8000/api/v1/households/$HH/api-clients \
  -H "Authorization: Bearer $USER_TOKEN"
```

## 2. As the external client (Mealie), get a token

```bash
curl -X POST http://localhost:8000/api/v1/clients/token \
  -H "Content-Type: application/json" \
  -d '{"client_id": "a1b2c3...", "client_secret": "s3cr3t-shown-once"}'
# -> { "access_token": "...", "token_type": "bearer", "expires_in": 900, "scopes": ["read","write"] }
```

## 3. Check ingredient availability

Single:

```bash
curl "http://localhost:8000/api/v1/clients/inventory/availability?name=flour&amount=200&unit=g" \
  -H "Authorization: Bearer $CLIENT_TOKEN"
```

Bulk:

```bash
curl -X POST http://localhost:8000/api/v1/clients/inventory/availability \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ingredients": [{"name":"flour","amount":200,"unit":"g"}, {"name":"eggs","amount":2,"unit":"count"}]}'
```

Each result reports `in_stock`, on-hand `quantity`/`unit`, and
`sufficiency_determinable` (false when units differ and can't be compared).

## 4. Decrement after cooking (requires write scope)

```bash
curl -X POST http://localhost:8000/api/v1/clients/inventory/$ITEM_ID/decrement \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 2}'
# -> { "item_id": 12, "removed": 2, "remaining": 4, "clamped": false }
```

If `amount` exceeds what's on hand, the response has `"clamped": true` and
`"remaining": 0`.

## 5. Revoke

```bash
curl -X DELETE http://localhost:8000/api/v1/households/$HH/api-clients/1 \
  -H "Authorization: Bearer $USER_TOKEN"
```

After revocation, the client can no longer obtain a token or call endpoints (401).

## Test plan (write FIRST, confirm failing, per constitution)

- **Contract** (`backend/tests/contract/`): one test per endpoint above asserting
  status codes, schemas, and auth requirements.
- **Integration** (`backend/tests/integration/`): full journey — admin creates
  client → client gets token → availability → decrement → admin revokes → calls
  now 401.
- **Unit** (`backend/tests/unit/`): secret hashing/verification; token type
  separation (a user token is rejected by the client dependency and vice-versa);
  scope enforcement (read client cannot decrement → 403); cross-household refusal;
  ingredient matching (exact, fuzzy, none, ambiguous); decrement clamp-to-zero;
  rate-limit 429.

## Validation against success criteria

- SC-001: steps 1 takes < 2 min. SC-002: steps 2–3 are exactly two requests.
- SC-004: revoked/cross-household calls return 401/403 (integration test).
- SC-006: decrement never produces a negative (unit test).
- SC-007: exceeding the limit returns 429 with `Retry-After`.
