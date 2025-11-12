# Data Model: Household Inventory Management System

**Date**: 2025-11-12
**Branch**: 001-household-inventory
**Database**: PostgreSQL 16 with SQLAlchemy 2.0 ORM

## Overview

This document defines the complete data model for the Pantrie application, including entities, relationships, fields, constraints, and indexes. All entities support the functional requirements from spec.md and align with the constitution principle of data integrity for food/recipe management.

---

## Entity Relationship Diagram

```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│     User        │───────│  HouseholdMembership │───────│    Household    │
│                 │ 1:N   │                      │  N:1  │                 │
│ - id            │       │ - user_id            │       │ - id            │
│ - email         │       │ - household_id       │       │ - name          │
│ - hashed_pw     │       │ - role               │       │ - created_at    │
│ - display_name  │       │ - joined_at          │       │                 │
│ - created_at    │       └──────────────────────┘       └─────────────────┘
└─────────────────┘                                               │
                                                                  │ 1:N
                                                                  │
                                                        ┌─────────────────────┐
                                                        │   InventoryItem     │
                                                        │                     │
                                                        │ - id                │
                                                        │ - household_id      │
                                                        │ - name              │
                                                        │ - quantity          │
                                                        │ - unit              │
                                                        │ - category_id       │
                                                        │ - location_id       │
                                                        │ - expiration_date   │
                                                        │ - barcode           │
                                                        │ - photo_url         │
                                                        │ - metadata (JSONB)  │
                                                        │ - created_by        │
                                                        │ - created_at        │
                                                        │ - updated_at        │
                                                        │ - deleted_at        │
                                                        └─────────────────────┘
                                                                  │
                                              ┌───────────────────┴──────────────────┐
                                              │                                      │
                                    ┌─────────────────┐                  ┌─────────────────┐
                                    │    Category     │                  │    Location     │
                                    │                 │                  │                 │
                                    │ - id            │                  │ - id            │
                                    │ - name          │                  │ - name          │
                                    │ - icon          │                  │ - household_id  │
                                    │ - description   │                  │ - description   │
                                    └─────────────────┘                  └─────────────────┘

┌─────────────────────────┐       ┌──────────────────────┐
│      APIClient          │───────│     Household        │
│                         │  N:1  │                      │
│ - id                    │       │ (same as above)      │
│ - household_id          │       │                      │
│ - client_id (UUID)      │       └──────────────────────┘
│ - client_secret_hash    │
│ - name                  │
│ - permissions           │
│ - created_at            │
│ - last_used_at          │
└─────────────────────────┘

┌─────────────────────────┐       ┌──────────────────────┐
│   InvitationToken       │───────│     Household        │
│                         │  N:1  │                      │
│ - id                    │       │ (same as above)      │
│ - household_id          │       │                      │
│ - email                 │       └──────────────────────┘
│ - token (UUID)          │
│ - role                  │
│ - created_at            │
│ - expires_at            │
│ - used_at               │
└─────────────────────────┘

┌─────────────────────────┐
│   RefreshToken          │
│                         │
│ - id                    │
│ - user_id               │
│ - token_hash            │
│ - expires_at            │
│ - created_at            │
│ - revoked_at            │
└─────────────────────────┘
```

---

## Entity Definitions

### 1. User

Represents an individual person with access to the system.

**Table**: `users`

| **Field** | **Type** | **Constraints** | **Description** |
|-----------|----------|-----------------|-----------------|
| id | UUID | PRIMARY KEY | Unique user identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User's email address (used for login) |
| hashed_password | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| display_name | VARCHAR(100) | NOT NULL | User's display name |
| avatar_url | VARCHAR(500) | NULLABLE | URL to user's profile picture |
| oauth_provider | VARCHAR(50) | NULLABLE | OAuth provider if using external auth (e.g., "google", "github") |
| oauth_sub | VARCHAR(255) | NULLABLE | OAuth subject identifier from provider |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Account creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last profile update timestamp |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Account active status |

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE index on `email`
- Index on `oauth_provider, oauth_sub` (for OAuth lookups)

**Relationships**:
- ONE-TO-MANY: HouseholdMembership (user can belong to multiple households)
- ONE-TO-MANY: RefreshToken (user can have multiple active sessions)

**Validation Rules**:
- Email must be valid email format
- Display name: 1-100 characters
- Password: Minimum 8 characters, hashed with bcrypt (cost factor 12)

---

### 2. Household

Represents a shared inventory space for a group of users.

**Table**: `households`

| **Field** | **Type** | **Constraints** | **Description** |
|-----------|----------|-----------------|-----------------|
| id | UUID | PRIMARY KEY | Unique household identifier |
| name | VARCHAR(100) | NOT NULL | Household name (e.g., "Smith Family") |
| description | TEXT | NULLABLE | Optional household description |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Household creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes**:
- PRIMARY KEY on `id`

**Relationships**:
- ONE-TO-MANY: HouseholdMembership (household has multiple members)
- ONE-TO-MANY: InventoryItem (household has multiple inventory items)
- ONE-TO-MANY: Location (household has custom storage locations)
- ONE-TO-MANY: APIClient (household can have multiple API clients)
- ONE-TO-MANY: InvitationToken (household can have pending invitations)

**Validation Rules**:
- Name: 1-100 characters, required

---

### 3. HouseholdMembership

Junction table representing user membership in households with role-based access control.

**Table**: `household_memberships`

| **Field** | **Type** | **Constraints** | **Description** |
|-----------|----------|-----------------|-----------------|
| id | UUID | PRIMARY KEY | Unique membership identifier |
| user_id | UUID | FOREIGN KEY (users.id), NOT NULL | Reference to user |
| household_id | UUID | FOREIGN KEY (households.id), NOT NULL | Reference to household |
| role | VARCHAR(20) | NOT NULL, CHECK IN ('admin', 'editor', 'viewer') | User's role in household |
| joined_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | When user joined household |

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE composite index on `(user_id, household_id)` (user can only be in household once)
- Index on `household_id` (for listing household members)
- Index on `user_id` (for listing user's households)

**Relationships**:
- MANY-TO-ONE: User
- MANY-TO-ONE: Household

**Role Permissions** (enforced in application layer):
- **admin**: Full control - manage members, inventory, settings, delete household
- **editor**: Read/write inventory items, cannot manage members or settings
- **viewer**: Read-only access to inventory, cannot modify

**Validation Rules**:
- Each user can only have one membership per household
- At least one admin required per household (enforced at business logic layer)

---

### 4. InventoryItem

Represents a food or household item in inventory.

**Table**: `inventory_items`

| **Field** | **Type** | **Constraints** | **Description** |
|-----------|----------|-----------------|-----------------|
| id | UUID | PRIMARY KEY | Unique item identifier |
| household_id | UUID | FOREIGN KEY (households.id), NOT NULL | Owning household |
| name | VARCHAR(200) | NOT NULL | Item name (e.g., "Whole Milk") |
| quantity | DECIMAL(10, 2) | NOT NULL, CHECK > 0 | Item quantity |
| unit | VARCHAR(20) | NOT NULL | Unit of measurement (count, oz, lb, g, kg, ml, l) |
| category_id | UUID | FOREIGN KEY (categories.id), NULLABLE | Item category |
| location_id | UUID | FOREIGN KEY (locations.id), NULLABLE | Storage location |
| expiration_date | DATE | NULLABLE | Expiration date (NULL for items without expiration) |
| barcode | VARCHAR(50) | NULLABLE | Product barcode (UPC, EAN, etc.) |
| photo_url | VARCHAR(500) | NULLABLE | URL to item photo (S3/object storage) |
| metadata | JSONB | NULLABLE, DEFAULT '{}' | Flexible metadata (allergens, nutrition, custom tags) |
| notes | TEXT | NULLABLE | User notes about the item |
| created_by | UUID | FOREIGN KEY (users.id), NOT NULL | User who added item |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Item creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update timestamp |
| deleted_at | TIMESTAMP | NULLABLE | Soft delete timestamp (NULL = active) |

**Indexes**:
- PRIMARY KEY on `id`
- Index on `household_id` (for listing household inventory)
- GIN index on `name` with pg_trgm extension (for fuzzy search, FR-003)
- Composite index on `(household_id, category_id)` (for category filtering, FR-004)
- Composite index on `(household_id, location_id)` (for location filtering, FR-004)
- Composite index on `(household_id, expiration_date)` (for expiration sorting, FR-005)
- Index on `barcode` (for barcode lookups, FR-012)
- Index on `deleted_at` (for filtering active items)

**Relationships**:
- MANY-TO-ONE: Household
- MANY-TO-ONE: Category
- MANY-TO-ONE: Location
- MANY-TO-ONE: User (created_by)

**JSONB Metadata Schema** (flexible, not enforced at database level):
```json
{
  "allergens": ["milk", "soy"],
  "dietary_tags": ["vegetarian", "gluten-free"],
  "nutrition": {
    "calories": 150,
    "protein_g": 8,
    "carbs_g": 12,
    "fat_g": 8
  },
  "brand": "Organic Valley",
  "purchase_date": "2025-11-10",
  "purchase_location": "Whole Foods"
}
```

**Validation Rules**:
- Name: 1-200 characters, required
- Quantity: Must be greater than 0
- Unit: Must be one of predefined units (enforced by enum in application)
- Expiration date: Can be NULL (dry goods, canned items)
- Soft delete: Items marked deleted (`deleted_at IS NOT NULL`) retained for 30 days before permanent deletion (cron job)

---

### 5. Category

Predefined classification for inventory items.

**Table**: `categories`

| **Field** | **Type** | **Constraints** | **Description** |
|-----------|----------|-----------------|-----------------|
| id | UUID | PRIMARY KEY | Unique category identifier |
| name | VARCHAR(50) | UNIQUE, NOT NULL | Category name |
| icon | VARCHAR(50) | NULLABLE | Icon identifier (e.g., "🥛" for dairy) |
| description | TEXT | NULLABLE | Category description |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | Display order |

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE index on `name`

**Relationships**:
- ONE-TO-MANY: InventoryItem

**Seed Data** (predefined categories):
- Produce (🥬)
- Dairy (🥛)
- Meat & Seafood (🥩)
- Dry Goods (🌾)
- Frozen (❄️)
- Beverages (🥤)
- Condiments & Sauces (🍯)
- Snacks (🍿)
- Bakery (🍞)
- Other (📦)

**Validation Rules**:
- Name: 1-50 characters, unique

---

### 6. Location

Storage location for inventory items (household-specific with predefined defaults).

**Table**: `locations`

| **Field** | **Type** | **Constraints** | **Description** |
|-----------|----------|-----------------|-----------------|
| id | UUID | PRIMARY KEY | Unique location identifier |
| household_id | UUID | FOREIGN KEY (households.id), NULLABLE | Household (NULL = system default) |
| name | VARCHAR(50) | NOT NULL | Location name |
| description | TEXT | NULLABLE | Location description |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | Display order |

**Indexes**:
- PRIMARY KEY on `id`
- Index on `household_id` (for listing household locations)
- Composite UNIQUE index on `(household_id, name)` (prevent duplicate names per household)

**Relationships**:
- MANY-TO-ONE: Household (nullable for system defaults)
- ONE-TO-MANY: InventoryItem

**Seed Data** (system default locations, household_id = NULL):
- Refrigerator
- Freezer
- Pantry
- Cabinet
- Countertop
- Other

**Validation Rules**:
- Name: 1-50 characters, required
- Households can add custom locations beyond system defaults

---

### 7. APIClient

External application with access to household inventory via API.

**Table**: `api_clients`

| **Field** | **Type** | **Constraints** | **Description** |
|-----------|----------|-----------------|-----------------|
| id | UUID | PRIMARY KEY | Unique API client identifier |
| household_id | UUID | FOREIGN KEY (households.id), NOT NULL | Household this client has access to |
| client_id | UUID | UNIQUE, NOT NULL, DEFAULT uuid_generate_v4() | Public client identifier |
| client_secret_hash | VARCHAR(255) | NOT NULL | Hashed client secret (bcrypt) |
| name | VARCHAR(100) | NOT NULL | Client name (e.g., "Mealie") |
| description | TEXT | NULLABLE | Client description |
| permissions | JSONB | NOT NULL, DEFAULT '{"read": true, "write": false}' | Client permissions |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Client creation timestamp |
| last_used_at | TIMESTAMP | NULLABLE | Last API request timestamp |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Client active status |

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE index on `client_id`
- Index on `household_id` (for listing household clients)

**Relationships**:
- MANY-TO-ONE: Household

**Permissions JSONB Schema**:
```json
{
  "read": true,
  "write": true,
  "delete": false
}
```

**Validation Rules**:
- Name: 1-100 characters, required
- Client secret: Generated as secure random string (32 bytes), hashed with bcrypt
- Permissions: Validated against allowed permission keys

---

### 8. InvitationToken

Temporary token for inviting new household members.

**Table**: `invitation_tokens`

| **Field** | **Type** | **Constraints** | **Description** |
|-----------|----------|-----------------|-----------------|
| id | UUID | PRIMARY KEY | Unique invitation identifier |
| household_id | UUID | FOREIGN KEY (households.id), NOT NULL | Household being invited to |
| email | VARCHAR(255) | NOT NULL | Email address of invitee |
| token | UUID | UNIQUE, NOT NULL, DEFAULT uuid_generate_v4() | Invitation token |
| role | VARCHAR(20) | NOT NULL, CHECK IN ('admin', 'editor', 'viewer') | Role for new member |
| created_by | UUID | FOREIGN KEY (users.id), NOT NULL | User who created invitation |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Invitation creation timestamp |
| expires_at | TIMESTAMP | NOT NULL | Invitation expiration (default: created_at + 7 days) |
| used_at | TIMESTAMP | NULLABLE | When invitation was accepted (NULL = pending) |

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE index on `token`
- Index on `household_id` (for listing household invitations)
- Composite index on `(email, household_id, used_at)` (check for existing pending invitations)

**Relationships**:
- MANY-TO-ONE: Household
- MANY-TO-ONE: User (created_by)

**Validation Rules**:
- Email: Valid email format, required
- Expiration: Default 7 days from creation
- Token: Secure random UUID
- Cannot invite same email to household multiple times (check existing memberships and pending invitations)

---

### 9. RefreshToken

Long-lived tokens for session management and token refresh.

**Table**: `refresh_tokens`

| **Field** | **Type** | **Constraints** | **Description** |
|-----------|----------|-----------------|-----------------|
| id | UUID | PRIMARY KEY | Unique token identifier |
| user_id | UUID | FOREIGN KEY (users.id), NOT NULL | Token owner |
| token_hash | VARCHAR(255) | UNIQUE, NOT NULL | Hashed refresh token (SHA-256) |
| expires_at | TIMESTAMP | NOT NULL | Token expiration (30 days from creation) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Token creation timestamp |
| revoked_at | TIMESTAMP | NULLABLE | Token revocation timestamp (NULL = active) |

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE index on `token_hash`
- Index on `user_id` (for listing user's tokens)
- Index on `expires_at` (for cleanup of expired tokens)

**Relationships**:
- MANY-TO-ONE: User

**Validation Rules**:
- Token: Generated as secure random string (64 bytes), hashed with SHA-256
- Expiration: 30 days from creation
- Revoked tokens cannot be used (checked during refresh)

---

## Database Migrations

**Tool**: Alembic (SQLAlchemy migration tool)

**Migration Strategy**:
1. Initial migration creates all tables with indexes
2. Seed data migration adds default categories and locations
3. Future migrations use versioned files (e.g., `001_add_nutrition_table.py`)

**Best Practices**:
- Always include `up` and `down` migrations
- Test migrations on copy of production data before deploying
- Use transactions for data migrations
- Document breaking changes in migration docstrings

---

## Performance Considerations

### Query Optimization

**High-Frequency Queries**:
1. List inventory for household: `SELECT * FROM inventory_items WHERE household_id = ? AND deleted_at IS NULL ORDER BY name`
   - Covered by index on `(household_id, deleted_at)`
2. Search inventory by name: `SELECT * FROM inventory_items WHERE household_id = ? AND name ILIKE '%?%' AND deleted_at IS NULL`
   - Covered by GIN index with pg_trgm on `name`
3. Filter by category: `SELECT * FROM inventory_items WHERE household_id = ? AND category_id = ? AND deleted_at IS NULL`
   - Covered by composite index on `(household_id, category_id)`
4. Sort by expiration: `SELECT * FROM inventory_items WHERE household_id = ? AND deleted_at IS NULL ORDER BY expiration_date ASC NULLS LAST`
   - Covered by composite index on `(household_id, expiration_date)`

### Caching Strategy (Redis)

**Cached Data**:
- Barcode lookups: Key `barcode:{barcode}`, TTL 24 hours
- User sessions: Key `session:{user_id}`, TTL 30 days
- Household members: Key `household:{id}:members`, TTL 1 hour (invalidated on membership change)
- Inventory counts: Key `household:{id}:item_count`, TTL 5 minutes

**Cache Invalidation**:
- Inventory CRUD operations: Invalidate household inventory caches
- Membership changes: Invalidate household member cache
- User updates: Invalidate user session cache

---

## Data Integrity

### Referential Integrity

- All foreign keys defined with `ON DELETE CASCADE` except:
  - `inventory_items.created_by`: `ON DELETE SET NULL` (preserve item if user deleted)
  - `api_clients.household_id`: `ON DELETE CASCADE` (remove client access if household deleted)

### Soft Deletes

- `inventory_items`: Soft delete with `deleted_at` timestamp
- Cron job runs daily to permanently delete items where `deleted_at < NOW() - INTERVAL '30 days'`

### Audit Trail

All tables include:
- `created_at`: Immutable creation timestamp
- `updated_at`: Automatically updated on modification (trigger or application layer)
- `created_by`: User ID for inventory items (who added it)

---

## Security Considerations

### Password Storage

- User passwords: Bcrypt with cost factor 12
- API client secrets: Bcrypt with cost factor 12
- Refresh tokens: SHA-256 hash (not bcrypt, as refresh tokens are random and high-entropy)

### Data Access Control

- Row-level security: Application-layer enforcement via household_id filtering
- API clients: Only access their assigned household's data
- RBAC: Enforced at API layer based on HouseholdMembership.role

---

## Next Steps

Data model complete. Proceed to:
1. Generate API contracts (contracts/openapi.yaml)
2. Generate quickstart guide (quickstart.md)
