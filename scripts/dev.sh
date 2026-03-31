#!/bin/bash
# Development startup script for Pantrie

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting Pantrie development environment..."
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Ensure backend and frontend directories exist
if [ ! -d "backend" ]; then
    echo "❌ Backend directory not found"
    exit 1
fi

if [ ! -d "frontend" ]; then
    echo "❌ Frontend directory not found"
    exit 1
fi

# Start Docker services
echo "🐳 Checking Docker services..."
if ! docker ps --filter name=pantrie-postgres --filter status=running | grep -q pantrie-postgres; then
    echo "   Starting PostgreSQL..."
    docker start pantrie-postgres 2>/dev/null || docker-compose -f docker-compose.dev.yml up -d postgres
fi

if ! docker ps --filter name=pantrie-redis --filter status=running | grep -q pantrie-redis; then
    echo "   Starting Redis..."
    docker start pantrie-redis 2>/dev/null || docker-compose -f docker-compose.dev.yml up -d redis
fi

echo "   ✓ Database and cache ready"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Start backend in background
echo "🐍 Starting backend server..."
cd "$PROJECT_ROOT/backend"
source "$SCRIPT_DIR/venv/bin/activate"
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend in background
echo "⚛️  Starting frontend server..."
cd "$PROJECT_ROOT/frontend"
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

echo ""
echo "✅ Servers started!"
echo ""
echo "Backend:  http://localhost:8000"
echo "API Docs: http://localhost:8000/api/docs"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID