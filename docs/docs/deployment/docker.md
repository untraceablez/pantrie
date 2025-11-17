# Docker Development Guide

This guide covers running Pantrie in Docker for development.

## Quick Start

```bash
# Start all services
./scripts/docker-start.sh

# Visit http://localhost:5173 to access the application
```

## Services

The Docker setup includes:

- **PostgreSQL** (port 5432) - Main database
- **Redis** (port 6379) - Caching and real-time features  
- **Backend** (port 8000) - FastAPI application
- **Frontend** (port 5173) - React + Vite development server

## Management Commands

```bash
# Start the environment
./scripts/docker-start.sh

# Stop all services (preserves data)
./scripts/docker-stop.sh

# View logs for all services
./scripts/docker-logs.sh

# View logs for a specific service
./scripts/docker-logs.sh backend
./scripts/docker-logs.sh frontend

# Open a shell in a container
./scripts/docker-shell.sh backend   # Opens bash in backend
./scripts/docker-shell.sh frontend  # Opens sh in frontend
./scripts/docker-shell.sh postgres  # Opens psql console
./scripts/docker-shell.sh redis     # Opens redis-cli

# Reset everything (WARNING: deletes all data!)
./scripts/docker-reset.sh
```

## Manual Docker Compose Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild containers
docker-compose up -d --build

# Run migrations
docker-compose exec -T backend alembic upgrade head

# Access database
docker-compose exec -T postgres psql -U pantrie -d pantrie
```

## Volumes

Data is persisted in Docker volumes:

- `pantrie_postgres-data` - Database data
- `pantrie_redis-data` - Redis data
- `pantrie_backend-venv` - Python virtual environment (for faster rebuilds)
- `pantrie_frontend-node-modules` - Node modules (for faster rebuilds)

To completely remove all data:
```bash
docker-compose down -v
```

## Development Workflow

1. **First time setup:**
   ```bash
   ./scripts/docker-start.sh
   ```
   Visit http://localhost:5173 and complete the initial setup wizard.

2. **Daily development:**
   - Code changes in `./backend` and `./frontend` are automatically reloaded
   - Backend: uvicorn --reload watches for Python file changes
   - Frontend: Vite HMR provides instant updates

3. **Database changes:**
   ```bash
   # Create a new migration
   docker-compose exec -T backend alembic revision --autogenerate -m "description"
   
   # Apply migrations
   docker-compose exec -T backend alembic upgrade head
   ```

4. **Viewing logs:**
   ```bash
   ./scripts/docker-logs.sh backend
   ```

5. **Resetting the database:**
   ```bash
   ./scripts/docker-reset.sh
   ./scripts/docker-start.sh
   ```

## Troubleshooting

### Containers won't start
```bash
# Remove old containers
docker-compose down
docker rm -f pantrie-backend pantrie-frontend pantrie-postgres pantrie-redis

# Try again
./scripts/docker-start.sh
```

### Database connection errors
```bash
# Check if PostgreSQL is healthy
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres

# Restart just the backend
docker-compose restart backend
```

### Frontend not loading
```bash
# Check frontend logs
docker-compose logs frontend

# Rebuild frontend
docker-compose up -d --build frontend
```

### Port conflicts
If ports 5173, 8000, 5432, or 6379 are already in use, you'll need to either:
- Stop the conflicting service
- Modify the ports in `docker-compose.yml`

## Performance Tips

1. **Use volumes for dependencies** - The setup already mounts `node_modules` and `.venv` as volumes for faster rebuilds

2. **Limit log size** - Add to `docker-compose.yml` for each service:
   ```yaml
   logging:
     options:
       max-size: "10m"
       max-file: "3"
   ```

3. **Prune unused resources** periodically:
   ```bash
   docker system prune -a --volumes
   ```
