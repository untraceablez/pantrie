#!/bin/bash
# Open a shell in a container

set -e

if [ -z "$1" ]; then
    echo "Usage: ./scripts/docker-shell.sh <service>"
    echo ""
    echo "Available services:"
    echo "  - backend"
    echo "  - frontend"
    echo "  - postgres"
    echo "  - redis"
    exit 1
fi

echo "🐚 Opening shell in $1 container..."
echo ""

case "$1" in
    backend)
        docker-compose exec backend /bin/bash
        ;;
    frontend)
        docker-compose exec frontend /bin/sh
        ;;
    postgres)
        docker-compose exec postgres psql -U pantrie -d pantrie
        ;;
    redis)
        docker-compose exec redis redis-cli
        ;;
    *)
        echo "Unknown service: $1"
        exit 1
        ;;
esac
