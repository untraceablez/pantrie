# Troubleshooting Guide

This guide covers common issues and their solutions.

## Frontend Issues

### Issue: Registration/Login Returns 404 Not Found

**Error Message:** Backend logs show:
```
POST api/auth/register HTTP/1.1" 404 Not Found
```

**Cause:** Incorrect API base URL in frontend.

**Solution:**
The issue has been fixed in `frontend/src/services/api.ts`. If you modified this file, ensure the baseURL is:
```typescript
baseURL: `${API_BASE_URL}/api/v1`,  // Correct - includes /v1
```

Not:
```typescript
baseURL: `${API_BASE_URL}/api`,  // Wrong - missing /v1
```

The frontend will hot-reload automatically. Try your request again.

---

### Issue: "Failed to resolve import @tanstack/react-query-devtools"

**Error Message:**
```
[plugin:vite:import-analysis] Failed to resolve import "@tanstack/react-query-devtools" from "src/main.tsx"
```

**Cause:** Missing npm dependency.

**Solution:**
```bash
cd frontend
npm install
```

The `@tanstack/react-query-devtools` package should now be installed and the frontend should start correctly.

---

### Issue: "Cannot find module '@/components/...'"

**Cause:** TypeScript path aliases not configured or node_modules not installed.

**Solution:**
```bash
cd frontend
npm install
npm run dev
```

---

## Backend Issues

### Issue: "command not found: uvicorn"

**Cause:** Virtual environment not activated or dependencies not installed.

**Solution:**
```bash
cd backend
./setup.sh              # Creates venv and installs dependencies
source venv/bin/activate  # Activate the virtual environment
uvicorn src.main:app --reload
```

Always remember to activate the virtual environment before running backend commands:
```bash
source venv/bin/activate
```

---

### Issue: "pydantic_settings.sources.SettingsError: error parsing value for field CORS_ORIGINS"

**Cause:** Invalid format in `.env` file.

**Solution:**
Update `backend/.env` to use JSON array format:
```env
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
```

Or use comma-separated format:
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

---

### Issue: "ValueError: Unknown constraint decimal_places"

**Cause:** Using Pydantic v2 incompatible syntax.

**Solution:** This has been fixed in the codebase. If you encounter this, make sure you have the latest version of `backend/src/schemas/inventory.py`.

---

### Issue: Database connection errors

**Error Messages:**
- "could not connect to server"
- "connection refused"

**Cause:** PostgreSQL not running.

**Solution:**

If using Docker:
```bash
cd infrastructure
docker-compose up -d postgres redis
docker-compose ps  # Verify services are running
```

If using local PostgreSQL:
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL if needed
sudo systemctl start postgresql
```

Verify connection settings in `backend/.env`:
```env
DATABASE_URL=postgresql+asyncpg://pantrie:pantrie@localhost:5432/pantrie
```

---

### Issue: "relation does not exist" database errors

**Cause:** Database migrations not run.

**Solution:**
```bash
cd backend
source venv/bin/activate
alembic upgrade head
python -m src.db.seed  # Optional: seed initial data
```

---

## General Issues

### Issue: Port already in use

**Error Messages:**
- "Address already in use"
- "Port 8000 is already allocated"

**Solution:**

For backend (port 8000):
```bash
# Find process using port 8000
lsof -i :8000
# or
sudo netstat -tlnp | grep 8000

# Kill the process
kill -9 <PID>
```

For frontend (port 5173):
```bash
# Find process using port 5173
lsof -i :5173

# Kill the process
kill -9 <PID>
```

---

### Issue: npm install fails with permission errors

**Error:** EACCES permission denied

**Solution:**
```bash
# Fix npm permissions (don't use sudo npm install)
sudo chown -R $USER:$USER ~/.npm
sudo chown -R $USER:$USER node_modules

# Then try again
npm install
```

---

### Issue: Python version mismatch

**Error:** "Python 3.11+ is required"

**Solution:**
```bash
# Check Python version
python3 --version

# If too old, install Python 3.11+
# On Ubuntu/Debian:
sudo apt update
sudo apt install python3.11 python3.11-venv

# Create venv with specific Python version
python3.11 -m venv venv
```

---

## Docker Issues

### Issue: docker-compose command not found

**Solution:**
Install Docker Desktop or docker-compose:
```bash
# On Ubuntu/Debian:
sudo apt install docker-compose

# Or install Docker Desktop from https://docs.docker.com/get-docker/
```

---

### Issue: Docker containers not starting

**Solution:**
```bash
# Check logs
cd infrastructure
docker-compose logs postgres
docker-compose logs redis

# Restart services
docker-compose restart

# Or recreate services
docker-compose down
docker-compose up -d
```

---

## Development Tips

### Viewing Backend Logs

Backend uses structured logging. Logs appear in the terminal where you ran `uvicorn`.

### Viewing Frontend Logs

Frontend logs appear in:
1. Terminal where you ran `npm run dev`
2. Browser console (F12)

### Clearing All Data

To start fresh:

```bash
# Stop all services
cd infrastructure
docker-compose down -v  # -v removes volumes (deletes all data)

# Recreate everything
docker-compose up -d
cd ../backend
source venv/bin/activate
alembic upgrade head
python -m src.db.seed
```

---

## Getting Help

If you're still stuck:

1. Check the **README.md** for comprehensive documentation
2. Check the **GETTING_STARTED.md** for setup instructions
3. Review the **FIXED.md** for recently solved issues
4. Check the API documentation at http://localhost:8000/api/docs
5. Look at the error logs carefully - they usually tell you what's wrong

## Quick Health Check

Run this to verify everything is working:

```bash
# Check prerequisites
./check-prerequisites.sh

# Check if services are running
cd infrastructure
docker-compose ps

# Check backend
cd ../backend
source venv/bin/activate
python -c "from src.config import get_settings; print('✅ Config OK')"

# Check frontend
cd ../frontend
npm run type-check
```

If all checks pass, you're good to go! 🎉
