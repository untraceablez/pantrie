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
