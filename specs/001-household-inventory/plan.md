# Implementation Plan: Household Inventory Management System

**Branch**: `001-household-inventory` | **Date**: 2025-11-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-household-inventory/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a responsive web application for household food inventory management with multi-user support, role-based access control, multiple item entry methods (manual, barcode, image recognition), and API integration for external applications like Mealie. The system will support collaborative household inventory tracking with real-time updates, deployed as containerized microservices on Kubernetes.

**Technical Approach**: Modern web application stack with Python/FastAPI backend, React frontend, PostgreSQL database, OAuth2 authentication, Redis caching, and REST API. Containerized architecture with separate services for web API, image processing, and background jobs.

## Technical Context

**Language/Version**: Python 3.11 (backend), Node.js 20 LTS (frontend build), TypeScript 5.x (frontend)
**Primary Dependencies**:
- Backend: FastAPI 0.104+, SQLAlchemy 2.0+, Alembic, Pydantic, python-jose (OAuth2/JWT), Celery, aioredis
- Frontend: React 18+, TypeScript, TanStack Query, Zustand, Tailwind CSS, React Router
- Services: PostgreSQL 16, Redis 7, nginx (reverse proxy)

**Storage**: PostgreSQL 16 (primary data), Redis 7 (caching, sessions, real-time updates), S3-compatible object storage (photos)
**Testing**: pytest + pytest-asyncio (backend), Vitest + React Testing Library (frontend), Playwright (E2E)
**Target Platform**: Linux containers (Docker), Kubernetes 1.27+, cloud-agnostic (AWS/GCP/Azure compatible)
**Project Type**: Web application (frontend + backend separated)
**Performance Goals**:
- API response time: <200ms p95 for CRUD operations, <500ms p95 for search
- Support 100 concurrent users per household
- Real-time updates propagated within 2 seconds
- Image recognition processing: <5 seconds per image

**Constraints**:
- Must be container-deployable with Kubernetes manifests
- OAuth2-compatible authentication (support for external identity providers)
- RESTful API for Mealie integration
- Mobile-responsive web UI (no native apps)
- PostgreSQL database with proper indexing for search performance

**Scale/Scope**:
- Initial: 100 households, 1000 inventory items per household
- Target: 10,000 households within first year
- API rate limit: 1000 requests/hour per API client

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Review against `.specify/memory/constitution.md` principles:

- **I. Specification-First**: ✅ Feature has spec.md with 7 prioritized user stories and 43 functional requirements
- **II. Test-First Development**: ✅ Plan includes pytest for backend unit/integration, Vitest for frontend, Playwright for E2E; contract tests for API boundaries; integration tests for multi-user scenarios
- **III. Simplicity & YAGNI**: ✅ Starting with proven patterns (FastAPI + React), avoiding microservices complexity until needed, using managed services where possible
- **IV. Observability**: ✅ Plan includes structured logging (structlog), OpenTelemetry for tracing, Prometheus metrics, error tracking (Sentry)
- **V. User-Centric Design**: ✅ All 7 user stories address real food inventory management needs; responsive design for all devices; Mealie integration for meal planning workflow

**Food Domain Specifics** (from constitution Technical Standards):
- [x] Measurement handling (metric/imperial conversions) - Handled by quantity field with unit type
- [x] Allergen and dietary information tracking - Category and custom tags support
- [x] Recipe scaling proportional calculations - Deferred to Mealie; Pantrie provides ingredient availability
- [x] Data integrity for nutrition/ingredient data - Third-party barcode database (Open Food Facts) as source of truth

**Pass/Fail**: ✅ PASS

All constitution principles satisfied. No complexity violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-household-inventory/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── openapi.yaml     # REST API specification
│   └── README.md        # API documentation
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── main.py                 # FastAPI application entry point
│   ├── config.py               # Configuration management
│   ├── models/                 # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── household.py
│   │   ├── inventory_item.py
│   │   ├── category.py
│   │   ├── location.py
│   │   └── api_client.py
│   ├── schemas/                # Pydantic request/response schemas
│   │   ├── user.py
│   │   ├── household.py
│   │   ├── inventory.py
│   │   └── auth.py
│   ├── api/                    # API route handlers
│   │   ├── v1/
│   │   │   ├── auth.py         # Authentication endpoints
│   │   │   ├── users.py        # User management
│   │   │   ├── households.py   # Household management
│   │   │   ├── inventory.py    # Inventory CRUD + search
│   │   │   ├── barcodes.py     # Barcode lookup
│   │   │   └── images.py       # Image recognition
│   │   └── deps.py             # Dependency injection (DB, auth, etc.)
│   ├── services/               # Business logic layer
│   │   ├── auth_service.py     # OAuth2/JWT handling
│   │   ├── inventory_service.py
│   │   ├── household_service.py
│   │   ├── barcode_service.py  # Third-party API integration
│   │   ├── image_service.py    # Image recognition integration
│   │   └── notification_service.py
│   ├── db/                     # Database utilities
│   │   ├── base.py             # SQLAlchemy base
│   │   ├── session.py          # Database session management
│   │   └── migrations/         # Alembic migrations
│   ├── cache/                  # Redis caching layer
│   │   └── cache_service.py
│   ├── tasks/                  # Celery background tasks
│   │   ├── image_recognition.py
│   │   └── notifications.py
│   └── utils/                  # Shared utilities
│       ├── logging.py          # Structured logging setup
│       ├── security.py         # Password hashing, etc.
│       └── exceptions.py       # Custom exceptions
├── tests/
│   ├── contract/               # API contract tests
│   │   └── test_api_v1.py
│   ├── integration/            # Integration tests
│   │   ├── test_inventory_flow.py
│   │   ├── test_multiuser.py
│   │   └── test_mealie_integration.py
│   └── unit/                   # Unit tests
│       ├── test_services/
│       └── test_models/
├── Dockerfile
├── requirements.txt
├── requirements-dev.txt
└── pyproject.toml

frontend/
├── src/
│   ├── main.tsx                # Application entry point
│   ├── App.tsx                 # Root component
│   ├── components/             # Reusable UI components
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── MobileNav.tsx
│   │   ├── inventory/
│   │   │   ├── InventoryList.tsx
│   │   │   ├── InventoryItem.tsx
│   │   │   ├── AddItemForm.tsx
│   │   │   ├── EditItemForm.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   └── FilterPanel.tsx
│   │   ├── barcode/
│   │   │   ├── BarcodeScanner.tsx
│   │   │   └── CameraCapture.tsx
│   │   ├── image/
│   │   │   ├── ImageUpload.tsx
│   │   │   └── RecognitionResults.tsx
│   │   ├── household/
│   │   │   ├── MemberList.tsx
│   │   │   ├── InviteForm.tsx
│   │   │   └── RoleSelector.tsx
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       └── Toast.tsx
│   ├── pages/                  # Route pages
│   │   ├── Dashboard.tsx
│   │   ├── Inventory.tsx
│   │   ├── AddItem.tsx
│   │   ├── ItemDetail.tsx
│   │   ├── Household.tsx
│   │   ├── Login.tsx
│   │   └── Register.tsx
│   ├── services/               # API client services
│   │   ├── api.ts              # Axios base configuration
│   │   ├── auth.ts             # Authentication API
│   │   ├── inventory.ts        # Inventory API
│   │   ├── household.ts        # Household API
│   │   └── websocket.ts        # Real-time updates
│   ├── stores/                 # State management (Zustand)
│   │   ├── authStore.ts
│   │   ├── inventoryStore.ts
│   │   └── householdStore.ts
│   ├── hooks/                  # Custom React hooks
│   │   ├── useInventory.ts
│   │   ├── useRealtime.ts
│   │   └── useAuth.ts
│   ├── types/                  # TypeScript types
│   │   ├── inventory.ts
│   │   ├── user.ts
│   │   └── api.ts
│   └── utils/                  # Utility functions
│       ├── date.ts
│       ├── validation.ts
│       └── format.ts
├── tests/
│   ├── unit/                   # Component unit tests
│   └── e2e/                    # Playwright E2E tests
│       ├── inventory.spec.ts
│       ├── multiuser.spec.ts
│       └── barcode.spec.ts
├── public/
│   ├── index.html
│   └── assets/
├── Dockerfile
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js

infrastructure/
├── kubernetes/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── backend-deployment.yaml
│   ├── frontend-deployment.yaml
│   ├── worker-deployment.yaml      # Celery workers
│   ├── postgres-statefulset.yaml
│   ├── redis-deployment.yaml
│   ├── services.yaml
│   ├── ingress.yaml
│   └── hpa.yaml                     # Horizontal Pod Autoscaler
├── docker-compose.yml               # Local development environment
└── README.md

.github/
└── workflows/
    ├── backend-tests.yml
    ├── frontend-tests.yml
    ├── e2e-tests.yml
    └── deploy.yml

docs/
├── API.md                           # API documentation
├── DEPLOYMENT.md                    # Kubernetes deployment guide
├── DEVELOPMENT.md                   # Local development setup
└── ARCHITECTURE.md                  # System architecture overview
```

**Structure Decision**: Web application structure (Option 2) selected because the feature requires both a responsive web UI and a robust API backend. This separation allows:
- Independent scaling of frontend and backend
- Clear API boundary for Mealie integration
- Dedicated worker processes for image recognition
- Standard web deployment patterns with nginx reverse proxy

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations requiring justification. All complexity is justified by requirements:
- **Separate Frontend/Backend**: Required for API access by Mealie and responsive web UI
- **Celery Workers**: Required for async image recognition processing (5+ seconds per image)
- **Redis**: Required for real-time multi-user updates and session management
- **Kubernetes**: Required by user constraint for container deployment

---

## Phase 0: Research & Technology Selection

**Status**: COMPLETE (research findings below)

### Research Topics

Research completed during planning phase to resolve technical decisions:

1. **Backend Framework Selection** (Python ecosystem)
2. **Frontend Framework Selection** (TypeScript-based)
3. **OAuth2/JWT Implementation** (Python libraries)
4. **Barcode Lookup Services** (Third-party APIs)
5. **Image Recognition Services** (ML/AI APIs)
6. **Real-time Updates** (WebSocket vs Server-Sent Events vs Polling)
7. **Kubernetes Deployment** (Best practices for web apps)

**Output**: See research.md (to be generated in next step)

---

## Phase 1: Design Artifacts

**Status**: PENDING

### Data Model

**Output**: See data-model.md (to be generated)

Key entities to be detailed:
- User (authentication, profile, household memberships)
- Household (shared inventory space, member roles)
- InventoryItem (food items with all metadata)
- Category, Location (classifications)
- APIClient (external application credentials)
- InvitationToken (household member invitations)

### API Contracts

**Output**: See contracts/openapi.yaml (to be generated)

REST API endpoints to be specified:
- Authentication: POST /api/v1/auth/login, /register, /refresh, /oauth/callback
- Households: GET/POST /api/v1/households, GET/PUT/DELETE /api/v1/households/{id}, POST /api/v1/households/{id}/invite
- Inventory: GET/POST /api/v1/inventory, GET/PUT/DELETE /api/v1/inventory/{id}, GET /api/v1/inventory/search
- Barcodes: POST /api/v1/barcodes/lookup
- Images: POST /api/v1/images/recognize
- Users: GET/PUT /api/v1/users/me, GET /api/v1/users/{id}

### Quickstart Guide

**Output**: See quickstart.md (to be generated)

Setup instructions for:
- Local development with docker-compose
- Running backend tests
- Running frontend tests
- Building containers
- Deploying to Kubernetes

---

## Next Steps

After plan approval:

1. **Generate research.md**: Detailed technology research findings
2. **Generate data-model.md**: Complete entity relationship diagram and field specifications
3. **Generate contracts/openapi.yaml**: Full REST API specification
4. **Generate quickstart.md**: Developer onboarding guide
5. **Run `/speckit.tasks`**: Convert plan into executable task list with dependencies
