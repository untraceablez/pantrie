#!/bin/bash
# Reset the development environment (WARNING: Deletes all data!)

set -e

echo "⚠️  WARNING: This will delete ALL data including:"
echo "   - Database (PostgreSQL)"
echo "   - Cache (Redis)"
echo "   - All Docker volumes"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "🗑️  Stopping and removing all containers and volumes..."

docker-compose down -v

echo ""
echo "✅ Environment reset complete!"
echo ""
echo "Run ./scripts/docker-start.sh to start fresh."
echo ""
