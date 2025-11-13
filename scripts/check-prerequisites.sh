#!/bin/bash
# Check if all prerequisites are installed

echo "🔍 Checking prerequisites..."
echo ""

ALL_OK=true

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    echo "✅ Python: $PYTHON_VERSION"
else
    echo "❌ Python 3.11+ is required but not found"
    ALL_OK=false
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js: $NODE_VERSION"
else
    echo "❌ Node.js 20+ is required but not found"
    ALL_OK=false
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm: $NPM_VERSION"
else
    echo "❌ npm is required but not found"
    ALL_OK=false
fi

# Check Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
    echo "✅ Docker: $DOCKER_VERSION"
else
    echo "⚠️  Docker is recommended but not found (you can use local PostgreSQL/Redis instead)"
fi

# Check docker-compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f4 | tr -d ',')
    echo "✅ docker-compose: $COMPOSE_VERSION"
else
    echo "⚠️  docker-compose is recommended but not found (you can use local PostgreSQL/Redis instead)"
fi

# Check PostgreSQL (if docker not available)
if ! command -v docker &> /dev/null; then
    if command -v psql &> /dev/null; then
        PSQL_VERSION=$(psql --version | cut -d' ' -f3)
        echo "✅ PostgreSQL: $PSQL_VERSION"
    else
        echo "❌ PostgreSQL 16+ is required (or Docker to run it in a container)"
        ALL_OK=false
    fi
fi

# Check Redis (if docker not available)
if ! command -v docker &> /dev/null; then
    if command -v redis-cli &> /dev/null; then
        REDIS_VERSION=$(redis-cli --version | cut -d' ' -f2)
        echo "✅ Redis: $REDIS_VERSION"
    else
        echo "❌ Redis 7+ is required (or Docker to run it in a container)"
        ALL_OK=false
    fi
fi

echo ""
if [ "$ALL_OK" = true ]; then
    echo "✅ All prerequisites are installed!"
    echo ""
    echo "Next steps:"
    echo "  1. Run ./quick-start.sh to set up the project"
    echo "  2. Run ./dev.sh to start development servers"
else
    echo "❌ Some prerequisites are missing. Please install them and try again."
    exit 1
fi
