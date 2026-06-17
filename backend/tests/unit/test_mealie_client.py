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


def _client_for(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://mealie")


@pytest.mark.asyncio
async def test_get_json_transport_error_raises_unreachable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom")

    client = _client_for(handler)
    svc = MealieClientService("http://mealie", "key", client=client)
    with pytest.raises(ExternalServiceError, match="Could not reach Mealie"):
        await svc.fetch_recipes_with_ingredients()
    await client.aclose()


@pytest.mark.asyncio
async def test_get_json_http_error_status_raises() -> None:
    client = _client_for(lambda request: httpx.Response(500))
    svc = MealieClientService("http://mealie", "key", client=client)
    with pytest.raises(ExternalServiceError, match="500"):
        await svc.fetch_recipes_with_ingredients()
    await client.aclose()


@pytest.mark.asyncio
async def test_get_json_non_json_response_raises() -> None:
    client = _client_for(lambda request: httpx.Response(200, content=b"not json"))
    svc = MealieClientService("http://mealie", "key", client=client)
    with pytest.raises(ExternalServiceError, match="non-JSON"):
        await svc.fetch_recipes_with_ingredients()
    await client.aclose()


@pytest.mark.asyncio
async def test_fetch_recipes_skips_items_without_slug() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/recipes":
            # one item has neither slug nor id -> skipped
            return httpx.Response(200, json={"items": [{"name": "no-id"}]})
        return httpx.Response(404)

    client = _client_for(handler)
    svc = MealieClientService("http://mealie", "key", client=client)
    assert await svc.fetch_recipes_with_ingredients() == []
    await client.aclose()


@pytest.mark.asyncio
async def test_add_to_shopping_list_partial_success() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/households/shopping/lists":
            return httpx.Response(200, json={"items": [{"id": "list-1"}]})
        if request.url.path == "/api/households/shopping/items":
            return httpx.Response(201)
        return httpx.Response(404)

    client = _client_for(handler)
    svc = MealieClientService("http://mealie", "key", client=client)
    results = await svc.add_to_shopping_list(["Milk", "Eggs"])
    await client.aclose()
    assert [r["added"] for r in results] == [True, True]


@pytest.mark.asyncio
async def test_add_to_shopping_list_no_list_raises() -> None:
    client = _client_for(lambda request: httpx.Response(200, json={"items": []}))
    svc = MealieClientService("http://mealie", "key", client=client)
    with pytest.raises(ExternalServiceError, match="No Mealie shopping list"):
        await svc.add_to_shopping_list(["Milk"])
    await client.aclose()


@pytest.mark.asyncio
async def test_add_to_shopping_list_records_item_post_failure() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/households/shopping/lists":
            return httpx.Response(200, json={"items": [{"id": "list-1"}]})
        return httpx.Response(422)  # item POST fails

    client = _client_for(handler)
    svc = MealieClientService("http://mealie", "key", client=client)
    results = await svc.add_to_shopping_list(["Milk"])
    await client.aclose()
    assert results[0]["added"] is False
    assert "422" in results[0]["detail"]


@pytest.mark.asyncio
async def test_add_to_shopping_list_records_item_post_transport_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/households/shopping/lists":
            return httpx.Response(200, json={"items": [{"id": "list-1"}]})
        raise httpx.ConnectError("dropped")  # the item POST itself raises

    client = _client_for(handler)
    svc = MealieClientService("http://mealie", "key", client=client)
    results = await svc.add_to_shopping_list(["Milk"])
    await client.aclose()
    assert results[0]["added"] is False
    assert "dropped" in results[0]["detail"]


def _patch_own_client(monkeypatch, handler) -> None:
    """Make _build_client() produce a MockTransport-backed client (no injection)."""
    import src.services.mealie_client_service as mod

    real_async_client = httpx.AsyncClient

    def fake_async_client(*args, **kwargs):
        return real_async_client(
            transport=httpx.MockTransport(handler), base_url="http://mealie"
        )

    monkeypatch.setattr(mod.httpx, "AsyncClient", fake_async_client)


@pytest.mark.asyncio
async def test_fetch_recipes_builds_own_client_and_closes_it(monkeypatch) -> None:
    _patch_own_client(monkeypatch, lambda request: httpx.Response(200, json={"items": []}))
    svc = MealieClientService("http://mealie", "key")  # no client injected
    assert await svc.fetch_recipes_with_ingredients() == []


@pytest.mark.asyncio
async def test_add_to_shopping_list_builds_own_client_and_closes_it(monkeypatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/households/shopping/lists":
            return httpx.Response(200, json={"items": [{"id": "list-1"}]})
        return httpx.Response(201)

    _patch_own_client(monkeypatch, handler)
    svc = MealieClientService("http://mealie", "key")  # no client injected
    results = await svc.add_to_shopping_list(["Milk"])
    assert results[0]["added"] is True
