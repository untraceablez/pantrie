"""Service for product search and lookup across open product databases.

Searching fans out across every source in :mod:`src.services.product_sources`
concurrently and returns the hits grouped by source. A single source being
slow, rate-limited or down degrades to an empty group rather than failing the
whole search.
"""
import asyncio
import httpx
from typing import Any

from src.config import get_settings
from src.core.logging import setup_logging
from src.services.product_sources import (
    OFF,
    OFF_FAMILY,
    OFF_FAMILY_BY_KEY,
    OFF_SEARCH_API_URL,
    USDA_API_URL,
    USDA_KEY,
    USDA_LABEL,
    OffFamilySource,
    usda_product_url,
    usda_search_url,
)

logger = setup_logging()
settings = get_settings()

# Open Food Facts asks API consumers to identify themselves; an anonymous or
# generic agent gets throttled aggressively.
USER_AGENT = "Pantrie/0.1 (https://github.com/untraceablez/pantrie)"

REQUEST_TIMEOUT = 10.0

# USDA nutrient names -> the keys used by our nutrition_facts payload.
_USDA_NUTRIENT_MAP = {
    "Energy": "calories",
    "Protein": "protein",
    "Total lipid (fat)": "total_fat",
    "Fatty acids, total saturated": "saturated_fat",
    "Fatty acids, total trans": "trans_fat",
    "Cholesterol": "cholesterol",
    "Sodium, Na": "sodium",
    "Carbohydrate, by difference": "total_carbohydrate",
    "Fiber, total dietary": "dietary_fiber",
    "Total Sugars": "total_sugars",
    "Sugars, added": "added_sugars",
    "Calcium, Ca": "calcium",
    "Iron, Fe": "iron",
    "Potassium, K": "potassium",
    "Vitamin D (D2 + D3)": "vitamin_d",
    "Vitamin A, IU": "vitamin_a",
    "Vitamin C, total ascorbic acid": "vitamin_c",
}


def _joined(value: Any) -> str | None:
    """Normalize a brand field, which is a list in some APIs and a string in others."""
    if isinstance(value, list):
        value = ", ".join(str(v) for v in value if v)
    return str(value) if value else None


def _empty_group(source: str, label: str, search_url: str) -> dict[str, Any]:
    """An as-yet-unfilled result group for one source."""
    return {"source": source, "label": label, "results": [], "search_url": search_url}


def _suggestion(
    source: str,
    label: str,
    identifier: str,
    name: str,
    brand: Any,
    barcode: str | None = None,
    image_url: str | None = None,
) -> dict[str, Any]:
    """One search suggestion, in the shape the Add Item form consumes."""
    return {
        "source": source,
        "source_label": label,
        "id": identifier,
        "barcode": barcode,
        "name": name,
        "brand": _joined(brand),
        "image_url": image_url,
    }


class BarcodeService:
    """Service for searching and looking up products in open databases."""

    def __init__(self):
        """Initialize the barcode service."""
        self.openfoodfacts_url = settings.OPEN_FOOD_FACTS_API_URL
        self.usda_api_key = settings.USDA_FDC_API_KEY

    # ----------------------------------------------------------------- #
    # Search
    # ----------------------------------------------------------------- #
    async def search_products(self, query: str, limit: int = 3) -> dict[str, Any]:
        """Search every configured source by product name, grouped by source.

        Returns ``{"groups": [...], "results": [...], "search_url": ...}`` where
        each group is ``{source, label, results, search_url}``. Sources with no
        hits are omitted from ``groups``. ``results``/``search_url`` are the
        flattened, Open Food Facts-first view kept for backwards compatibility.
        """
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}) as client:
            tasks = [
                self._search_off_family(client, source, query, limit)
                for source in OFF_FAMILY
            ]
            tasks.append(self._search_usda(client, query, limit))
            # return_exceptions so one dead source cannot sink the whole search.
            settled = await asyncio.gather(*tasks, return_exceptions=True)

        groups = []
        for outcome in settled:
            if isinstance(outcome, BaseException):
                logger.error("Product source search failed", error=str(outcome))
                continue
            if outcome["results"]:
                groups.append(outcome)

        return {
            "groups": groups,
            # Legacy flat view: Open Food Facts first, then the rest.
            "results": [hit for group in groups for hit in group["results"]],
            "search_url": OFF.search_url(query),
        }

    async def _search_off_family(
        self,
        client: httpx.AsyncClient,
        source: OffFamilySource,
        query: str,
        limit: int,
    ) -> dict[str, Any]:
        """Search one Open Food Facts-family database."""
        group = _empty_group(source.key, source.label, source.search_url(query))
        try:
            if source.key == OFF.key:
                # Search-a-licious: relevance-ranked, returns "hits".
                response = await client.get(
                    OFF_SEARCH_API_URL,
                    params={
                        "q": query,
                        "page_size": limit,
                        "fields": "code,product_name,brands,image_url",
                    },
                    timeout=REQUEST_TIMEOUT,
                )
                items_key = "hits"
            else:
                # Legacy CGI search: the siblings have no Search-a-licious index.
                response = await client.get(
                    f"https://{source.domain}/cgi/search.pl",
                    params={
                        "search_terms": query,
                        "search_simple": 1,
                        "action": "process",
                        "json": 1,
                        "page_size": limit,
                        "fields": "code,product_name,brands,image_url",
                    },
                    timeout=REQUEST_TIMEOUT,
                )
                items_key = "products"

            if response.status_code != 200:
                logger.warning(
                    "Product search error",
                    source=source.key,
                    query=query,
                    status_code=response.status_code,
                )
                return group

            data = response.json()
            for product in (data.get(items_key) or [])[:limit]:
                code = product.get("code")
                name = product.get("product_name")
                # A suggestion is only useful if it has an id to look up and a
                # name to show.
                if not code or not name:
                    continue
                group["results"].append(
                    _suggestion(
                        source.key,
                        source.label,
                        str(code),
                        name,
                        product.get("brands"),
                        barcode=str(code),
                        image_url=product.get("image_url") or None,
                    )
                )
        except httpx.TimeoutException:
            logger.error("Product search timeout", source=source.key, query=query)
        except Exception as e:
            logger.error(
                "Error searching products",
                source=source.key,
                query=query,
                error=str(e),
            )
        return group

    async def _search_usda(
        self, client: httpx.AsyncClient, query: str, limit: int
    ) -> dict[str, Any]:
        """Search USDA FoodData Central, which covers generic/whole foods."""
        group = _empty_group(USDA_KEY, USDA_LABEL, usda_search_url(query))
        if not self.usda_api_key:
            return group
        try:
            response = await client.get(
                f"{USDA_API_URL}/foods/search",
                params={
                    "query": query,
                    "pageSize": limit,
                    "api_key": self.usda_api_key,
                },
                timeout=REQUEST_TIMEOUT,
            )
            if response.status_code != 200:
                logger.warning(
                    "USDA search error",
                    query=query,
                    status_code=response.status_code,
                )
                return group

            for food in (response.json().get("foods") or [])[:limit]:
                fdc_id = food.get("fdcId")
                name = food.get("description")
                if not fdc_id or not name:
                    continue
                group["results"].append(
                    _suggestion(
                        USDA_KEY,
                        USDA_LABEL,
                        str(fdc_id),
                        name.title(),
                        food.get("brandName") or food.get("brandOwner"),
                        # Generic USDA foods have no barcode; branded ones do.
                        # USDA carries no product imagery, so image_url stays None.
                        barcode=food.get("gtinUpc") or None,
                    )
                )
        except httpx.TimeoutException:
            logger.error("USDA search timeout", query=query)
        except Exception as e:
            logger.error("Error searching USDA", query=query, error=str(e))
        return group

    # ----------------------------------------------------------------- #
    # Lookup
    # ----------------------------------------------------------------- #
    async def lookup_product(
        self, source: str, identifier: str
    ) -> dict[str, Any] | None:
        """Look up full product details from ``source`` by its identifier.

        ``identifier`` is a barcode for the Open Food Facts family and an FDC id
        for USDA. Returns ``None`` when the source has no such product.
        """
        if source == USDA_KEY:
            return await self._lookup_usda(identifier)
        off_source = OFF_FAMILY_BY_KEY.get(source)
        if off_source is None:
            logger.warning("Unknown product source", source=source)
            return None
        return await self._lookup_off_family(off_source, identifier)

    async def lookup_barcode(self, barcode: str) -> dict[str, Any] | None:
        """Look up product information by barcode in Open Food Facts."""
        return await self._lookup_off_family(OFF, barcode)

    async def _lookup_off_family(
        self, source: OffFamilySource, barcode: str
    ) -> dict[str, Any] | None:
        """Look up a barcode in one Open Food Facts-family database."""
        # Honour the configured override for Open Food Facts itself so existing
        # deployments can still point at a mirror.
        base_url = self.openfoodfacts_url if source.key == OFF.key else source.api_url
        try:
            async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}) as client:
                response = await client.get(
                    f"{base_url}/product/{barcode}.json",
                    timeout=REQUEST_TIMEOUT,
                )

                if response.status_code == 200:
                    data = response.json()

                    # Check if product was found
                    if data.get("status") == 1 and "product" in data:
                        return self._parse_product_data(data["product"], source)

                    logger.info(
                        "Product not found",
                        source=source.key,
                        barcode=barcode,
                    )
                    return None

                logger.warning(
                    "Product API error",
                    source=source.key,
                    barcode=barcode,
                    status_code=response.status_code,
                )
                return None

        except httpx.TimeoutException:
            logger.error("Product API timeout", source=source.key, barcode=barcode)
            return None
        except Exception as e:
            logger.error(
                "Error looking up barcode",
                source=source.key,
                barcode=barcode,
                error=str(e),
            )
            return None

    async def _lookup_usda(self, fdc_id: str) -> dict[str, Any] | None:
        """Look up a USDA FoodData Central food by its FDC id."""
        if not self.usda_api_key:
            return None
        try:
            async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}) as client:
                response = await client.get(
                    f"{USDA_API_URL}/food/{fdc_id}",
                    params={"api_key": self.usda_api_key},
                    timeout=REQUEST_TIMEOUT,
                )
                if response.status_code != 200:
                    logger.warning(
                        "USDA lookup error",
                        fdc_id=fdc_id,
                        status_code=response.status_code,
                    )
                    return None
                return self._parse_usda_product(response.json())
        except httpx.TimeoutException:
            logger.error("USDA lookup timeout", fdc_id=fdc_id)
            return None
        except Exception as e:
            logger.error("Error looking up USDA food", fdc_id=fdc_id, error=str(e))
            return None

    # ----------------------------------------------------------------- #
    # Parsing
    # ----------------------------------------------------------------- #
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

    def _parse_usda_product(self, food: dict[str, Any]) -> dict[str, Any]:
        """Parse a USDA FoodData Central food into our product format."""
        nutrition_facts: dict[str, Any] = {}
        for entry in food.get("foodNutrients") or []:
            nutrient = entry.get("nutrient") or {}
            key = _USDA_NUTRIENT_MAP.get(nutrient.get("name"))
            amount = entry.get("amount")
            if key and amount is not None:
                nutrition_facts[key] = amount

        serving_size = None
        if food.get("servingSize"):
            unit = food.get("servingSizeUnit") or ""
            serving_size = f"{food['servingSize']}{unit}".strip()
            nutrition_facts["serving_size"] = serving_size

        category = food.get("foodCategory")
        # Branded foods give a dict here, Foundation foods a plain string.
        if isinstance(category, dict):
            category = category.get("description")

        return {
            "name": (food.get("description") or "Unknown Product").title(),
            "description": category or None,
            "brand": _joined(food.get("brandName") or food.get("brandOwner")),
            "categories": [category] if category else [],
            "image_url": None,
            "quantity": food.get("packageWeight") or None,
            "serving_size": serving_size,
            "ingredients": self._format_ingredients(food.get("ingredients")),
            "allergens": None,
            "nutrition_grade": None,
            "nutrition_facts": nutrition_facts or None,
            "labels": [],
            "stores": None,
            "countries": None,
            "source": USDA_LABEL,
            "source_url": usda_product_url(str(food.get("fdcId") or "")),
        }

    def _parse_product_data(
        self, product: dict[str, Any], source: OffFamilySource = OFF
    ) -> dict[str, Any]:
        """
        Parse Open Food Facts product data into our format.

        Args:
            product: Raw product data from Open Food Facts
            source: Which Open Food Facts-family database the product came from

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
            "brand": _joined(product.get("brands")),
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
            "source": source.label,
            "source_url": source.product_url(str(product.get("code"))),
        }
