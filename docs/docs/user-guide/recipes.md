# Recipes & Mealie

Pantrie connects to your [Mealie](https://docs.mealie.io) instance to show which
of your recipes you can actually make from what's in your inventory — and to push
the missing ingredients straight to a Mealie shopping list.

## Connecting Mealie

A household admin sets up the connection once:

1. Go to **Settings → Household Settings → Mealie Connection**.
2. Enter your Mealie **base URL** (e.g. `https://mealie.example.com`) and a Mealie
   **API key**.
3. Save. The key is stored encrypted and never shown back to you.

!!! note "This is the Pantrie → Mealie direction"
    The Mealie Connection is how *Pantrie* reads recipes from *Mealie*. It's
    separate from **API Clients** (Settings → Household → API Clients), which let
    an external app read *Pantrie's* inventory. See
    [Mealie Integration](../api/mealie-integration.md) for that direction.

## The Recipes page

Open **Recipes** from the inventory page header. Pantrie pulls your recipes from
Mealie and, for each one, compares its ingredients against your inventory:

- **Can make** — every ingredient is in stock (or covered by a household staple).
- **Missing N** — `N` ingredients aren't in stock; they're listed on the card.

Each card also shows how many ingredients are in stock out of the total
(e.g. *4/6 ingredients in stock*).

If you belong to more than one household, a selector lets you switch which
household's inventory the recipes are checked against.

### Fuzzy ingredient matching

Ingredient names rarely match your inventory exactly, so matching is forgiving:

- Spacing and case differences are ignored — inventory **"Corn Starch"** satisfies
  a recipe calling for **"cornstarch"**.
- Simple plurals collapse — **"Tomatoes"** matches **"tomato"**.
- A more specific item covers a generic one — having **"olive oil"** satisfies
  **"oil"**.

Matching is deliberately conservative, so unrelated near-misses (e.g. *corn* vs
*cornstarch*) are **not** treated as the same thing.

## Household staples

Some ingredients you always have — water, salt, oil — and you don't want them
cluttering every recipe's "missing" list. **Staples** are a per-household list of
assumed-on-hand ingredients that are always counted as in-stock.

- Manage them under **Settings → Household → Pantry Staples**.
- Every household starts with **water** already added; add or remove others freely.
- A staple is matched with the same fuzzy logic as inventory, so it's treated as
  in-stock and never appears in a recipe's missing list or a shopping-list push.

## Pushing missing ingredients to a shopping list

On any recipe with missing ingredients, click **Add missing to Mealie list** to
open the push dialog:

1. **Pick a list** — choose any existing Mealie shopping list, or
2. **Create a new one** — the name is pre-filled as `<Recipe Name> - DD-MM-YY`
   (e.g. `Chana Masala - 23-06-26`) and is editable before you confirm.
3. Click **Add to list**.

Pantrie reports how many items were applied (e.g. *added 4/4*).

### No duplicates — quantities are merged

Before adding, Pantrie checks what's already on the target list. If an ingredient
is already there (matched with the same fuzzy logic), its **quantity is
incremented** instead of creating a duplicate line. So pushing the same recipe
twice, or two recipes that share an ingredient, consolidates cleanly — the result
also notes how many existing items were updated (e.g. *added 4/4 (1 updated)*).

## Troubleshooting

!!! warning "No Mealie connection configured"
    If the Recipes page reports there's no connection, an admin needs to add one
    under **Settings → Household Settings → Mealie Connection**.

!!! tip "Recipe shows missing items you actually have"
    Check the exact inventory item name, or add the ingredient as a household
    **staple** if it's something you always keep on hand.

!!! tip "Wrong shopping list"
    The dialog lets you pick the target list every time, so you can keep separate
    lists (e.g. *Weekly*, *Costco*) and choose per push.
