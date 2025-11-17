# Site Administrator Feature Implementation - 2025-11-14

## Summary
Implemented comprehensive Site Administrator role with SMTP settings management and user/household administration.

## Backend Changes

### 1. Database Migration
- Created migration `6eff5d1d268f_add_site_role_to_users.py`
- Added `site_role` column to users table (default: 'user', options: 'user' | 'site_administrator')
- Automatically sets first user (id=1) as site_administrator

### 2. User Model Update (`src/models/user.py`)
- Added field: `site_role: Mapped[str] = mapped_column(String(50), default="user", nullable=False)`

### 3. Setup Service (`src/services/setup_service.py`)
- First admin user automatically gets `site_role = "site_administrator"`
- First admin is verified and doesn't need email confirmation

### 4. Core Dependencies (`src/core/deps.py`)
- Created `get_current_user()` dependency that fetches full User model from database
- Returns User object for authenticated requests
- Used by site admin authorization

### 5. Authorization Dependency (`src/core/dependencies.py`)
- Created `get_current_site_admin()` dependency
- Checks if user has `site_role == "site_administrator"`
- Returns 403 if not authorized
- Imports `get_current_user` from `src.core.deps`

### 5. Site Settings API (`src/api/v1/site_settings.py`)
**Endpoints:**
- `GET /api/v1/site-settings/smtp` - Get SMTP settings (excludes password)
- `PUT /api/v1/site-settings/smtp` - Update SMTP settings

**Features:**
- Only accessible to site administrators
- Manages system_settings table
- Optional password update (only updates if provided)

### 6. Site Admin API (`src/api/v1/site_admin.py`)

**User Management Endpoints:**
- `GET /api/v1/site-admin/users` - List all users with household count
- `GET /api/v1/site-admin/users/{id}` - Get user details
- `POST /api/v1/site-admin/users` - Create new user
- `PUT /api/v1/site-admin/users/{id}` - Update user
- `DELETE /api/v1/site-admin/users/{id}` - Delete user

**Household Management Endpoints:**
- `GET /api/v1/site-admin/households` - List all households with member count
- `GET /api/v1/site-admin/households/{id}` - Get household details with members
- `POST /api/v1/site-admin/households` - Create household
- `PUT /api/v1/site-admin/households/{id}` - Update household
- `DELETE /api/v1/site-admin/households/{id}` - Delete household

**Safety Features:**
- Admin cannot delete their own account
- Admin cannot remove their own site_administrator role
- Email/username uniqueness validation
- Cascade deletion prevention

### 7. Router Registration (`src/main.py`)
- Added site_settings router
- Added site_admin router

## Frontend Changes

### 1. User Type Update (`types/auth.ts`)
- Added `site_role: 'user' | 'site_administrator'` to User interface

### 2. Site Settings Service (`services/siteSettings.ts`)
**Methods:**
- `getSMTPSettings()` - Fetch current SMTP configuration
- `updateSMTPSettings()` - Update SMTP configuration

### 3. Site Admin Service (`services/siteAdmin.ts`)
**User Management Methods:**
- `listUsers()` - Get all users
- `getUser(id)` - Get user details
- `createUser(data)` - Create user
- `updateUser(id, data)` - Update user
- `deleteUser(id)` - Delete user

**Household Management Methods:**
- `listHouseholds()` - Get all households
- `getHousehold(id)` - Get household details
- `createHousehold(data)` - Create household
- `updateHousehold(id, data)` - Update household
- `deleteHousehold(id)` - Delete household

## Next Steps (UI Components)
1. Create SiteSettings component with SMTP configuration form
2. Create UserManagement component with user list and CRUD operations
3. Create HouseholdManagement component with household list and CRUD operations
4. Integrate all components into Settings page under "Site Settings" section
5. Show "Site Settings" section only to users with site_role === 'site_administrator'

## Testing Checklist
- [ ] First user created during setup has site_administrator role
- [ ] Site admin can access SMTP settings
- [ ] Site admin can update SMTP settings
- [ ] Site admin can list/create/update/delete users
- [ ] Site admin can list/create/update/delete households
- [ ] Regular users cannot access site admin endpoints (403)
- [ ] Admin cannot delete own account
- [ ] Admin cannot remove own site_administrator role
- [ ] Email/username uniqueness validated
- [ ] Password updates work correctly
- [ ] Household member counts display correctly
- [ ] User household counts display correctly

## Database Schema Changes
```sql
ALTER TABLE users ADD COLUMN site_role VARCHAR(50) NOT NULL DEFAULT 'user';
UPDATE users SET site_role = 'site_administrator' WHERE id = 1;
```

## API Routes Summary
```
Site Settings (Protected - Site Admin Only):
  GET    /api/v1/site-settings/smtp
  PUT    /api/v1/site-settings/smtp

Site Admin - Users (Protected - Site Admin Only):
  GET    /api/v1/site-admin/users
  GET    /api/v1/site-admin/users/{id}
  POST   /api/v1/site-admin/users
  PUT    /api/v1/site-admin/users/{id}
  DELETE /api/v1/site-admin/users/{id}

Site Admin - Households (Protected - Site Admin Only):
  GET    /api/v1/site-admin/households
  GET    /api/v1/site-admin/households/{id}
  POST   /api/v1/site-admin/households
  PUT    /api/v1/site-admin/households/{id}
  DELETE /api/v1/site-admin/households/{id}
```

## Implementation Issues & Fixes

### Issue 1: Missing `get_current_user` Dependency
**Error:** `ImportError: cannot import name 'get_current_user' from 'src.core.security'`

**Root Cause:** The codebase only had `get_current_user_id()` which returns an integer, but the site admin dependency needed the full User model object.

**Fix:**
1. Created `get_current_user()` function in `src/core/deps.py`:
   - Takes `user_id` from `get_current_user_id()` dependency
   - Fetches full User model from database using SQLAlchemy
   - Returns User object or raises AuthenticationError if not found
2. Updated import in `src/core/dependencies.py` from `src.core.security` to `src.core.deps`

### Issue 2: Incorrect Model Import Name
**Error:** `ModuleNotFoundError: No module named 'src.models.household_member'`

**Root Cause:** Imported `HouseholdMember` but the actual model is named `HouseholdMembership` in `household_membership.py`.

**Fix:**
1. Updated import in `src/api/v1/site_admin.py`:
   - Changed: `from src.models.household_member import HouseholdMember`
   - To: `from src.models.household_membership import HouseholdMembership`
2. Replaced all 8 references to `HouseholdMember` with `HouseholdMembership` throughout the file

### Status
**RESOLVED** - Both backend and frontend are now running successfully with no errors.
