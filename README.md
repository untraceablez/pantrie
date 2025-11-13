# Pantrie - Household Inventory Management
<img src="frontend/public/pantrie-logo-light.png#gh-dark-mode-only" width="200" alt="Pantrie Logo Light">

<img src="frontend/public/pantrie-logo-dark.png#gh-light-mode-only" width="200" alt="Pantrie Logo Dark">
A modern web application for managing household inventory with multi-user support, role-based access control, and real-time updates.

## Features

- 🔐 User authentication with JWT tokens
- 👥 Multi-user household management
- 🔒 Role-based access control (Admin, Editor, Viewer)
- 📦 Complete inventory item tracking
- 🎨 Responsive UI with Tailwind CSS
- 🚀 FastAPI backend with async support
- ⚛️ React frontend with TypeScript

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - Async ORM
- **PostgreSQL** - Database
- **Redis** - Caching and real-time updates
- **Alembic** - Database migrations
- **Structlog** - Structured logging

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TanStack Query** - Data fetching
- **Zustand** - State management
- **Tailwind CSS** - Styling
- **Axios** - HTTP client

## Prerequisites

- **Python 3.11+**
- **Node.js 20+**
- **PostgreSQL 16+**
- **Redis 7+**

## Quick Start

### 1. Backend Setup

```bash
cd backend

# Run the setup script (creates venv and installs dependencies)
./setup.sh

# Or manually:
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Database Setup

Make sure PostgreSQL is running and create a database:

```bash
# Using docker-compose (recommended)
cd infrastructure
docker-compose up -d postgres redis

# Or manually create database
psql -U postgres
CREATE DATABASE pantrie;
CREATE USER pantrie WITH PASSWORD 'pantrie';
GRANT ALL PRIVILEGES ON DATABASE pantrie TO pantrie;
```

### 3. Environment Configuration

Create a `.env` file in the `backend` directory:

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL=postgresql+asyncpg://pantrie:pantrie@localhost:5432/pantrie

# Redis
REDIS_URL=redis://localhost:6379/0

# Security (change in production!)
SECRET_KEY=your-secret-key-here-change-in-production

# Environment
ENVIRONMENT=development
DEBUG=true
```

### 4. Run Database Migrations

```bash
cd backend
source venv/bin/activate

# Run migrations
alembic upgrade head

# Seed initial data (categories and locations)
python -m src.db.seed
```

### 5. Start Backend Server

```bash
cd backend
source venv/bin/activate
uvicorn src.main:app --reload
```

Backend will be available at: http://localhost:8000
- API docs: http://localhost:8000/api/docs
- Health check: http://localhost:8000/api/health

### 6. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend will be available at: http://localhost:5173

## Development

### Backend Commands

```bash
# Activate virtual environment
cd backend
source venv/bin/activate

# Run server with auto-reload
uvicorn src.main:app --reload

# Run tests
pytest

# Run tests with coverage
pytest --cov=src --cov-report=html

# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1

# Format code
black src tests
isort src tests

# Type checking
mypy src

# Linting
flake8 src tests
```

### Frontend Commands

```bash
cd frontend

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format
```

## Project Structure

```
pantrie-spec/
├── backend/
│   ├── alembic/              # Database migrations
│   ├── src/
│   │   ├── api/              # API endpoints
│   │   │   └── v1/           # API v1 routes
│   │   ├── core/             # Core utilities (logging, security, cache)
│   │   ├── db/               # Database (base, session, seed)
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # Business logic
│   │   ├── config.py         # Configuration
│   │   └── main.py           # FastAPI app
│   ├── tests/                # Backend tests
│   ├── requirements.txt      # Python dependencies
│   ├── requirements-dev.txt  # Dev dependencies
│   ├── pyproject.toml        # Python project config
│   └── setup.sh              # Setup script
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   ├── services/         # API services
│   │   ├── store/            # Zustand stores
│   │   ├── types/            # TypeScript types
│   │   ├── App.tsx           # Main app component
│   │   └── main.tsx          # Entry point
│   ├── tests/                # Frontend tests
│   ├── package.json          # Node dependencies
│   ├── vite.config.ts        # Vite config
│   └── tailwind.config.js    # Tailwind config
└── infrastructure/
    └── docker-compose.yml    # Local dev services

```

## Using the Application

### 1. Register a New Account

Navigate to http://localhost:5173/register and create an account:
- Email address
- Username (min 3 characters)
- Password (min 8 characters with uppercase, lowercase, and numbers)

### 2. Login

After registration, login at http://localhost:5173/login

### 3. Create a Household

Currently automatic - when you register, you'll need to create a household via API or add UI in Phase 4.

### 4. Add Inventory Items

Navigate to "Add New Item" and fill in the form:
- **Required**: Item name, quantity
- **Optional**: Description, unit, brand, dates, barcode, notes

## API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc

### Main Endpoints

**Authentication:**
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/me` - Get current user

**Households:**
- `POST /api/v1/households` - Create household
- `GET /api/v1/households` - List user's households
- `GET /api/v1/households/{id}` - Get household
- `PUT /api/v1/households/{id}` - Update household (admin only)
- `DELETE /api/v1/households/{id}` - Delete household (admin only)

**Inventory:**
- `POST /api/v1/inventory` - Create item (editor+)
- `GET /api/v1/inventory/households/{id}` - List household items
- `GET /api/v1/inventory/{id}` - Get item
- `PUT /api/v1/inventory/{id}` - Update item (editor+)
- `DELETE /api/v1/inventory/{id}` - Delete item (editor+)

## Testing

### Backend Tests

```bash
cd backend
source venv/bin/activate

# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/test_auth_service.py

# Run with verbose output
pytest -v
```

### Frontend Tests

```bash
cd frontend

# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e
```

## Troubleshooting

### Backend Issues

**Issue**: `command not found: uvicorn`
- **Solution**: Make sure you activated the virtual environment:
  ```bash
  cd backend
  source venv/bin/activate
  ```

**Issue**: `ModuleNotFoundError: No module named 'src'`
- **Solution**: Make sure you're in the backend directory and PYTHONPATH is set correctly

**Issue**: Database connection errors
- **Solution**: Check PostgreSQL is running and credentials in `.env` are correct

### Frontend Issues

**Issue**: `Cannot find module '@/...'`
- **Solution**: Make sure path aliases are configured in `tsconfig.json` and `vite.config.ts`

**Issue**: CORS errors
- **Solution**: Check that backend CORS settings in `config.py` include your frontend URL

## What's Implemented (Phase 3)

✅ User registration and authentication
✅ JWT token-based authorization
✅ Multi-user household support
✅ Role-based access control (Admin, Editor, Viewer)
✅ Complete inventory item CRUD operations
✅ Form validation (client and server-side)
✅ Error handling with custom exceptions
✅ Structured logging
✅ Responsive UI with Tailwind CSS

## Coming Next (Phase 4)

- Inventory list view with pagination
- Search and filter functionality
- Dashboard with statistics
- Category and location management UI

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please read CONTRIBUTING.md for details.
