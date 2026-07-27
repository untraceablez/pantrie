"""Registry of the open product databases Pantrie searches.

Two families live here:

* The **Open Food Facts family** (food, beauty, general products, pet food) --
  four sibling sites that share one data model, one barcode-keyed lookup API
  and one web search UI.
* **USDA FoodData Central**, which complements them with generic/whole foods
  ("bananas, raw") that the barcode-keyed OFF databases do not carry.

Search is deliberately per-source rather than one blended query: each site
indexes a different kind of product, so grouping the results keeps a shampoo
hit from looking like a pantry item.
"""
from dataclasses import dataclass
from urllib.parse import quote


@dataclass(frozen=True)
class OffFamilySource:
    """One of the Open Food Facts sibling databases."""

    key: str
    label: str
    domain: str

    @property
    def api_url(self) -> str:
        """Barcode-keyed product lookup API (v2)."""
        return f"https://{self.domain}/api/v2"

    def search_url(self, query: str) -> str:
        """Human-facing search page, used for the "see more" link."""
        return (
            f"https://{self.domain}/cgi/search.pl?"
            f"search_terms={quote(query)}&search_simple=1&action=process"
        )

    def product_url(self, barcode: str) -> str:
        """Human-facing product page."""
        return f"https://{self.domain}/product/{barcode}"


# Open Food Facts itself is searched through Search-a-licious (see
# OFF_SEARCH_API_URL); its legacy ``cgi/search.pl`` JSON endpoint is frequently
# unavailable under load. The lower-traffic siblings have no Search-a-licious
# index, so they still use ``cgi/search.pl`` -- which works fine for them.
OFF_SEARCH_API_URL = "https://search.openfoodfacts.org/search"

OFF = OffFamilySource("off", "Open Food Facts", "world.openfoodfacts.org")
OBF = OffFamilySource("obf", "Open Beauty Facts", "world.openbeautyfacts.org")
OPF = OffFamilySource("opf", "Open Products Facts", "world.openproductsfacts.org")
OPFF = OffFamilySource("opff", "Open Pet Food Facts", "world.openpetfoodfacts.org")

OFF_FAMILY: tuple[OffFamilySource, ...] = (OFF, OBF, OPF, OPFF)
OFF_FAMILY_BY_KEY: dict[str, OffFamilySource] = {s.key: s for s in OFF_FAMILY}

USDA_KEY = "usda"
USDA_LABEL = "USDA FoodData Central"
USDA_API_URL = "https://api.nal.usda.gov/fdc/v1"


def usda_search_url(query: str) -> str:
    """Human-facing USDA search page, used for the "see more" link."""
    return f"https://fdc.nal.usda.gov/food-search?query={quote(query)}"


def usda_product_url(fdc_id: str) -> str:
    """Human-facing USDA food detail page."""
    return f"https://fdc.nal.usda.gov/food-details/{fdc_id}/nutrients"


#: Every source key the API accepts, in the order results are presented.
SOURCE_KEYS: tuple[str, ...] = tuple(s.key for s in OFF_FAMILY) + (USDA_KEY,)

SOURCE_LABELS: dict[str, str] = {
    **{s.key: s.label for s in OFF_FAMILY},
    USDA_KEY: USDA_LABEL,
}
