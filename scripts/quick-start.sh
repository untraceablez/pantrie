#!/bin/bash
# Quick start script for Pantrie application

set -e

echo "🚀 Pantrie Quick Start"
echo "====================="
echo ""

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "⚠️  docker-compose not found. Please install Docker and docker-compose first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Start infrastructure services
echo "📦 Starting infrastructure services (PostgreSQL, Redis)..."
cd infrastructure
docker-compose up -d postgres redis
echo "⏳ Waiting for services to be ready..."
sleep 5
cd ..

# Setup backend
echo ""
echo "🐍 Setting up backend..."
cd backend

# Check if venv exists
if [ ! -d "venv" ]; then
    ./setup.sh
else
    echo "✅ Virtual environment already exists"
fi

# Activate venv and run migrations
source venv/bin/activate

echo ""
echo "🗄️  Running database migrations..."
alembic upgrade head

echo ""
echo "🌱 Seeding initial data..."
python -m src.db.seed

cd ..

# Setup frontend
echo ""
echo "⚛️  Setting up frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
else
    echo "✅ Node modules already installed"
fi

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the application:"
echo ""
echo "Terminal 1 - Backend:"
echo "  cd backend"
echo "  source venv/bin/activate"
echo "  uvicorn src.main:app --reload"
echo ""
echo "Terminal 2 - Frontend:"
echo "  cd frontend"
echo "  npm run dev"
echo ""
echo "Then visit: http://localhost:5173"
echo ""
echo "API Documentation: http://localhost:8000/api/docs"
echo ""
