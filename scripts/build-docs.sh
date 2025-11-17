#!/bin/bash
# Helper script to build MkDocs documentation for deployment

# Check if virtual environment exists
if [ ! -d "docs-venv" ]; then
    echo "Creating virtual environment for docs..."
    python3 -m venv docs-venv
    docs-venv/bin/pip install -q -r docs-requirements.txt
fi

# Build the documentation
echo "Building documentation..."
docs-venv/bin/mkdocs build

if [ $? -eq 0 ]; then
    echo "Documentation built successfully in ./site directory"
else
    echo "Build failed!"
    exit 1
fi
