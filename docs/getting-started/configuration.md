# Configuration

Learn how to configure Pantrie for your environment.

## Backend Configuration

The backend is configured using environment variables in the `.env` file located in the `backend/` directory.

### Required Settings

```bash
# Database
DATABASE_URL=postgresql+asyncpg://pantrie:pantrie@localhost:5432/pantrie

# Security
SECRET_KEY=your-secret-key-here  # Generate with: openssl rand -hex 32

# Application
APP_NAME=Pantrie
ENVIRONMENT=development  # development, staging, or production
```

### Optional Settings

#### CORS Origins

Configure which frontend URLs can access the API:

```bash
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173","http://localhost:5175"]
```

#### Redis Cache

Enable caching for improved performance:

```bash
REDIS_URL=redis://localhost:6379/0
REDIS_CACHE_TTL=3600  # 1 hour in seconds
```

#### JWT Tokens

Customize authentication token expiration:

```bash
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

#### External APIs

##### Open Food Facts

No API key required, but you can customize the URL:

```bash
OPEN_FOOD_FACTS_API_URL=https://world.openfoodfacts.org/api/v2
```

##### OAuth Providers (Optional)

```bash
# Google OAuth
OAUTH_GOOGLE_CLIENT_ID=your-client-id
OAUTH_GOOGLE_CLIENT_SECRET=your-client-secret

# GitHub OAuth
OAUTH_GITHUB_CLIENT_ID=your-client-id
OAUTH_GITHUB_CLIENT_SECRET=your-client-secret
```

##### Object Storage (Optional)

For image uploads using S3-compatible storage:

```bash
S3_ENDPOINT_URL=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_NAME=pantrie-images
S3_REGION=us-east-1
```

##### Email (Optional)

For sending notifications:

```bash
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=noreply@pantrie.app
```

## Frontend Configuration

The frontend is configured using the `.env` file in the `frontend/` directory.

### Available Settings

```bash
# API URL
VITE_API_URL=http://localhost:8000

# App Configuration
VITE_APP_NAME=Pantrie
VITE_APP_VERSION=0.1.0

# Feature Flags
VITE_ENABLE_GOOGLE_OAUTH=false
VITE_ENABLE_GITHUB_OAUTH=false
```

## Production Configuration

### Security Considerations

!!! warning "Production Security"
    Never use the default values in production!

1. **Generate a strong SECRET_KEY**:
   ```bash
   openssl rand -hex 32
   ```

2. **Use strong database credentials**
3. **Enable HTTPS only**
4. **Restrict CORS origins** to your actual domain
5. **Set ENVIRONMENT=production**

### Database

For production, consider:

- Using a managed PostgreSQL service (AWS RDS, Google Cloud SQL)
- Enabling connection pooling
- Setting up regular backups
- Configuring SSL connections

```bash
DATABASE_URL=postgresql+asyncpg://user:pass@db-host:5432/pantrie?ssl=require
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20
```

### Redis

For production caching:

- Use managed Redis service
- Enable persistence
- Set appropriate TTL values

```bash
REDIS_URL=redis://redis-host:6379/0
REDIS_CACHE_TTL=3600
```

### Logging

The application uses structured logging. In production:

- Logs are output in JSON format
- Set appropriate log levels
- Consider log aggregation services (CloudWatch, Datadog)

## Environment-Specific Settings

### Development

```bash
ENVIRONMENT=development
DEBUG=true
DATABASE_ECHO=true  # Log SQL queries
```

### Staging

```bash
ENVIRONMENT=staging
DEBUG=false
DATABASE_ECHO=false
```

### Production

```bash
ENVIRONMENT=production
DEBUG=false
DATABASE_ECHO=false
```

## Configuration Validation

The application validates configuration on startup. Check logs for:

- Missing required variables
- Invalid values
- Connection issues

## Docker Configuration

When using Docker Compose, configuration is managed through:

1. `docker-compose.yml` - Service definitions
2. `.env` files - Environment variables
3. Volume mounts - Persistent data

See [Docker Deployment](../deployment/docker.md) for details.

## Next Steps

- [User Guide](../user-guide/overview.md)
- [Deployment Guide](../deployment/overview.md)
- [Development Setup](../development/architecture.md)
