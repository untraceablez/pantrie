#!/bin/bash
# Backend setup script for Pantrie

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🐍 Setting up Python virtual environment..."

# Change to script directory to ensure consistent paths
cd "$SCRIPT_DIR"

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

# Install dependencies (path relative to script directory)
REQUIREMENTS_PATH="$SCRIPT_DIR/../backend/requirements.txt"

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
echo "To activate the virtual environment, run:"
echo "  source venv/bin/activate"
echo ""
echo "To run the backend server, run:"
echo "  uvicorn src.main:app --reload"
echo ""