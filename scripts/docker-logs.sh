#!/bin/bash
# View logs for all services or a specific service

set -e

if [ -z "$1" ]; then
    echo "📋 Showing logs for all services..."
    echo "   (Press Ctrl+C to exit)"
    echo ""
    docker-compose logs -f
else
    echo "📋 Showing logs for $1..."
    echo "   (Press Ctrl+C to exit)"
    echo ""
    docker-compose logs -f "$1"
fi
