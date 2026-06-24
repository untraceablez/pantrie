# Barcode Scanning & Product Search

The **Add Item** form can pull product details from
[Open Food Facts](https://world.openfoodfacts.org) in two ways — by barcode, or
by product name — so you rarely have to type everything by hand.

## Scan or enter a barcode

In the **Scan or Enter Barcode** section:

- **Camera scan** — click **Camera** to scan a barcode with your device camera.
  Supported formats include UPC, EAN, Code 128, Code 39, ITF, and QR.
- **USB / Bluetooth scanner** — most hardware scanners "type" the barcode into the
  field automatically; press <kbd>Enter</kbd> (or **Lookup**) to fetch details.
- **Manual entry** — type or paste a barcode and click **Lookup**.

When a product is found, the form is filled in automatically (name, brand, image,
ingredients, nutrition grade, serving size, allergens) and a green confirmation
shows which data was available.

!!! tip "Scanning works best on mobile"
    Pantrie is mobile-responsive — add it to your home screen and scan barcodes
    with your phone camera while you unpack groceries.

## Search by product name

No barcode handy? Use the **Search by Product Name** section:

1. Type a product name (e.g. *organic peanut butter*) and click **Search** (or
   press <kbd>Enter</kbd>).
2. Pantrie shows up to **three** Open Food Facts suggestions, each with its image,
   name, and brand.
3. Click a suggestion to fill the form — Pantrie looks the product up by its
   barcode behind the scenes, so the fields populate exactly as a scan would.
4. If none of the suggestions fit, follow **See more results on Open Food Facts →**
   to browse the full result list on the web.

## When a product isn't found

Not every product is in Open Food Facts. If a lookup or search comes up empty,
just fill in the details manually — only the name and quantity are required.

!!! note "Data accuracy"
    Open Food Facts is community-maintained, so details (especially nutrition and
    allergens) can be incomplete or occasionally wrong. Review what's imported,
    and check ingredient lists yourself where it matters.
