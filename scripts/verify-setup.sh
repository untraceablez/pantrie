#!/bin/bash
# Verify that the application is set up correctly

echo "🔍 Verifying Pantrie Setup"
echo "=========================="
echo ""

# Check backend venv
echo "1. Checking backend virtual environment..."
if [ -d "backend/venv" ]; then
    echo "   ✅ Virtual environment exists"
else
    echo "   ❌ Virtual environment not found. Run: cd backend && ./setup.sh"
    exit 1
fi

# Check backend dependencies
echo "2. Checking backend dependencies..."
cd backend
source venv/bin/activate
if python -c "import fastapi, sqlalchemy, alembic" 2>/dev/null; then
    echo "   ✅ Core dependencies installed"
else
    echo "   ❌ Dependencies missing. Run: pip install -r requirements.txt"
    exit 1
fi

# Check configuration
echo "3. Checking configuration..."
if [ -f ".env" ]; then
    echo "   ✅ .env file exists"
else
    echo "   ⚠️  .env file not found (using defaults)"
fi

# Test configuration loading
if python -c "from src.config import get_settings; get_settings()" 2>/dev/null; then
    echo "   ✅ Configuration loads successfully"
else
    echo "   ❌ Configuration error"
    exit 1
fi

# Test password hashing
echo "4. Testing password hashing..."
if python -c "from src.core.security import hash_password, verify_password; h = hash_password('test123'); assert verify_password('test123', h)" 2>/dev/null; then
    echo "   ✅ Password hashing works"
else
    echo "   ❌ Password hashing failed"
    exit 1
fi

cd ..

# Check database
echo "5. Checking database connection..."
if docker ps | grep -q pantrie-postgres; then
    echo "   ✅ PostgreSQL container is running"
else
    echo "   ⚠️  PostgreSQL container not running"
    echo "      Start with: cd infrastructure && docker-compose up -d postgres"
fi

# Check Redis
echo "6. Checking Redis connection..."
if docker ps | grep -q pantrie-redis; then
    echo "   ✅ Redis container is running"
else
    echo "   ⚠️  Redis container not running"
    echo "      Start with: cd infrastructure && docker-compose up -d redis"
fi

# Check frontend dependencies
echo "7. Checking frontend dependencies..."
if [ -d "frontend/node_modules" ]; then
    echo "   ✅ Node modules installed"
else
    echo "   ❌ Node modules not installed. Run: cd frontend && npm install"
    exit 1
fi

# Check if ports are available
echo "8. Checking if ports are available..."
if lsof -i :8000 > /dev/null 2>&1; then
    echo "   ⚠️  Port 8000 is in use (backend may already be running)"
else
    echo "   ✅ Port 8000 is available"
fi

if lsof -i :5173 > /dev/null 2>&1; then
    echo "   ⚠️  Port 5173 is in use (frontend may already be running)"
else
    echo "   ✅ Port 5173 is available"
fi

echo ""
echo "✅ Setup verification complete!"
echo ""
echo "To start the application:"
echo "  ./dev.sh"
echo ""
echo "Or manually:"
echo "  Terminal 1: cd backend && source venv/bin/activate && uvicorn src.main:app --reload"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
