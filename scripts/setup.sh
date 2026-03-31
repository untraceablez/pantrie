#!/bin/bash
# Backend setup script for Pantrie

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🐍 Setting up Python virtual environment..."

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

# Install dependencies using absolute path to requirements.txt
REQUIREMENTS_FILE="$PROJECT_ROOT/backend/requirements.txt"
if [ -f "$REQUIREMENTS_FILE" ]; then
    echo "📦 Installing dependencies from $REQUIREMENTS_FILE..."
    pip install -r "$REQUIREMENTS_FILE"
else
    echo "❌ Error: Requirements file not found at $REQUIREMENTS_FILE"
    exit 1
fi

echo ""
echo "✅ Backend setup complete!"
echo ""
echo "To activate the virtual environment, run:"
echo "  source venv/bin/activate"
echo ""
echo "To run the backend server, run:"
echo "  uvicorn src.main:app --reload"
echo ""