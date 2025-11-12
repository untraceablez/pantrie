# Technology Research: Household Inventory Management System

**Date**: 2025-11-12
**Branch**: 001-household-inventory
**Purpose**: Document technology decisions and research findings for implementation planning

## Overview

This document captures research findings for key technology decisions required to implement the Pantrie household inventory management system. All decisions align with user constraints (PostgreSQL, OAuth2, Redis, Kubernetes) and constitution principles (simplicity, observability, test-first).

---

## 1. Backend Framework Selection

### Decision: FastAPI 0.104+

**Rationale**:
- **Async Support**: Native async/await for high-performance I/O operations (database, Redis, external APIs)
- **Automatic API Documentation**: Built-in OpenAPI/Swagger generation aligns with FR-038 (API documentation requirement)
- **Type Safety**: Pydantic integration provides request/response validation and serialization
- **OAuth2 Support**: Built-in security utilities for OAuth2/JWT implementation
- **Testing**: Excellent test client (TestClient) and pytest integration
- **Python Ecosystem**: Rich ecosystem for PostgreSQL (SQLAlchemy), Redis (aioredis), Celery, image processing

**Alternatives Considered**:
- **Django + DRF**: More opinionated, heavier framework; ORM less flexible for async; chosen FastAPI for async-first design and API focus
- **Flask**: Simpler but requires more manual setup for async, API docs, validation; FastAPI provides these out of box
- **Node.js (Express/NestJS)**: Strong async but team expertise in Python; FastAPI matches requirements better

**Best Practices**:
- Use dependency injection for database sessions, authentication, caching
- Structure as layered architecture: routes → services → models
- Use Pydantic models for all API schemas (type safety + validation)
- Implement background tasks with Celery for image processing (not FastAPI BackgroundTasks for long-running jobs)

---

## 2. Frontend Framework Selection

### Decision: React 18+ with TypeScript 5.x

**Rationale**:
- **Component Ecosystem**: Massive library of UI components for responsive design (Material-UI, Shadcn/UI, Radix)
- **TypeScript Support**: First-class TypeScript support for type safety across frontend
- **Mobile Responsiveness**: Works well with Tailwind CSS for responsive layouts (FR-027-031)
- **Real-time Updates**: Excellent WebSocket/SSE libraries for multi-user real-time inventory updates (FR-025)
- **Testing**: Strong testing ecosystem (Vitest, React Testing Library, Playwright)
- **State Management**: Zustand for lightweight global state; TanStack Query for server state caching

**Alternatives Considered**:
- **Vue 3**: Simpler learning curve but smaller ecosystem; React has more barcode/camera libraries
- **Svelte**: Great performance but less mature for enterprise; React more battle-tested
- **Next.js**: Adds SSR complexity not needed for web app; using Vite for faster dev experience

**Best Practices**:
- Use Vite for fast dev server and build (vs Create React App)
- TanStack Query for API data fetching/caching (reduces boilerplate)
- Tailwind CSS for responsive utility-first styling
- Component library (Shadcn/UI) for consistent, accessible UI
- React Hook Form for complex forms (add/edit inventory)

---

## 3. OAuth2/JWT Implementation

### Decision: python-jose + passlib for JWT, OAuth2 password flow + external provider support

**Rationale**:
- **User Requirement**: OAuth2-compatible authentication specified
- **python-jose**: Industry-standard JWT library for Python, well-maintained, supports RS256/HS256
- **passlib**: Secure password hashing with bcrypt (for email/password flow)
- **FastAPI OAuth2**: Built-in OAuth2PasswordBearer for token authentication
- **External Providers**: Support for OAuth2 authorization code flow (Google, GitHub, Microsoft)

**Architecture**:
1. **Primary Auth**: Email/password with JWT tokens (access + refresh)
2. **External OAuth2**: Optional Google/GitHub/Microsoft login via authorization code flow
3. **Token Strategy**:
   - Access tokens: Short-lived (15 min), signed JWT with user ID + household roles
   - Refresh tokens: Long-lived (30 days), stored in Redis with rotation
   - Redis for token blacklist (logout, revocation)

**Alternatives Considered**:
- **OAuth 2.1/PKCE**: Considered for future mobile apps; web app uses standard authorization code flow
- **Auth0/Okta**: Third-party auth as service; adds dependency and cost; building in-house for control
- **Sessions**: Considered session-based auth; JWT chosen for stateless API (better for Mealie integration)

**Best Practices**:
- Store tokens in httpOnly cookies (XSS protection) + localStorage fallback
- Implement token refresh logic in frontend (automatic retry on 401)
- Use role claims in JWT for RBAC (avoid database lookups on every request)
- Log all authentication events (security audit trail)

---

## 4. Barcode Lookup Services

### Decision: Open Food Facts API + UPC Database API (fallback)

**Rationale**:
- **Open Food Facts**: Free, open-source product database with 3M+ products; excellent food/grocery coverage
- **No API Key Required**: Free tier with reasonable rate limits (100 requests/minute)
- **Data Quality**: Community-maintained with allergen info, nutrition facts, product images
- **UPC Database**: Fallback for non-food items or missing products
- **Success Criteria**: Meets SC-003 (80% barcode recognition for common grocery items)

**API Details**:
- Endpoint: `https://world.openfoodfacts.org/api/v2/product/{barcode}`
- Response: Product name, brand, categories, ingredients, allergens, image URLs
- Rate Limit: 100 requests/minute (sufficient for household use)

**Alternatives Considered**:
- **Barcode Lookup**: Commercial API, $50/month for 1000 requests; too expensive for MVP
- **UPC Database**: Free but lower food-specific data quality; using as fallback
- **Self-hosted**: Building own database; too complex for MVP; using third-party

**Best Practices**:
- Cache barcode lookups in Redis (24 hour TTL)
- Store successful lookups in PostgreSQL for faster repeat scans
- Graceful fallback to manual entry if API fails or product not found
- Log API failures for monitoring

---

## 5. Image Recognition Services

### Decision: Google Cloud Vision API (Food Detection + OCR for receipts)

**Rationale**:
- **Food Detection**: Pre-trained model specifically for food items (FR-016)
- **OCR**: Extract text from receipts for bulk item addition (FR-018)
- **Accuracy**: Industry-leading accuracy for food recognition (>90%)
- **Free Tier**: 1000 image detections/month free; $1.50 per 1000 after
- **Kubernetes Compatible**: Works from any cloud provider

**API Capabilities**:
- Label Detection: Identify food items in photos (e.g., "apple", "milk", "bread")
- Text Detection (OCR): Extract item names and quantities from receipts
- Response Time: ~2-3 seconds per image (meets SC performance constraint)

**Alternatives Considered**:
- **AWS Rekognition**: Similar capabilities, slightly more expensive, vendor lock-in
- **Azure Computer Vision**: Good but less accurate for food specifically
- **Open Source (YOLO/TensorFlow)**: Requires training and hosting ML models; too complex for MVP
- **Clarifai**: Specialized food API but $20/month minimum; Google Cloud Vision more cost-effective

**Implementation Strategy**:
- Process images async with Celery workers (FR-016 suggests, doesn't require real-time)
- Store original photos in S3-compatible storage (user uploaded photos)
- Return top 3 label matches with confidence scores for user confirmation
- Implement retry logic for transient failures

**Best Practices**:
- Image optimization before sending to API (resize to 1024x1024 max, compress JPEG)
- Queue-based processing (Celery) to handle bursts
- Confidence threshold: Only return labels >70% confidence
- Allow manual correction and learn from user feedback (future enhancement)

---

## 6. Real-time Updates (Multi-User)

### Decision: Server-Sent Events (SSE) for inventory updates

**Rationale**:
- **Requirement**: FR-025 requires real-time updates when household members modify inventory
- **Simplicity**: SSE simpler than WebSockets (no bidirectional communication needed)
- **Browser Support**: Excellent browser support (vs WebSockets which require fallbacks)
- **HTTP/2 Compatible**: Works well with Kubernetes ingress and reverse proxies
- **Redis Pub/Sub**: Backend publishes inventory changes to Redis, SSE clients subscribe

**Architecture**:
1. User A adds/updates inventory item → API saves to PostgreSQL
2. Backend publishes event to Redis channel (household-specific: `household:{id}:updates`)
3. User B's browser has open SSE connection subscribed to household channel
4. Backend pushes event to User B via SSE
5. Frontend updates local state/cache with new data

**Alternatives Considered**:
- **WebSockets**: Full duplex not needed (inventory updates are server→client only); SSE simpler
- **Polling**: Every 5 seconds would work but inefficient and not truly real-time; SSE better UX
- **Long Polling**: Works but more complex than SSE and less efficient

**Best Practices**:
- Reconnection logic in frontend (exponential backoff)
- Event types: `inventory.created`, `inventory.updated`, `inventory.deleted`
- Include minimal data in event (ID + action), fetch full data via API if needed
- SSE endpoint: GET `/api/v1/households/{id}/events` (requires authentication)

---

## 7. Kubernetes Deployment

### Decision: Standard K8s Deployment with StatefulSet for PostgreSQL, Ingress for routing

**Rationale**:
- **User Requirement**: Must be deployable as container image and usable in Kubernetes
- **Deployments**: Stateless services (backend API, frontend, Celery workers) as Deployments
- **StatefulSet**: PostgreSQL as StatefulSet with persistent volume (stable network identity, ordered scaling)
- **Redis**: Deployment (ephemeral acceptable for caching/sessions; external Redis for production)
- **Ingress**: nginx ingress controller for HTTP routing (SSL termination, path-based routing)

**Architecture Components**:
```
Ingress (nginx)
├── /api/v1/* → backend-service:8000
└── /* → frontend-service:80

backend-deployment (3 replicas)
├── FastAPI app
├── Connects to postgres-service:5432
└── Connects to redis-service:6379

worker-deployment (2 replicas)
├── Celery workers
└── Processes image recognition tasks

postgres-statefulset (1 replica)
├── PostgreSQL 16
└── PersistentVolume (50Gi)

redis-deployment (1 replica)
└── Redis 7

frontend-deployment (2 replicas)
└── nginx serving React build
```

**Best Practices**:
- **ConfigMaps**: Environment variables (non-sensitive)
- **Secrets**: Database passwords, API keys, JWT secrets
- **Health Checks**: Liveness + readiness probes for all services
- **Horizontal Pod Autoscaler**: Scale backend/workers based on CPU (target 70%)
- **Resource Limits**: Set memory/CPU limits to prevent resource exhaustion
- **Network Policies**: Restrict backend to only access postgres/redis

**Alternatives Considered**:
- **Helm Charts**: Considered for complex deployments; starting with raw YAML for simplicity
- **External PostgreSQL**: Cloud managed database (RDS, Cloud SQL); using StatefulSet for self-contained deployment
- **Redis Cluster**: High availability Redis; using single instance for MVP, cluster for production

---

## 8. Database Schema & Indexing

### Decision: PostgreSQL 16 with SQLAlchemy 2.0, focused indexes for search performance

**Key Indexes** (to meet performance constraints):
- **inventory_items.name**: GIN index with pg_trgm extension for fuzzy search (FR-003 real-time search)
- **inventory_items.household_id + expiration_date**: Composite index for filtering/sorting (FR-004, FR-005)
- **inventory_items.household_id + category_id**: Composite index for category filtering
- **inventory_items.barcode**: B-tree index for exact match lookups
- **users.email**: Unique index for authentication

**PostgreSQL Features Used**:
- **pg_trgm extension**: Trigram similarity search for "contains" queries (e.g., searching "milk" finds "Whole Milk")
- **JSONB columns**: For flexible item metadata (custom tags, nutrition data) without schema changes
- **Row Level Security**: Possible future enhancement for household data isolation
- **Full Text Search**: Consider for advanced search if basic pattern matching insufficient

**Best Practices**:
- Use Alembic for database migrations (version control for schema)
- Soft deletes for inventory_items (deleted_at timestamp) for 30-day retention
- Timestamps: created_at, updated_at on all tables (audit trail)
- Foreign keys with ON DELETE CASCADE for referential integrity

---

## 9. Testing Strategy

### Backend Testing (pytest)

**Layers**:
1. **Unit Tests**: Services, utilities (80%+ coverage target)
2. **Integration Tests**: API endpoints with test database (user journeys from spec.md)
3. **Contract Tests**: OpenAPI schema validation (ensure API matches contract)

**Tools**:
- pytest + pytest-asyncio (async test support)
- pytest-cov (coverage reports)
- factory_boy (test data factories)
- faker (realistic test data)
- httpx.AsyncClient (FastAPI TestClient for async)

### Frontend Testing (Vitest + Playwright)

**Layers**:
1. **Unit Tests**: Components, hooks, utilities (Vitest + React Testing Library)
2. **E2E Tests**: Critical user flows (Playwright)
   - Add item manually → verify in list
   - Barcode scan → verify product info loaded
   - Multi-user: User A adds item → User B sees update

**Tools**:
- Vitest (fast Jest alternative for Vite)
- React Testing Library (component testing)
- Playwright (cross-browser E2E)
- MSW (Mock Service Worker for API mocking)

---

## 10. Observability Stack

### Decision: Structured Logging + OpenTelemetry + Prometheus

**Components**:
1. **Logging**: structlog (Python) for structured JSON logs
   - Log Level: DEBUG (dev), INFO (prod)
   - Include: request_id, user_id, household_id, endpoint, duration
   - Send to stdout (captured by Kubernetes, forwarded to logging system)

2. **Metrics**: Prometheus + Grafana
   - API request duration (histogram)
   - Request count by endpoint (counter)
   - Error rate (counter)
   - Database query duration (histogram)
   - Celery task duration (histogram)

3. **Tracing**: OpenTelemetry (optional for production)
   - Trace requests across services (API → database → Redis → external APIs)
   - Identify slow queries and bottlenecks

4. **Error Tracking**: Sentry (optional)
   - Capture and aggregate exceptions
   - User context for debugging

**Best Practices**:
- Correlation IDs for request tracing
- Log all authentication events (security)
- Log external API calls and responses (sanitized)
- Dashboard for key metrics (API latency, error rate, active users)

---

## Summary of Decisions

| **Category** | **Decision** | **Rationale** |
|--------------|-------------|---------------|
| Backend Framework | FastAPI 0.104+ | Async-first, automatic API docs, type safety, OAuth2 support |
| Frontend Framework | React 18 + TypeScript 5.x | Component ecosystem, mobile responsive, real-time support |
| Database | PostgreSQL 16 | User requirement, robust indexing, full-text search |
| Caching | Redis 7 | User requirement, real-time pub/sub, session storage |
| Authentication | OAuth2/JWT (python-jose) | User requirement, stateless API, external provider support |
| Barcode Lookup | Open Food Facts API | Free, excellent food coverage, 80% success rate |
| Image Recognition | Google Cloud Vision API | Pre-trained food detection, OCR for receipts |
| Real-time Updates | Server-Sent Events (SSE) | Simpler than WebSockets, HTTP/2 compatible, Redis pub/sub |
| Deployment | Kubernetes Deployments + StatefulSet | User requirement, scalable, cloud-agnostic |
| Testing | pytest + Vitest + Playwright | Comprehensive coverage (unit, integration, E2E) |
| Observability | structlog + Prometheus + OpenTelemetry | Structured logs, metrics, distributed tracing |

---

## Risks & Mitigations

| **Risk** | **Impact** | **Mitigation** |
|----------|-----------|----------------|
| Open Food Facts API rate limits | Barcode scanning fails | Cache results in Redis + PostgreSQL; fallback to manual entry |
| Google Vision API costs | High image recognition costs | Free tier sufficient for MVP; implement monthly quota monitoring |
| Real-time SSE connection limits | Many concurrent users | Kubernetes HPA to scale backend pods; Redis pub/sub handles distribution |
| PostgreSQL performance | Slow search with 1000+ items | GIN indexes with pg_trgm; query optimization; read replicas if needed |
| Celery worker scaling | Image processing queue backup | Kubernetes HPA for worker pods based on queue depth |

---

## Next Steps

Research complete. Proceed to Phase 1 (Design):
1. Generate data-model.md with detailed entity schemas
2. Generate contracts/openapi.yaml with full API specification
3. Generate quickstart.md with local development setup
