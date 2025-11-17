# Installation

This guide will walk you through installing and setting up Pantrie on your local machine.

## Prerequisites

Before installing Pantrie, ensure you have the following installed:

- **Python 3.11+**
- **Node.js 18+** and npm
- **PostgreSQL 14+**
- **Redis** (optional, for caching)
- **Git**

## Quick Start

The fastest way to get started is using the provided setup scripts:

```bash
# Clone the repository
git clone https://github.com/untraceablez/pantrie-spec.git
cd pantrie-spec

# Run the quick start script
./scripts/quick-start.sh
```

This will:
1. Check all prerequisites
2. Set up the backend (virtual environment, dependencies, database)
3. Set up the frontend (dependencies)
4. Start both development servers

## Manual Installation

If you prefer to install manually or the quick start script encounters issues:

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Ensure DATABASE_URL points to your PostgreSQL instance

# Run database migrations
alembic upgrade head

# Start the backend server
uvicorn src.main:app --reload --port 8000
```

### 2. Frontend Setup

In a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start the development server
npm run dev
```

### 3. Database Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE pantrie;
CREATE USER pantrie WITH PASSWORD 'pantrie';
GRANT ALL PRIVILEGES ON DATABASE pantrie TO pantrie;
```

## Verification

After installation, verify everything is working:

1. Backend should be running at `http://localhost:8000`
2. Frontend should be running at `http://localhost:5173`
3. API docs available at `http://localhost:8000/api/docs`

You can also run the verification script:

```bash
./scripts/verify-setup.sh
```

## Troubleshooting

### Port Already in Use

If you see errors about ports being in use:

```bash
# Check what's using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>
```

### Database Connection Issues

Ensure PostgreSQL is running:

```bash
# On macOS with Homebrew
brew services start postgresql

# On Ubuntu/Debian
sudo systemctl start postgresql

# On Windows
# Use the PostgreSQL service in Services app
```

### Python Virtual Environment Issues

If you have trouble with the virtual environment:

```bash
# Remove and recreate
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Next Steps

- [Quick Start Guide](quick-start.md)
- [Configuration](configuration.md)
- [User Guide](../user-guide/overview.md)
