#!/bin/bash
# Backend setup script for Pantrie

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "🐍 Setting up Python virtual environment..."

echo "📁 Script location: $SCRIPT_DIR"
echo "📁 Project root: $PROJECT_ROOT"
echo "📁 Backend directory: $BACKEND_DIR"

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

# Install dependencies using absolute path
REQUIREMENTS_FILE="$BACKEND_DIR/requirements.txt"
echo "📁 Looking for requirements file at: $REQUIREMENTS_FILE"

if [ -f "$REQUIREMENTS_FILE" ]; then
    echo "📦 Installing dependencies from $REQUIREMENTS_FILE..."
    pip install -r "$REQUIREMENTS_FILE"
else
    echo "❌ Requirements file not found: $REQUIREMENTS_FILE"
    exit 1
fi

echo ""
echo "✅ Backend setup complete!"
echo ""
