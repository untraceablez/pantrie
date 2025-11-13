"""Service for barcode lookup and product information retrieval."""
import httpx
from typing import Any

from src.config import get_settings
from src.core.logging import setup_logging

logger = setup_logging()
settings = get_settings()


class BarcodeService:
    """Service for looking up product information from barcodes."""

    def __init__(self):
        """Initialize the barcode service."""
        self.openfoodfacts_url = settings.OPEN_FOOD_FACTS_API_URL

    async def lookup_barcode(self, barcode: str) -> dict[str, Any] | None:
        """
        Look up product information by barcode using Open Food Facts API.

        Args:
            barcode: The barcode string (UPC, EAN, etc.)

        Returns:
            Dictionary with product information or None if not found
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.openfoodfacts_url}/product/{barcode}.json",
                    timeout=10.0,
                )

                if response.status_code == 200:
                    data = response.json()

                    # Check if product was found
                    if data.get("status") == 1 and "product" in data:
                        product = data["product"]
                        return self._parse_product_data(product)

                    logger.info("Product not found in Open Food Facts", barcode=barcode)
                    return None

                logger.warning(
                    "Open Food Facts API error",
                    barcode=barcode,
                    status_code=response.status_code,
                )
                return None

        except httpx.TimeoutException:
            logger.error("Open Food Facts API timeout", barcode=barcode)
            return None
        except Exception as e:
            logger.error(
                "Error looking up barcode",
                barcode=barcode,
                error=str(e),
            )
            return None

    def _format_allergens(self, allergen_tags: list[str] | None) -> str | None:
        """
        Format allergen tags into a readable string.

        Args:
            allergen_tags: List of allergen tags from Open Food Facts (e.g., ['en:milk', 'en:soybeans'])

        Returns:
            Formatted allergens string (e.g., "Milk, Soybeans")
        """
        if not allergen_tags:
            return None

        # Remove language prefix and capitalize
        allergens = []
        for tag in allergen_tags:
            # Remove 'en:' prefix and capitalize
            allergen = tag.split(':')[-1].replace('-', ' ').title()
            allergens.append(allergen)

        return ', '.join(allergens)

    def _format_ingredients(self, ingredients_text: str | None) -> str | None:
        """
        Format ingredients text to use normal capitalization instead of all caps.

        Args:
            ingredients_text: Raw ingredients text from Open Food Facts

        Returns:
            Formatted ingredients text with normal capitalization
        """
        if not ingredients_text:
            return None

        # Convert to title case but keep certain words lowercase
        lowercase_words = {'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with'}

        # Split into sentences
        sentences = []
        for sentence in ingredients_text.split('. '):
            words = sentence.split()
            formatted_words = []

            for i, word in enumerate(words):
                # First word of sentence or word not in lowercase list
                if i == 0 or word.lower() not in lowercase_words:
                    # Capitalize first letter, rest lowercase
                    formatted_words.append(word.capitalize())
                else:
                    formatted_words.append(word.lower())

            sentences.append(' '.join(formatted_words))

        return '. '.join(sentences)

    def _parse_product_data(self, product: dict[str, Any]) -> dict[str, Any]:
        """
        Parse Open Food Facts product data into our format.

        Args:
            product: Raw product data from Open Food Facts

        Returns:
            Parsed product information
        """
        # Extract nutriments data
        nutriments = product.get("nutriments", {})

        # Format ingredients text
        ingredients = self._format_ingredients(product.get("ingredients_text"))

        # Format allergens
        allergens = self._format_allergens(product.get("allergens_tags") or product.get("allergens_hierarchy"))

        # Parse detailed nutrition facts if available
        # Prioritize per-serving values, fall back to per-100g values
        nutrition_facts = None
        if nutriments:
            nutrition_facts = {
                "serving_size": product.get("serving_size") or None,
                "servings_per_container": product.get("servings_per_container") or None,
                "calories": nutriments.get("energy-kcal_serving") or nutriments.get("energy-kcal_100g") or nutriments.get("energy-kcal") or None,
                "total_fat": nutriments.get("fat_serving") or nutriments.get("fat_100g") or nutriments.get("fat") or None,
                "saturated_fat": nutriments.get("saturated-fat_serving") or nutriments.get("saturated-fat_100g") or nutriments.get("saturated-fat") or None,
                "trans_fat": nutriments.get("trans-fat_serving") or nutriments.get("trans-fat_100g") or nutriments.get("trans-fat") or None,
                "cholesterol": nutriments.get("cholesterol_serving") or nutriments.get("cholesterol_100g") or nutriments.get("cholesterol") or None,
                "sodium": nutriments.get("sodium_serving") or nutriments.get("sodium_100g") or nutriments.get("sodium") or None,
                "total_carbohydrate": nutriments.get("carbohydrates_serving") or nutriments.get("carbohydrates_100g") or nutriments.get("carbohydrates") or None,
                "dietary_fiber": nutriments.get("fiber_serving") or nutriments.get("fiber_100g") or nutriments.get("fiber") or None,
                "total_sugars": nutriments.get("sugars_serving") or nutriments.get("sugars_100g") or nutriments.get("sugars") or None,
                "added_sugars": nutriments.get("added-sugars_serving") or nutriments.get("added-sugars_100g") or nutriments.get("added-sugars") or None,
                "protein": nutriments.get("proteins_serving") or nutriments.get("proteins_100g") or nutriments.get("proteins") or None,
                # Vitamins and minerals
                "vitamin_d": nutriments.get("vitamin-d_serving") or nutriments.get("vitamin-d_100g") or nutriments.get("vitamin-d") or None,
                "calcium": nutriments.get("calcium_serving") or nutriments.get("calcium_100g") or nutriments.get("calcium") or None,
                "iron": nutriments.get("iron_serving") or nutriments.get("iron_100g") or nutriments.get("iron") or None,
                "potassium": nutriments.get("potassium_serving") or nutriments.get("potassium_100g") or nutriments.get("potassium") or None,
                "vitamin_a": nutriments.get("vitamin-a_serving") or nutriments.get("vitamin-a_100g") or nutriments.get("vitamin-a") or None,
                "vitamin_c": nutriments.get("vitamin-c_serving") or nutriments.get("vitamin-c_100g") or nutriments.get("vitamin-c") or None,
            }
            # Remove None values
            nutrition_facts = {k: v for k, v in nutrition_facts.items() if v is not None}

        return {
            "name": product.get("product_name") or product.get("generic_name") or "Unknown Product",
            "description": product.get("generic_name") or product.get("categories") or None,
            "brand": product.get("brands") or None,
            "categories": product.get("categories_tags") or [],
            "image_url": product.get("image_url") or None,
            "quantity": product.get("quantity") or None,
            "serving_size": product.get("serving_size") or None,
            "ingredients": ingredients,
            "allergens": allergens,
            "nutrition_grade": product.get("nutrition_grade_fr") or None,
            "nutrition_facts": nutrition_facts,
            "labels": product.get("labels_tags") or [],
            "stores": product.get("stores") or None,
            "countries": product.get("countries") or None,
            "source": "Open Food Facts",
            "source_url": f"https://world.openfoodfacts.org/product/{product.get('code')}",
        }
