#!/bin/bash
# Helper script to serve MkDocs documentation locally

# Check if virtual environment exists
if [ ! -d "docs-venv" ]; then
    echo "Creating virtual environment for docs..."
    python3 -m venv docs-venv
    docs-venv/bin/pip install -q -r docs-requirements.txt
fi

# Serve the documentation
echo "Serving documentation at http://localhost:8001/pantrie-spec/"
echo "Press Ctrl+C to stop the server"
docs-venv/bin/mkdocs serve
