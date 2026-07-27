"""Tests for BarcodeService (Open Food Facts lookup + parsing/formatting).

lookup_barcode uses ``async with httpx.AsyncClient()`` with no injection
point, so we monkeypatch the module's ``httpx.AsyncClient`` to a
MockTransport-backed client. Parsing/formatting helpers are pure and tested
directly.
"""
import httpx
import pytest

import src.services.barcode_service as barcode_mod
from src.services.barcode_service import BarcodeService


def _patch_client(monkeypatch, handler) -> None:
    real_async_client = httpx.AsyncClient

    def fake_async_client(*args, **kwargs):
        return real_async_client(transport=httpx.MockTransport(handler))

    monkeypatch.setattr(barcode_mod.httpx, "AsyncClient", fake_async_client)


# --------------------------------------------------------------------------- #
# lookup_barcode
# --------------------------------------------------------------------------- #
async def test_lookup_barcode_found_returns_parsed_product(monkeypatch):
    payload = {
        "status": 1,
        "product": {
            "product_name": "Almond Milk",
            "brands": "BrandX",
            "code": "12345",
            "nutriments": {"energy-kcal_100g": 30, "proteins_100g": 1},
            "allergens_tags": ["en:nuts"],
        },
    }
    _patch_client(monkeypatch, lambda r: httpx.Response(200, json=payload))
    result = await BarcodeService().lookup_barcode("12345")
    assert result["name"] == "Almond Milk"
    assert result["brand"] == "BrandX"
    assert result["allergens"] == "Nuts"
    assert result["nutrition_facts"]["calories"] == 30
    assert result["source_url"].endswith("/product/12345")


async def test_lookup_barcode_status_zero_returns_none(monkeypatch):
    _patch_client(monkeypatch, lambda r: httpx.Response(200, json={"status": 0}))
    assert await BarcodeService().lookup_barcode("00000") is None


async def test_lookup_barcode_non_200_returns_none(monkeypatch):
    _patch_client(monkeypatch, lambda r: httpx.Response(503))
    assert await BarcodeService().lookup_barcode("12345") is None


async def test_lookup_barcode_timeout_returns_none(monkeypatch):
    def handler(request):
        raise httpx.TimeoutException("slow")

    _patch_client(monkeypatch, handler)
    assert await BarcodeService().lookup_barcode("12345") is None


async def test_lookup_barcode_generic_error_returns_none(monkeypatch):
    # 200 with a non-JSON body -> response.json() raises -> generic except branch
    _patch_client(monkeypatch, lambda r: httpx.Response(200, content=b"not json"))
    assert await BarcodeService().lookup_barcode("12345") is None


# --------------------------------------------------------------------------- #
# _format_allergens
# --------------------------------------------------------------------------- #
def test_format_allergens_none_returns_none():
    assert BarcodeService()._format_allergens(None) is None


def test_format_allergens_strips_prefix_and_titlecases():
    out = BarcodeService()._format_allergens(["en:milk", "en:soy-beans"])
    assert out == "Milk, Soy Beans"


# --------------------------------------------------------------------------- #
# _format_ingredients
# --------------------------------------------------------------------------- #
def test_format_ingredients_none_returns_none():
    assert BarcodeService()._format_ingredients(None) is None


def test_format_ingredients_normalizes_caps_and_keeps_small_words_lower():
    out = BarcodeService()._format_ingredients("WATER AND SUGAR. SALT OF THE EARTH")
    assert out == "Water and Sugar. Salt of the Earth"


# --------------------------------------------------------------------------- #
# _parse_product_data
# --------------------------------------------------------------------------- #
def test_parse_product_data_without_nutriments_has_no_nutrition_facts():
    parsed = BarcodeService()._parse_product_data({"product_name": "Plain"})
    assert parsed["name"] == "Plain"
    assert parsed["nutrition_facts"] is None


def test_parse_product_data_name_falls_back_to_unknown():
    parsed = BarcodeService()._parse_product_data({})
    assert parsed["name"] == "Unknown Product"


def test_parse_product_data_prefers_serving_over_100g():
    parsed = BarcodeService()._parse_product_data(
        {"product_name": "X", "nutriments": {"fat_serving": 5, "fat_100g": 9}}
    )
    assert parsed["nutrition_facts"]["total_fat"] == 5


# --------------------------------------------------------------------------- #
# search_products
#
# One search fans out to five hosts, so the handlers below route on the request
# host: Search-a-licious for Open Food Facts, cgi/search.pl for its siblings,
# and the FDC API for USDA.
# --------------------------------------------------------------------------- #
def _routing_handler(*, off=None, cgi=None, usda=None, status_code=200):
    """Build a handler serving each source family its own payload."""

    def handler(request):
        host = request.url.host
        if host == "search.openfoodfacts.org":
            return httpx.Response(status_code, json={"hits": off or []})
        if host == "api.nal.usda.gov":
            return httpx.Response(status_code, json={"foods": usda or []})
        return httpx.Response(status_code, json={"products": cgi or []})

    return handler


def _group(result, source):
    """Pull one source's group out of a search result, or None if absent."""
    return next((g for g in result["groups"] if g["source"] == source), None)


async def test_search_products_groups_hits_by_source(monkeypatch):
    _patch_client(
        monkeypatch,
        _routing_handler(
            off=[
                {
                    "code": "111",
                    "product_name": "Nutella",
                    "brands": ["Ferrero"],
                    "image_url": "http://i/n.png",
                }
            ],
            cgi=[{"code": "222", "product_name": "Nutella Shampoo", "brands": "Acme"}],
            usda=[{"fdcId": 333, "description": "HAZELNUT SPREAD"}],
        ),
    )
    result = await BarcodeService().search_products("nutella", limit=3)

    # Every source that returned something gets its own group, OFF family first.
    assert [g["source"] for g in result["groups"]] == [
        "off",
        "obf",
        "opf",
        "opff",
        "usda",
    ]

    off_group = _group(result, "off")
    assert off_group["label"] == "Open Food Facts"
    assert "search_terms=nutella" in off_group["search_url"]
    assert off_group["results"] == [
        {
            "source": "off",
            "source_label": "Open Food Facts",
            "id": "111",
            "barcode": "111",
            "name": "Nutella",
            # Search-a-licious returns brands as a list; the siblings a string.
            "brand": "Ferrero",
            "image_url": "http://i/n.png",
        }
    ]

    usda_group = _group(result, "usda")
    assert usda_group["label"] == "USDA FoodData Central"
    assert usda_group["results"] == [
        {
            "source": "usda",
            "source_label": "USDA FoodData Central",
            "id": "333",
            # A generic USDA food carries no barcode and no image.
            "barcode": None,
            "name": "Hazelnut Spread",
            "brand": None,
            "image_url": None,
        }
    ]
    assert "query=nutella" in usda_group["search_url"]


async def test_search_products_queries_off_via_search_a_licious(monkeypatch):
    """Regression: the v2 API silently ignores search_terms and returns junk."""
    seen = []

    def handler(request):
        seen.append(request.url)
        return _routing_handler()(request)

    _patch_client(monkeypatch, handler)
    await BarcodeService().search_products("peanut butter")

    off_url = next(u for u in seen if u.host == "search.openfoodfacts.org")
    assert off_url.path == "/search"
    assert off_url.params["q"] == "peanut butter"
    # The broken parameter must not come back.
    assert "search_terms" not in off_url.params
    assert not any(u.path.startswith("/api/v2/search") for u in seen)

    # The siblings have no Search-a-licious index, so they keep using the CGI one.
    obf_url = next(u for u in seen if u.host == "world.openbeautyfacts.org")
    assert obf_url.path == "/cgi/search.pl"
    assert obf_url.params["search_terms"] == "peanut butter"


async def test_search_products_omits_sources_with_no_hits(monkeypatch):
    _patch_client(
        monkeypatch,
        _routing_handler(off=[{"code": "1", "product_name": "Only OFF"}]),
    )
    result = await BarcodeService().search_products("sparse")
    assert [g["source"] for g in result["groups"]] == ["off"]


async def test_search_products_skips_entries_without_code_or_name(monkeypatch):
    _patch_client(
        monkeypatch,
        _routing_handler(
            off=[
                {"product_name": "No code"},  # dropped (no code)
                {"code": "777"},  # dropped (no name)
                {"code": "999", "product_name": "Keeper"},
            ],
            usda=[
                {"description": "No id"},  # dropped (no fdcId)
                {"fdcId": 5},  # dropped (no description)
            ],
        ),
    )
    result = await BarcodeService().search_products("x")
    assert [s["id"] for s in _group(result, "off")["results"]] == ["999"]
    assert _group(result, "usda") is None


async def test_search_products_empty_results(monkeypatch):
    _patch_client(monkeypatch, _routing_handler())
    result = await BarcodeService().search_products("nothing")
    assert result["groups"] == []
    assert result["results"] == []


async def test_search_products_flattens_results_for_legacy_clients(monkeypatch):
    _patch_client(
        monkeypatch,
        _routing_handler(
            off=[{"code": "1", "product_name": "A"}],
            cgi=[{"code": "2", "product_name": "B"}],
        ),
    )
    result = await BarcodeService().search_products("x")
    # Flat view keeps Open Food Facts first, then the remaining sources.
    assert [s["id"] for s in result["results"]] == ["1", "2", "2", "2"]


async def test_search_products_handles_error_response(monkeypatch):
    # _patch_client must be called once per test (it captures httpx.AsyncClient).
    _patch_client(monkeypatch, _routing_handler(status_code=500))
    result = await BarcodeService().search_products("boom")
    # Errors are logged; the caller still gets the "see more" link.
    assert result["groups"] == []
    assert result["search_url"]


async def test_search_products_handles_timeout(monkeypatch):
    def handler(request):
        raise httpx.TimeoutException("slow")

    _patch_client(monkeypatch, handler)
    assert (await BarcodeService().search_products("slow"))["groups"] == []


async def test_search_products_handles_unexpected_error(monkeypatch):
    def handler(request):
        raise httpx.ConnectError("dropped")

    _patch_client(monkeypatch, handler)
    assert (await BarcodeService().search_products("oops"))["groups"] == []


async def test_search_products_survives_one_dead_source(monkeypatch):
    """A single failing source must not sink the whole search."""

    def handler(request):
        if request.url.host == "world.openbeautyfacts.org":
            raise httpx.ConnectError("obf is down")
        return _routing_handler(off=[{"code": "1", "product_name": "Still here"}])(
            request
        )

    _patch_client(monkeypatch, handler)
    result = await BarcodeService().search_products("resilient")
    assert [g["source"] for g in result["groups"]] == ["off"]


async def test_search_products_logs_and_drops_a_crashing_source(monkeypatch):
    """The gather() guard: a non-httpx crash is logged, not raised."""

    async def boom(*args, **kwargs):
        raise RuntimeError("kaboom")

    _patch_client(monkeypatch, _routing_handler())
    monkeypatch.setattr(BarcodeService, "_search_usda", boom)
    assert (await BarcodeService().search_products("x"))["groups"] == []


async def test_search_products_skips_usda_without_an_api_key(monkeypatch):
    _patch_client(
        monkeypatch, _routing_handler(usda=[{"fdcId": 1, "description": "Banana"}])
    )
    service = BarcodeService()
    service.usda_api_key = ""
    assert _group(await service.search_products("banana"), "usda") is None


async def test_search_products_url_encodes_the_query(monkeypatch):
    _patch_client(monkeypatch, _routing_handler())
    result = await BarcodeService().search_products("peanut butter")
    assert "peanut%20butter" in result["search_url"]


# --------------------------------------------------------------------------- #
# lookup_product (source-aware)
# --------------------------------------------------------------------------- #
async def test_lookup_product_routes_to_the_named_off_sibling(monkeypatch):
    seen = []

    def handler(request):
        seen.append(request.url)
        return httpx.Response(
            200,
            json={"status": 1, "product": {"product_name": "Shampoo", "code": "42"}},
        )

    _patch_client(monkeypatch, handler)
    result = await BarcodeService().lookup_product("obf", "42")

    assert seen[0].host == "world.openbeautyfacts.org"
    assert result["source"] == "Open Beauty Facts"
    assert result["source_url"] == "https://world.openbeautyfacts.org/product/42"


async def test_lookup_product_unknown_source_returns_none():
    assert await BarcodeService().lookup_product("myspace", "42") is None


async def test_lookup_product_usda_parses_food(monkeypatch):
    payload = {
        "fdcId": 999,
        "description": "BANANAS, RAW",
        "brandName": "Chiquita",
        "servingSize": 32.0,
        "servingSizeUnit": "g",
        "ingredients": "BANANAS",
        "foodCategory": {"description": "Fruits"},
        "foodNutrients": [
            {"nutrient": {"name": "Protein"}, "amount": 1.1},
            {"nutrient": {"name": "Energy"}, "amount": 89},
            {"nutrient": {"name": "Unmapped Nutrient"}, "amount": 5},
            {"nutrient": {"name": "Cholesterol"}},  # no amount -> skipped
        ],
    }
    _patch_client(monkeypatch, lambda r: httpx.Response(200, json=payload))
    result = await BarcodeService().lookup_product("usda", "999")

    assert result["name"] == "Bananas, Raw"
    assert result["brand"] == "Chiquita"
    assert result["description"] == "Fruits"
    assert result["categories"] == ["Fruits"]
    assert result["serving_size"] == "32.0g"
    assert result["ingredients"] == "Bananas"
    assert result["image_url"] is None
    assert result["source"] == "USDA FoodData Central"
    assert result["source_url"].startswith("https://fdc.nal.usda.gov/food-details/999")
    assert result["nutrition_facts"]["protein"] == 1.1
    assert result["nutrition_facts"]["calories"] == 89
    assert "cholesterol" not in result["nutrition_facts"]


async def test_lookup_product_usda_non_200_returns_none(monkeypatch):
    _patch_client(monkeypatch, lambda r: httpx.Response(429))
    assert await BarcodeService().lookup_product("usda", "999") is None


async def test_lookup_product_usda_timeout_returns_none(monkeypatch):
    def handler(request):
        raise httpx.TimeoutException("slow")

    _patch_client(monkeypatch, handler)
    assert await BarcodeService().lookup_product("usda", "999") is None


async def test_lookup_product_usda_generic_error_returns_none(monkeypatch):
    _patch_client(monkeypatch, lambda r: httpx.Response(200, content=b"not json"))
    assert await BarcodeService().lookup_product("usda", "999") is None


async def test_lookup_product_usda_without_api_key_returns_none():
    service = BarcodeService()
    service.usda_api_key = ""
    assert await service.lookup_product("usda", "999") is None


# --------------------------------------------------------------------------- #
# _parse_usda_product edge cases
# --------------------------------------------------------------------------- #
def test_parse_usda_product_falls_back_to_unknown_name():
    parsed = BarcodeService()._parse_usda_product({})
    assert parsed["name"] == "Unknown Product"
    assert parsed["nutrition_facts"] is None
    assert parsed["serving_size"] is None
    assert parsed["categories"] == []


def test_parse_usda_product_accepts_a_plain_string_category():
    # Foundation foods give a string here where Branded foods give a dict.
    parsed = BarcodeService()._parse_usda_product(
        {"description": "Kale", "foodCategory": "Vegetables", "brandOwner": "Farm Co"}
    )
    assert parsed["categories"] == ["Vegetables"]
    assert parsed["brand"] == "Farm Co"
