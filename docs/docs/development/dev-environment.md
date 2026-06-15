# Development Environment

This guide covers running Pantrie locally for development with live reload, so
you can see code changes immediately. There are two supported paths:

- **Full Docker (default)** — one command brings up the entire stack. Best for
  getting started and for working across the whole app.
- **Hybrid (native + Docker infra)** — run Postgres/Redis in Docker but run the
  backend and frontend natively. Best for fast iteration and step-through
  debugging with breakpoints.

Both paths hot-reload: backend changes restart Uvicorn automatically, and
frontend changes are applied instantly via Vite HMR.

## Prerequisites

- Docker 20.10+ and Docker Compose v2
- For the hybrid path: Python 3.11+, Node.js 20+

---

## Default — Full Docker

From the repository root:

```bash
docker compose up --build
```

This starts five services:

| Service  | URL / Port                     | Notes                              |
| -------- | ------------------------------ | ---------------------------------- |
| frontend | <http://localhost:5173>        | React + Vite dev server (HMR)      |
| backend  | <http://localhost:8000>        | FastAPI (Uvicorn `--reload`)       |
| nginx    | <http://localhost:8080>        | Reverse proxy for the full stack   |
| postgres | `localhost:5432`               | Database (`pantrie`/`pantrie`)     |
| redis    | `localhost:6379`               | Cache / sessions                   |

Useful URLs once it's up:

- App: <http://localhost:5173> (or via the proxy at <http://localhost:8080>)
- Swagger API docs: <http://localhost:8000/api/docs>
- ReDoc: <http://localhost:8000/api/redoc>

On first run the app needs initial setup — open the app and complete the setup
wizard to create the first admin user and household.

### How startup works

The backend container runs `backend/docker-entrypoint.dev.sh`, which:

1. Applies database migrations (`alembic upgrade head`).
2. Seeds global data (categories) — idempotent, skipped if already present.
3. Starts Uvicorn with `--reload`.

This means a fresh checkout (or a fresh volume) boots into a working,
migrated database with no manual steps. Migrations are required for boot; if a
migration fails, the container stops. Seeding is best-effort and will not block
startup.

!!! note "Locations are not seeded"
    Storage locations are household-scoped (created per household through the
    app), so there are no global default locations to seed. Only globally
    shared data (categories) is seeded.

### Hot reload

- **Backend**: `./backend` is bind-mounted into the container, and Uvicorn runs
  with `--reload`. Editing any file under `backend/src/` restarts the server.
- **Frontend**: `./frontend` is bind-mounted, and Vite's dev server applies
  changes via Hot Module Replacement without a full reload.

### Helper scripts

```bash
./scripts/docker-start.sh        # build + start the stack
./scripts/docker-stop.sh         # stop (preserves data volumes)
./scripts/docker-logs.sh         # tail all logs
./scripts/docker-logs.sh backend # tail one service
./scripts/docker-shell.sh backend   # shell into a container
./scripts/docker-shell.sh postgres  # psql into the database
./scripts/docker-reset.sh        # WARNING: down -v, deletes all data
```

To start completely fresh (wipe the database and rebuild):

```bash
docker compose down -v && docker compose up --build
```

---

## Hybrid — native backend/frontend + Docker infra

Run only the stateful infrastructure in Docker and run the application
processes natively. This gives the fastest reload loop and lets you attach a
debugger.

### 1. Start infrastructure

```bash
docker compose -f infrastructure/docker-compose.yml up -d postgres redis
```

The `infrastructure/` compose file also includes optional dev services:

- **MailHog** — captures outgoing email. SMTP on `:1025`, web UI on
  <http://localhost:8025>.
- **MinIO** — S3-compatible object storage. API on `:9000`, console on
  <http://localhost:9001>.

Start them too if you're working on email or file uploads:

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

### 2. Backend (native)

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # adjust as needed
alembic upgrade head
python -m src.db.seed             # optional: seed categories
uvicorn src.main:app --reload
```

The backend listens on <http://localhost:8000>. `--reload` restarts on code
changes. To debug, run Uvicorn from your IDE's debugger instead and set
breakpoints in `backend/src/`.

### 3. Frontend (native)

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server listens on <http://localhost:5173> with HMR. API requests
to `/api` are proxied to the backend — the target is controlled by
`VITE_PROXY_TARGET` (see `frontend/vite.config.ts`), defaulting to
`http://localhost:8000`.

---

## Choosing a path

| Need                                   | Use         |
| -------------------------------------- | ----------- |
| Quick start, whole-stack work          | Full Docker |
| Step-through debugging / breakpoints   | Hybrid      |
| Fastest reload loop                    | Hybrid      |
| Closest to production topology (nginx) | Full Docker |

## Troubleshooting

- **Database errors on first request**: ensure migrations ran. In Docker this
  is automatic; natively, run `alembic upgrade head`.
- **Port already in use**: another process is on 5173/8000/8080/5432/6379. Stop
  it or adjust the port mapping in the relevant compose file.
- **Frontend can't reach the API (hybrid)**: confirm the backend is running on
  `:8000` and `VITE_PROXY_TARGET` points to it.
