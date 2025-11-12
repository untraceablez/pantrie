# Getting Started with Pantrie

This guide will help you get Pantrie up and running in just a few minutes.

## Quick Start (Recommended)

If you have Docker installed, this is the fastest way:

```bash
# 1. Check prerequisites
./check-prerequisites.sh

# 2. Run the quick start script (sets up everything)
./quick-start.sh

# 3. Start development servers
./dev.sh
```

Then visit:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/api/docs

## Manual Setup

If you prefer to run things manually or don't have Docker:

### 1. Backend Setup

```bash
cd backend

# Create virtual environment and install dependencies
./setup.sh

# Activate virtual environment
source venv/bin/activate

# Copy environment file (already created for you)
# Edit .env if needed to customize settings

# Run database migrations (requires PostgreSQL running)
alembic upgrade head

# Seed initial data
python -m src.db.seed

# Start backend server
uvicorn src.main:app --reload
```

Backend will be available at http://localhost:8000

### 2. Frontend Setup

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend will be available at http://localhost:5173

## Database Setup

### Option 1: Using Docker (Recommended)

```bash
cd infrastructure
docker-compose up -d postgres redis
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379

### Option 2: Local Installation

Install PostgreSQL and Redis locally, then create a database:

```bash
# Create database
psql -U postgres
CREATE DATABASE pantrie;
CREATE USER pantrie WITH PASSWORD 'pantrie';
GRANT ALL PRIVILEGES ON DATABASE pantrie TO pantrie;
\q
```

## First Steps

1. **Register an account**: Navigate to http://localhost:5173/register

2. **Login**: After registering, login at http://localhost:5173/login

3. **Add items**: Click "Add New Item" to start adding inventory items

## Common Issues

### "command not found: uvicorn"

**Solution**: Make sure you activated the virtual environment:
```bash
cd backend
source venv/bin/activate
```

### Database connection errors

**Solution**:
- Check that PostgreSQL is running: `docker-compose ps` (if using Docker)
- Verify credentials in `backend/.env`

### Port already in use

**Solution**:
- Backend (8000): Check if another process is using port 8000
- Frontend (5173): Check if another Vite dev server is running

## Development Workflow

### Running Tests

**Backend:**
```bash
cd backend
source venv/bin/activate
pytest
```

**Frontend:**
```bash
cd frontend
npm run test
```

### Code Formatting

**Backend:**
```bash
cd backend
source venv/bin/activate
black src tests
isort src tests
```

**Frontend:**
```bash
cd frontend
npm run format
```

### Viewing Logs

Backend logs are printed to the console with structured logging.

## What's Next?

After getting the app running:

1. Explore the **API documentation** at http://localhost:8000/api/docs
2. Try creating a household and adding inventory items
3. Check out the **README.md** for more detailed documentation
4. Review the **project structure** in README.md

## Need Help?

- Check the full **README.md** for comprehensive documentation
- Review the API docs at http://localhost:8000/api/docs
- Look at the code - it's well-commented and follows best practices

## Scripts Summary

- `./check-prerequisites.sh` - Check if all required tools are installed
- `./quick-start.sh` - Complete setup (infrastructure + backend + frontend)
- `./dev.sh` - Start both backend and frontend servers
- `backend/setup.sh` - Set up Python virtual environment

Happy coding! 🚀
