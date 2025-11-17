# Quick Start

Get up and running with Pantrie in minutes!

## First Time Setup

1. **Register an Account**
   - Navigate to `http://localhost:5173`
   - Click "Sign Up"
   - Enter your email, username, and password
   - Click "Register"

2. **Create Your First Household**
   - After logging in, click "Create Household"
   - Enter a name (e.g., "My Home")
   - Click "Create"

3. **Set Up Locations**
   - Navigate to Settings → Locations
   - Add common locations:
     - Refrigerator
     - Freezer
     - Pantry
     - Kitchen Cabinet

## Adding Your First Item

### Method 1: Barcode Scanning

1. Click the "+ Add Item" button
2. Click "Scan Barcode"
3. Enter a barcode (e.g., `027271140013` for testing)
4. Review the auto-filled information from Open Food Facts
5. Select a location
6. Add quantity and expiration date (optional)
7. Click "Save"

### Method 2: Manual Entry

1. Click the "+ Add Item" button
2. Click "Manual Entry"
3. Fill in the item details:
   - Name (required)
   - Location (required)
   - Quantity
   - Unit
   - Expiration date
   - Notes
4. Click "Save"

## Managing Items

### View Inventory

- **All Items**: Main inventory page shows all items
- **Filter by Location**: Use the location dropdown
- **Search**: Use the search bar to find specific items
- **Sort**: Click column headers to sort

### Update an Item

1. Click on any item card
2. Click "Edit"
3. Update the fields
4. Click "Save"

### Mark Item as Used/Consumed

1. Click on the item
2. Adjust the quantity
3. Or click "Delete" to remove completely

## Setting Up Custom Allergens

1. Navigate to Settings → Household Settings
2. Scroll to "Custom Allergens" section
3. Click "Add Allergen"
4. Enter allergen name (e.g., "peanuts", "soy", "dairy")
5. Click "Add"

Items with matching ingredients will now show allergen warnings!

## Inviting Household Members

1. Navigate to Settings → Household Settings
2. Find the "Members" section
3. Click "Invite Member"
4. Enter their email address
5. Select their role:
   - **Viewer**: Can view items only
   - **Editor**: Can add/edit items
   - **Admin**: Full access including settings

## Tips for Success

!!! tip "Barcode Scanning"
    Most grocery items have barcodes that work with Open Food Facts. This auto-fills nutrition data and allergen information!

!!! tip "Expiration Dates"
    Items close to expiration appear with colored indicators:

    - 🟢 Green: More than 7 days
    - 🟡 Yellow: 3-7 days
    - 🔴 Red: Less than 3 days or expired

!!! tip "Organization"
    Use locations to mirror your real-world storage. This makes it easy to find items when cooking or shopping.

!!! warning "Data Sync"
    Changes are saved immediately. All household members see updates in real-time.

## Common Workflows

### Grocery Shopping

1. Check inventory before shopping
2. Add items as you unpack groceries
3. Use barcode scanning for speed

### Meal Planning

1. Search for ingredients you have
2. Check expiration dates
3. Plan meals around items expiring soon

### Reducing Food Waste

1. Sort by expiration date
2. Move items close to expiring to the front
3. Plan meals to use them first

## Next Steps

- [Learn about Configuration](configuration.md)
- [Read the User Guide](../user-guide/overview.md)
- [Explore API Documentation](../api/overview.md)
