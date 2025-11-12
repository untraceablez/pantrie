# API Contracts: Household Inventory Management System

**Date**: 2025-11-12
**Branch**: 001-household-inventory
**API Version**: v1
**Base URL**: `https://pantrie.example.com/api/v1`

## Overview

This directory contains the API contract specifications for the Pantrie REST API. The API follows RESTful principles and provides endpoints for:

- Authentication (OAuth2 + JWT)
- Household management
- Inventory CRUD operations
- Barcode lookup
- Image recognition
- User management

## Files

- **openapi.yaml**: Complete OpenAPI 3.0 specification
- **README.md**: This file - API overview and quick reference

## Authentication

All endpoints (except `/auth/register`, `/auth/login`) require authentication via Bearer token in the `Authorization` header.

**Token Type**: JWT (JSON Web Token)

**Header Format**:
```
Authorization: Bearer <access_token>
```

**Token Lifetime**:
- Access Token: 15 minutes
- Refresh Token: 30 days

**OAuth2 Flow**: Authorization Code Flow with PKCE (for external providers)

## Quick Reference

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user account |
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Revoke refresh token |
| GET | `/auth/oauth/{provider}` | Initiate OAuth2 flow (Google, GitHub) |
| GET | `/auth/oauth/{provider}/callback` | OAuth2 callback handler |

### Household Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/households` | List user's households |
| POST | `/households` | Create new household |
| GET | `/households/{id}` | Get household details |
| PUT | `/households/{id}` | Update household |
| DELETE | `/households/{id}` | Delete household (admin only) |
| GET | `/households/{id}/members` | List household members |
| POST | `/households/{id}/invite` | Invite member to household |
| PUT | `/households/{id}/members/{userId}` | Update member role (admin only) |
| DELETE | `/households/{id}/members/{userId}` | Remove member (admin only) |
| GET | `/households/{id}/events` | SSE endpoint for real-time updates |

### Inventory Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/households/{householdId}/inventory` | List inventory items |
| POST | `/households/{householdId}/inventory` | Add new item |
| GET | `/households/{householdId}/inventory/{id}` | Get item details |
| PUT | `/households/{householdId}/inventory/{id}` | Update item |
| DELETE | `/households/{householdId}/inventory/{id}` | Delete item |
| GET | `/households/{householdId}/inventory/search` | Search inventory |

### Barcode Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/barcodes/lookup` | Lookup product by barcode |

### Image Recognition Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/images/recognize` | Recognize products from photo |

### User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Get current user profile |
| PUT | `/users/me` | Update current user profile |

## Common Request/Response Patterns

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  }
}
```

### Pagination (List Endpoints)

**Query Parameters**:
- `page`: Page number (default: 1)
- `per_page`: Items per page (default: 50, max: 100)

**Response**:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total_items": 234,
    "total_pages": 5
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions for action |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |

## Rate Limiting

- **Web Users**: 1000 requests/hour per user
- **API Clients**: 1000 requests/hour per client

**Rate Limit Headers**:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1699564800
```

## Real-Time Updates (SSE)

**Endpoint**: `GET /api/v1/households/{id}/events`

**Event Types**:
- `inventory.created`: New item added
- `inventory.updated`: Item modified
- `inventory.deleted`: Item removed
- `member.joined`: New member joined household
- `member.left`: Member left household

**Event Format**:
```
event: inventory.created
data: {"id": "uuid", "name": "Milk", "household_id": "uuid", ...}
```

## Mealie Integration

Mealie can integrate with Pantrie using the API client authentication flow:

1. Household admin creates API client in Pantrie UI
2. Mealie stores `client_id` and `client_secret`
3. Mealie requests access token: `POST /auth/token` with client credentials
4. Mealie uses access token to:
   - Check ingredient availability: `GET /households/{id}/inventory/search?q=ingredient_name`
   - Update quantities: `PUT /households/{id}/inventory/{id}` (adjust quantity after generating shopping list)

## Example Requests

### Register New User

```bash
curl -X POST https://pantrie.example.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "display_name": "John Doe"
  }'
```

### Add Inventory Item

```bash
curl -X POST https://pantrie.example.com/api/v1/households/{householdId}/inventory \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Whole Milk",
    "quantity": 1,
    "unit": "gallon",
    "category_id": "dairy-uuid",
    "location_id": "fridge-uuid",
    "expiration_date": "2025-11-20",
    "barcode": "0123456789012"
  }'
```

### Search Inventory

```bash
curl -X GET "https://pantrie.example.com/api/v1/households/{householdId}/inventory/search?q=milk&category=dairy" \
  -H "Authorization: Bearer {access_token}"
```

## OpenAPI Specification

See `openapi.yaml` for the complete API specification including:
- Detailed request/response schemas
- Validation rules
- Example payloads
- All endpoint parameters

## Testing

Use the OpenAPI specification with tools like:
- **Postman**: Import openapi.yaml for API testing
- **Swagger UI**: Interactive API documentation
- **Redoc**: Alternative API documentation renderer
- **OpenAPI Generator**: Generate client SDKs in various languages

## Versioning

API follows semantic versioning:
- **Major Version**: Breaking changes (e.g., v1 → v2)
- **Minor Version**: New features, backward compatible
- **Patch Version**: Bug fixes

Current Version: **v1.0.0**

## Support

For API issues or questions:
- GitHub Issues: https://github.com/pantrie/pantrie/issues
- Documentation: https://docs.pantrie.io
