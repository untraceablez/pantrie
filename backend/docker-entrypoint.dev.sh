#!/bin/sh
# Dev container entrypoint: ensure the schema is migrated and base data is
# seeded before starting the hot-reloading API server. Safe to run on every
# boot — `alembic upgrade head` is a no-op when up to date, and `src.db.seed`
# skips categories/locations that already exist.
set -e

echo "[entrypoint] Applying database migrations..."
alembic upgrade head

echo "[entrypoint] Seeding initial data (idempotent)..."
# Seeding is best-effort: a failure here should not stop the API from starting.
python -m src.db.seed || echo "[entrypoint] WARNING: seeding failed; continuing startup."

echo "[entrypoint] Starting uvicorn (reload enabled)..."
exec uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
