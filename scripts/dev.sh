#!/bin/bash
# Development server script - runs both backend and frontend

set -e

echo "🚀 Starting Pantrie in development mode..."
echo ""

# Check and start Docker services
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
cd backend
source venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Start frontend in background
echo "⚛️  Starting frontend server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

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
