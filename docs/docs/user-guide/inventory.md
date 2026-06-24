# Inventory Management

Your inventory is the list of items in a household. Editors and admins can add,
edit, and remove items; viewers can browse and search.

## Adding items

Open **Add Item** from the inventory page. You can populate the form three ways:

- **Scan or enter a barcode** — fetches product details from Open Food Facts.
- **Search by product name** — find a product by name and click a suggestion to
  fill the form. See [Barcode Scanning & Product Search](barcode-scanning.md).
- **Manual entry** — type the details yourself.

Only **name** and **quantity** are required. Other fields — brand, description,
unit, location, purchase/expiration dates, image, and notes — are optional. You
can attach an image by uploading a file or pasting an image URL.

!!! tip "Multiple households"
    If you belong to more than one household, pick the target household at the top
    of the form before saving.

## Editing and deleting

From any item card:

- **Edit** (pencil) opens the item for changes — handy for updating quantities as
  you use things up.
- **Delete** (trash) removes the item after a confirmation.

Clicking the body of a card opens a detail view with the full nutrition label,
ingredients, and allergen warnings, where you can also edit or delete.

## Searching, filtering, and sorting

On the inventory page you can:

- **Search** by name with the search bar.
- **Filter by location** using the location tabs (or **All Items**).
- **Sort** by name, expiration date, date added, or quantity — click a sort field
  again to flip between ascending and descending.

Results are paginated when there are many items.

## Expiration indicators

Items are color-coded by how close they are to expiring:

- 🟢 **Green** — fresh (more than 7 days)
- 🟡 **Yellow** — use soon (within 7 days)
- 🟠 **Orange** — urgent (within 3 days)
- 🔴 **Red** — expired or expiring today

Set expiration dates wherever you can — even rough estimates help reduce waste,
and you'll see warnings as items age.

## Allergens and recipes

- Items are checked against your household's [custom allergens](allergens.md) and
  flagged with a warning when ingredients match.
- What you have on hand drives recipe **makeability** — see
  [Recipes & Mealie](recipes.md).
