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

    def _parse_product_data(self, product: dict[str, Any]) -> dict[str, Any]:
        """
        Parse Open Food Facts product data into our format.

        Args:
            product: Raw product data from Open Food Facts

        Returns:
            Parsed product information
        """
        return {
            "name": product.get("product_name") or product.get("generic_name") or "Unknown Product",
            "description": product.get("generic_name") or product.get("categories") or None,
            "brand": product.get("brands") or None,
            "categories": product.get("categories_tags") or [],
            "image_url": product.get("image_url") or None,
            "quantity": product.get("quantity") or None,
            "serving_size": product.get("serving_size") or None,
            "ingredients": product.get("ingredients_text") or None,
            "allergens": product.get("allergens") or None,
            "nutrition_grade": product.get("nutrition_grade_fr") or None,
            "labels": product.get("labels_tags") or [],
            "stores": product.get("stores") or None,
            "countries": product.get("countries") or None,
            "source": "Open Food Facts",
            "source_url": f"https://world.openfoodfacts.org/product/{product.get('code')}",
        }
