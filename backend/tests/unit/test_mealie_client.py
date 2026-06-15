"""Unit tests for the outbound Mealie HTTP client (US4)."""
import httpx
import pytest

from src.core.exceptions import ExternalServiceError
from src.services.mealie_client_service import MealieClientService, extract_ingredient_names


def test_extract_ingredient_names_prefers_food_then_note() -> None:
    detail = {
        "recipeIngredient": [
            {"food": {"name": "Sugar"}, "note": "ignored"},
            {"food": None, "note": "pinch of salt"},
            {"display": "1 cup water"},
            {"food": None, "note": None},  # dropped
        ]
    }
    assert extract_ingredient_names(detail) == ["Sugar", "pinch of salt", "1 cup water"]


def _recipes_handler(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/api/recipes":
        return httpx.Response(200, json={"items": [{"slug": "pancakes", "name": "Pancakes"}]})
    if request.url.path == "/api/recipes/pancakes":
        return httpx.Response(
            200,
            json={
                "name": "Pancakes",
                "recipeIngredient": [{"food": {"name": "Flour"}}, {"note": "2 eggs"}],
            },
        )
    return httpx.Response(404)


@pytest.mark.asyncio
async def test_fetch_recipes_with_ingredients() -> None:
    client = httpx.AsyncClient(transport=httpx.MockTransport(_recipes_handler), base_url="http://mealie")
    svc = MealieClientService("http://mealie", "key", client=client)
    recipes = await svc.fetch_recipes_with_ingredients()
    await client.aclose()

    assert len(recipes) == 1
    assert recipes[0]["recipe_id"] == "pancakes"
    assert recipes[0]["name"] == "Pancakes"
    assert recipes[0]["ingredients"] == ["Flour", "2 eggs"]


@pytest.mark.asyncio
async def test_unauthorized_raises_actionable_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://mealie")
    svc = MealieClientService("http://mealie", "bad", client=client)
    with pytest.raises(ExternalServiceError) as exc:
        await svc.fetch_recipes_with_ingredients()
    await client.aclose()
    assert "401" in str(exc.value.message)
