# Custom Allergens

Learn how to set up and manage custom allergen tracking in Pantrie.

## Overview

Custom allergens allow you to define household-specific dietary restrictions. Pantrie automatically checks item ingredients and displays warnings when allergens are detected.

## Features

- **Custom Allergen Lists**: Define allergens specific to your household
- **Automatic Detection**: Ingredients are checked against your allergen list
- **Visual Warnings**: Clear alerts on items containing allergens
- **Open Food Facts Integration**: Works alongside official allergen data
- **Word Boundary Matching**: Accurate detection using intelligent pattern matching

## Setting Up Custom Allergens

### Adding Allergens

1. Navigate to **Settings** → **Household Settings**
2. Scroll to the **Custom Allergens** section
3. Click **Add Allergen**
4. Enter the allergen name (e.g., "peanuts", "soy", "dairy")
5. Click **Add** or press Enter

!!! tip "Common Allergens"
    Consider adding:

    - Peanuts
    - Tree nuts
    - Soy
    - Dairy
    - Eggs
    - Wheat/Gluten
    - Shellfish
    - Fish
    - Sesame

### Removing Allergens

1. Find the allergen in your list
2. Click the **×** (delete) button
3. Confirm removal

## How Detection Works

### Ingredient Matching

Pantrie uses intelligent matching to detect allergens:

```
Allergen: "peanut"
✅ Matches: "peanuts", "peanut butter", "roasted peanuts"
❌ Doesn't match: "pea" (word boundary protection)
```

### Case-Insensitive

Matching is case-insensitive:

```
Allergen: "dairy"
✅ Matches: "Dairy", "DAIRY", "dairy products"
```

### Word Boundaries

Uses word boundaries to avoid false positives:

```
Allergen: "soy"
✅ Matches: "soy sauce", "soy protein"
❌ Doesn't match: "soybeans" (unless you add "soybean" separately)
```

## Allergen Warnings

### Where Warnings Appear

Warnings are shown in two places:

#### 1. Inventory Card View

Small allergen indicator appears on item cards when allergens are detected.

#### 2. Item Detail Modal

Detailed allergen information shows:

- Custom allergens detected in ingredients
- Open Food Facts allergen data
- Full ingredient list for review

### Warning Display

!!! warning "Allergen Detected: Peanuts"
    This item contains ingredients matching your custom allergens.

### Combined Allergen Data

Pantrie shows both:

- **Custom Allergens**: Your household-specific list
- **Open Food Facts Allergens**: Official allergen data from the product

Example display:

```
⚠️ Allergens Detected

Custom Allergens:
- Peanuts
- Soy

From Open Food Facts:
- Peanuts
- May contain traces of tree nuts
```

## Best Practices

### Be Specific

Add both singular and plural forms if needed:

- "peanut" AND "peanuts"
- "nut" AND "nuts"

### Add Variations

Include common variations:

- "milk" AND "dairy"
- "wheat" AND "gluten"

### Review Ingredients

Always review the full ingredient list for accuracy. Automated detection is helpful but not a substitute for careful review.

!!! danger "Critical Allergies"
    For severe allergies, always manually review ingredient lists. Automated detection is a convenience tool, not a medical device.

### Keep Lists Updated

- Add new allergens as dietary needs change
- Remove allergens no longer relevant
- Review periodically with household members

## Limitations

### Text-Based Matching

- Only detects allergens mentioned in ingredient text
- Cannot detect unlisted allergens
- Depends on ingredient data quality

### Data Quality

- Accuracy depends on Open Food Facts data
- Manual entries may not have ingredient lists
- Some products may have incomplete data

### Not Medical Advice

!!! warning "Medical Disclaimer"
    This feature is for convenience only. Always:

    - Read product labels carefully
    - Consult with medical professionals
    - Verify information before consumption
    - Be aware of cross-contamination risks

## Permission Requirements

### Who Can Manage Allergens

Only household **Admins** can:

- Add custom allergens
- Remove custom allergens
- Modify the allergen list

### Who Can View Warnings

All household members can:

- See allergen warnings
- View which allergens are detected
- Access full ingredient lists

## Troubleshooting

### Allergen Not Detected

1. **Check spelling**: Ensure allergen name matches ingredient text exactly
2. **Add variations**: Try adding both "peanut" and "peanuts"
3. **Review ingredients**: Verify the item has ingredient data
4. **Check word boundaries**: "soy" won't match "soybeans"

### False Positives

If you see incorrect matches:

1. **Remove the allergen** temporarily
2. **Add more specific terms**: "soy sauce" instead of just "soy"
3. **Report data issues** to Open Food Facts if product data is wrong

### Missing Ingredient Data

If items don't have ingredients:

- Manual entries may need ingredients added
- Some barcoded items may have incomplete data
- You can manually edit items to add ingredient information

## Examples

### Example 1: Peanut Allergy

Setup:
```
Custom Allergens:
- peanut
- peanuts
- peanut butter
```

Results:
- ✅ Detects: "Contains peanuts"
- ✅ Detects: "peanut butter"
- ✅ Detects: "Roasted PEANUTS"
- ❌ Misses: "groundnuts" (alternative name)

### Example 2: Dairy Free

Setup:
```
Custom Allergens:
- milk
- dairy
- cream
- butter
- cheese
- whey
- casein
- lactose
```

Results:
- ✅ Comprehensive coverage
- ✅ Catches most dairy ingredients
- ❌ May miss obscure dairy derivatives

## Integration with Open Food Facts

Custom allergens complement Open Food Facts data:

### Open Food Facts Provides

- Official allergen declarations
- May contain" warnings
- Standardized allergen names

### Custom Allergens Add

- Household-specific restrictions
- Additional ingredients to watch
- Flexible matching

### Together They Offer

- Comprehensive allergen detection
- Multiple layers of protection
- Flexibility for unique dietary needs

## Next Steps

- [Learn about Inventory Management](inventory.md)
- [Understand Households](households.md)
- [Read about Barcode Scanning](barcode-scanning.md)
