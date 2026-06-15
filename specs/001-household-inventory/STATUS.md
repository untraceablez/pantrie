# Implementation Status — Reconciliation Snapshot

**Date**: 2026-06-15
**Feature**: 001-household-inventory
**Purpose**: Reconcile the planning artifacts (`spec.md`, `plan.md`, `tasks.md`)
with what is actually implemented in the codebase.

## Why this document exists

`tasks.md` was generated up front and lists 195 tasks, none checked off, which
implies a greenfield project. In reality the application is **~75–80% built**:
the full MVP (US1–US3) plus multi-user RBAC (US4), barcode lookup (US5), and a
substantial amount of beyond-spec work (OAuth, email confirmation, webhooks,
site administration, reverse-proxy settings) are implemented and functional.

Rather than rewrite history in `tasks.md`, this snapshot records the true state
as of the date above. The backend exposes **61 routes** across 14 routers, with
11 SQLAlchemy models and 13 Alembic migrations; the frontend has 8 pages and
~25 components.

## User story status

| Story | Title                              | Priority | Status        | Notes |
| ----- | ---------------------------------- | -------- | ------------- | ----- |
| US1   | Manual inventory addition          | P1 (MVP) | ✅ Done       | Add form, validation, duplicate handling |
| US2   | View and search inventory          | P1 (MVP) | ✅ Done       | List, search, filter, sort, pagination |
| US3   | Inventory updates and management   | P1 (MVP) | ✅ Done       | Edit, delete, consume |
| US4   | Multi-user access with roles       | P2       | ✅ Done       | Households, memberships, admin/editor/viewer, invitations |
| US5   | Barcode scanning                   | P2       | 🟡 Partial    | Open Food Facts lookup + scanner component done; camera-capture polish pending |
| US6   | API integration for external apps  | P2       | ❌ Missing    | No `APIClient` model/auth/endpoints despite `contracts/openapi.yaml` defining them — see Mealie integration epic |
| US7   | Image recognition                  | P3       | ❌ Missing    | No upload/recognition routes |

## Beyond-spec work already implemented

These were not separate user stories but are built and functional:

- Authentication: JWT access/refresh, registration, login, logout
- OAuth: Google and Authentik providers
- Email confirmation flow (with MailHog support in dev)
- Notifications: email settings + webhooks (HMAC-signed)
- Setup wizard (first admin + household bootstrap)
- Site administration (user/household management, site roles)
- Reverse-proxy / custom-domain / HTTPS system settings
- Custom per-household allergen tracking
- Dark mode

## Cross-cutting / infrastructure status

| Area                          | Status      | Notes |
| ----------------------------- | ----------- | ----- |
| Docker dev environment        | ✅ Done     | Self-initializing (migrate + seed + reload); see dev-environment docs |
| Database migrations (Alembic) | ✅ Done     | 13 revisions |
| REST API + Swagger            | ✅ Done     | `/api/docs`, `/api/redoc` |
| Automated test suite          | ❌ Missing  | Pytest scaffolding exists (`backend/tests/conftest.py`) but no real tests; only ad-hoc `backend/test_login.py`, `backend/test_setup.py`. No frontend tests. Conflicts with the constitution's Test-First (NON-NEGOTIABLE) principle |
| Photo/image upload (S3/MinIO) | ❌ Missing  | `inventory_items.photo_url` field exists; MinIO is in `infrastructure/`; no upload service/route |
| Import/export                 | ❌ Missing  | No routes |
| Rate limiting                 | 🟡 Partial  | `RATE_LIMIT_EXCEEDED` error + config exist; no enforcement middleware |
| Kubernetes manifests          | ❌ Missing  | `plan.md` targets K8s; only Docker Compose exists |
| Real-time updates (SSE)       | ❌ Missing  | Specified in contracts; not implemented |

## Near-term milestones (forward plan)

These feed the GitHub epics / project board:

1. **Mealie integration (US6)** — `APIClient` model + migration, client-credentials
   auth, ingredient-availability + bulk-check endpoints. _First coding target._
2. **Test-coverage hardening** — wire up pytest (backend) and Vitest/Playwright
   (frontend); satisfy the Test-First constitution principle.
3. **Import/export** — CSV/JSON import and export of inventory.
4. **Image/photo upload** — wire `photo_url` to S3/MinIO upload.
5. **Multi-language support**.
6. **Kubernetes deployment** — manifests for the production topology.
