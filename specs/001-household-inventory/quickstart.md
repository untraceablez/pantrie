# Quickstart Guide: Pantrie Development

**Date**: 2025-11-12
**Branch**: 001-household-inventory
**Prerequisites**: Docker, Docker Compose, Python 3.11+, Node.js 20+

## Overview

This guide will help you set up a local development environment for Pantrie, run tests, and deploy to Kubernetes.

---

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Running Backend](#running-backend)
3. [Running Frontend](#running-frontend)
4. [Running Tests](#running-tests)
5. [Building Containers](#building-containers)
6. [Kubernetes Deployment](#kubernetes-deployment)

---

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/pantrie/pantrie.git
cd pantrie
git checkout 001-household-inventory
```

### 2. Start Infrastructure Services (Docker Compose)

```bash
# Start PostgreSQL, Redis, and other services
docker-compose up -d

# Verify services are running
docker-compose ps
```

Services started:
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Mailhog (email testing): `localhost:8025` (UI), `localhost:1025` (SMTP)

### 3. Environment Variables

Create `.env` file in project root:

```bash
# Database
DATABASE_URL=postgresql://pantrie:pantrie@localhost:5432/pantrie

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT Secret (generate with: openssl rand -hex 32)
JWT_SECRET=your-secret-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15

# OAuth2 (optional for development)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# External APIs
OPEN_FOOD_FACTS_URL=https://world.openfoodfacts.org/api/v2
GOOGLE_VISION_API_KEY=your-google-vision-api-key

# S3 Storage (MinIO for local dev)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=pantrie-photos

# Email (Mailhog for local dev)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=noreply@pantrie.local

# Environment
ENVIRONMENT=development
DEBUG=true
```

---

## Running Backend

### 1. Setup Python Environment

```bash
cd backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements-dev.txt
```

### 2. Run Database Migrations

```bash
# Run Alembic migrations
alembic upgrade head

# Verify migrations applied
alembic current
```

### 3. Seed Database (Optional)

```bash
# Seed categories and locations
python -m src.db.seed
```

### 4. Start Development Server

```bash
# Start FastAPI dev server with auto-reload
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Or use Makefile
make dev
```

Backend running at: `http://localhost:8000`

API docs available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 5. Start Celery Worker (For Image Recognition)

In a separate terminal:

```bash
cd backend
source venv/bin/activate

# Start Celery worker
celery -A src.tasks.celery_app worker --loglevel=info

# Or use Makefile
make worker
```

---

## Running Frontend

### 1. Setup Node Environment

```bash
cd frontend

# Install dependencies
npm install
```

### 2. Configure Environment

Create `frontend/.env.local`:

```bash
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
```

### 3. Start Development Server

```bash
# Start Vite dev server
npm run dev

# Or use Makefile from project root
make frontend
```

Frontend running at: `http://localhost:5173`

### 4. Build for Production

```bash
npm run build

# Preview production build
npm run preview
```

---

## Running Tests

### Backend Tests

```bash
cd backend
source venv/bin/activate

# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test types
pytest tests/unit/
pytest tests/integration/
pytest tests/contract/

# Run with verbose output
pytest -v -s
```

**Test Database**: Tests use a separate database (`pantrie_test`) automatically created/destroyed per test session.

### Frontend Tests

```bash
cd frontend

# Run unit tests (Vitest)
npm run test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run E2E tests (Playwright)
npm run test:e2e

# Run E2E in UI mode
npm run test:e2e:ui
```

### E2E Test Setup

First time running E2E tests:

```bash
# Install Playwright browsers
npx playwright install
```

---

## Building Containers

### Build Backend Image

```bash
cd backend

# Build Docker image
docker build -t pantrie/backend:latest .

# Test image
docker run -p 8000:8000 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  pantrie/backend:latest
```

### Build Frontend Image

```bash
cd frontend

# Build Docker image
docker build -t pantrie/frontend:latest .

# Test image
docker run -p 80:80 pantrie/frontend:latest
```

### Build All Images (Docker Compose)

```bash
# Build all images
docker-compose build

# Start all services
docker-compose up
```

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (minikube, k3s, GKE, EKS, AKS)
- `kubectl` configured
- Docker images built and pushed to registry

### 1. Configure Image Registry

Update image references in `infrastructure/kubernetes/*.yaml`:

```yaml
# Example: backend-deployment.yaml
spec:
  containers:
    - name: backend
      image: your-registry/pantrie/backend:latest
```

### 2. Create Namespace

```bash
kubectl apply -f infrastructure/kubernetes/namespace.yaml
```

### 3. Create Secrets

```bash
# Create secret for sensitive values
kubectl create secret generic pantrie-secrets \
  --namespace=pantrie \
  --from-literal=database-url="postgresql://..." \
  --from-literal=jwt-secret="..." \
  --from-literal=google-vision-api-key="..."
```

### 4. Apply ConfigMaps

```bash
kubectl apply -f infrastructure/kubernetes/configmap.yaml
```

### 5. Deploy PostgreSQL

```bash
kubectl apply -f infrastructure/kubernetes/postgres-statefulset.yaml
```

Wait for PostgreSQL to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=postgres -n pantrie --timeout=300s
```

### 6. Deploy Redis

```bash
kubectl apply -f infrastructure/kubernetes/redis-deployment.yaml
```

### 7. Deploy Backend

```bash
kubectl apply -f infrastructure/kubernetes/backend-deployment.yaml
```

### 8. Deploy Celery Workers

```bash
kubectl apply -f infrastructure/kubernetes/worker-deployment.yaml
```

### 9. Deploy Frontend

```bash
kubectl apply -f infrastructure/kubernetes/frontend-deployment.yaml
```

### 10. Create Services

```bash
kubectl apply -f infrastructure/kubernetes/services.yaml
```

### 11. Configure Ingress

Update `infrastructure/kubernetes/ingress.yaml` with your domain:

```yaml
spec:
  rules:
    - host: pantrie.yourdomain.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend-service
                port:
                  number: 8000
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 80
```

Apply ingress:

```bash
kubectl apply -f infrastructure/kubernetes/ingress.yaml
```

### 12. Apply Horizontal Pod Autoscaler

```bash
kubectl apply -f infrastructure/kubernetes/hpa.yaml
```

### 13. Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n pantrie

# Check services
kubectl get services -n pantrie

# Check ingress
kubectl get ingress -n pantrie

# View logs
kubectl logs -f deployment/backend-deployment -n pantrie
kubectl logs -f deployment/frontend-deployment -n pantrie
```

### 14. Access Application

```bash
# Get ingress IP/hostname
kubectl get ingress -n pantrie

# Access application at configured domain or IP
curl https://pantrie.yourdomain.com/api/v1/health
```

---

## Database Migrations (Production)

### Run Migrations in Kubernetes

```bash
# Create one-time migration job
kubectl run migration-job \
  --image=your-registry/pantrie/backend:latest \
  --restart=Never \
  --namespace=pantrie \
  --command -- alembic upgrade head

# Check migration logs
kubectl logs migration-job -n pantrie

# Cleanup job
kubectl delete pod migration-job -n pantrie
```

---

## Troubleshooting

### Backend Issues

**Database connection errors**:
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
psql postgresql://pantrie:pantrie@localhost:5432/pantrie

# Check migrations
alembic current
```

**Redis connection errors**:
```bash
# Check Redis is running
docker-compose ps redis

# Test connection
redis-cli ping
```

### Frontend Issues

**API connection errors**:
- Verify backend is running: `curl http://localhost:8000/api/v1/health`
- Check `VITE_API_URL` in `.env.local`

**Build errors**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Kubernetes Issues

**Pods not starting**:
```bash
# Describe pod to see events
kubectl describe pod <pod-name> -n pantrie

# Check logs
kubectl logs <pod-name> -n pantrie

# Check resource limits
kubectl top pods -n pantrie
```

**Ingress not working**:
```bash
# Verify ingress controller is installed
kubectl get pods -n ingress-nginx

# Check ingress events
kubectl describe ingress pantrie-ingress -n pantrie
```

---

## Useful Commands

### Development

```bash
# Backend
make dev          # Start backend dev server
make worker       # Start Celery worker
make test         # Run backend tests
make lint         # Run linters (black, mypy, flake8)
make format       # Format code

# Frontend
make frontend     # Start frontend dev server
make test-frontend # Run frontend tests
make build-frontend # Build production bundle

# Database
make migrate      # Run migrations
make migrate-create NAME="description"  # Create new migration
make seed         # Seed database
```

### Docker Compose

```bash
docker-compose up -d          # Start all services
docker-compose down           # Stop all services
docker-compose logs -f        # Follow logs
docker-compose ps             # List services
docker-compose restart <service>  # Restart service
```

### Kubernetes

```bash
# Namespace operations
kubectl get all -n pantrie
kubectl delete all --all -n pantrie

# Scale deployments
kubectl scale deployment backend-deployment --replicas=5 -n pantrie

# Update image
kubectl set image deployment/backend-deployment backend=registry/pantrie/backend:v1.1 -n pantrie

# Rollback
kubectl rollout undo deployment/backend-deployment -n pantrie
```

---

## Next Steps

1. Read the [API Documentation](./contracts/README.md)
2. Review the [Data Model](./data-model.md)
3. Explore the [Research Document](./research.md) for technology decisions
4. Run `/speckit.tasks` to generate implementation task list

---

## Getting Help

- **Documentation**: https://docs.pantrie.io
- **GitHub Issues**: https://github.com/pantrie/pantrie/issues
- **Discord Community**: https://discord.gg/pantrie
