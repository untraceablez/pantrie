#!/bin/bash
# Start the development environment with Docker

set -e

echo "🐳 Starting Pantrie development environment..."
echo ""

# Build and start containers
docker-compose up -d --build

echo ""
echo "⏳ Waiting for services to be healthy..."
echo ""

# Wait for services to be healthy
max_attempts=60
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker-compose ps | grep -q "unhealthy"; then
        echo "   Waiting for services to start... ($attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    else
        break
    fi
done

echo ""
echo "✅ Pantrie is running!"
echo ""
echo "📊 Services:"
echo "   Frontend:  http://localhost:5173"
echo "   Backend:   http://localhost:8000"
echo "   API Docs:  http://localhost:8000/api/docs"
echo "   PostgreSQL: localhost:5432"
echo "   Redis:     localhost:6379"
echo ""
echo "📝 Useful commands:"
echo "   View logs:        docker-compose logs -f"
echo "   View backend logs: docker-compose logs -f backend"
echo "   Stop services:    ./scripts/docker-stop.sh"
echo "   Reset database:   ./scripts/docker-reset.sh"
echo ""
