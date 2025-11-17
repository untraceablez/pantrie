#!/bin/bash
# Stop the development environment

set -e

echo "🛑 Stopping Pantrie development environment..."

docker-compose down

echo ""
echo "✅ All services stopped!"
echo ""
echo "Note: Data volumes are preserved. Use ./scripts/docker-reset.sh to clear all data."
echo ""
