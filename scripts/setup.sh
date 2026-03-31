#!/bin/bash
# Backend setup script for Pantrie

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🐍 Setting up Python virtual environment..."

# Change to project root
cd "$PROJECT_ROOT"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip

# Install dependencies (always use absolute path)
REQUIREMENTS_PATH="$PROJECT_ROOT/backend/requirements.txt"

if [ -f "$REQUIREMENTS_PATH" ]; then
    echo "📦 Installing dependencies from $REQUIREMENTS_PATH..."
    pip install -r "$REQUIREMENTS_PATH"
else
    echo "❌ Requirements file not found at $REQUIREMENTS_PATH"
    exit 1
fi

echo ""
echo "✅ Backend setup complete!"
echo ""

# Start frontend in background
echo "⚛️  Starting frontend server..."
cd "$PROJECT_ROOT/frontend"
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!
echo ""
echo "To activate the virtual environment, run:"
echo "  source venv/bin/activate"
echo ""
echo "To run the backend server, run:"
echo "  uvicorn src.main:app --reload"
echo ""