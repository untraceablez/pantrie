"""Unit tests for the outbound Mealie HTTP client (US4)."""
import json

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


# --------------------------------------------------------------------------- #
# add_to_shopping_list (with #34 de-duplication)
# --------------------------------------------------------------------------- #
def _shopping_handler(existing_items: list[dict], *, calls: list[httpx.Request] | None = None):
    """A Mealie shopping handler: one list, ``existing_items`` already on it.

    GET items returns the existing items; POST/PUT echo 201/200. Records every
    request in ``calls`` when provided.
    """

    def handler(request: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(request)
        path = request.url.path
        if path == "/api/households/shopping/lists":
            return httpx.Response(200, json={"items": [{"id": "list-1"}]})
        if path == "/api/households/shopping/items" and request.method == "GET":
            return httpx.Response(200, json={"items": existing_items})
        if path == "/api/households/shopping/items" and request.method == "POST":
            return httpx.Response(201, json={"id": "new-item"})
        if path.startswith("/api/households/shopping/items/") and request.method == "PUT":
            return httpx.Response(200)
        return httpx.Response(404)

    return handler


@pytest.mark.asyncio
async def test_add_new_items_to_empty_list() -> None:
    client = _client_for(_shopping_handler([]))
    svc = MealieClientService("http://mealie", "key", client=client)
    results = await svc.add_to_shopping_list(["Milk", "Eggs"])
    await client.aclose()
    assert [(r["added"], r["updated"]) for r in results] == [(True, False), (True, False)]


@pytest.mark.asyncio
async def test_existing_item_is_incremented_not_duplicated() -> None:
    calls: list[httpx.Request] = []
    existing = [{"id": "x1", "note": "Corn Starch", "quantity": 2}]
    client = _client_for(_shopping_handler(existing, calls=calls))
    svc = MealieClientService("http://mealie", "key", client=client)

    # "cornstarch" matches the existing "Corn Starch" via the normalized matcher.
    [res] = await svc.add_to_shopping_list(["cornstarch"])
    await client.aclose()

    assert res["added"] is True and res["updated"] is True
    put = next(r for r in calls if r.method == "PUT")
    assert put.url.path == "/api/households/shopping/items/x1"
    assert json.loads(put.content)["quantity"] == 3  # 2 -> 3
    assert not any(r.method == "POST" for r in calls)  # no duplicate created


@pytest.mark.asyncio
async def test_repushing_same_ingredient_in_one_batch_merges() -> None:
    calls: list[httpx.Request] = []
    client = _client_for(_shopping_handler([], calls=calls))
    svc = MealieClientService("http://mealie", "key", client=client)

    results = await svc.add_to_shopping_list(["flour", "Flour"])
    await client.aclose()

    # First creates, second increments the just-created line — one POST, one PUT.
    assert [(r["added"], r["updated"]) for r in results] == [(True, False), (True, True)]
    assert sum(1 for r in calls if r.method == "POST") == 1
    assert sum(1 for r in calls if r.method == "PUT") == 1


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
        if request.method == "GET":
            return httpx.Response(200, json={"items": []})
        return httpx.Response(422)  # item POST fails

    client = _client_for(handler)
    svc = MealieClientService("http://mealie", "key", client=client)
    results = await svc.add_to_shopping_list(["Milk"])
    await client.aclose()
    assert results[0]["added"] is False
    assert "422" in results[0]["detail"]


@pytest.mark.asyncio
async def test_increment_failure_is_reported() -> None:
    existing = [{"id": "x1", "note": "milk", "quantity": 1}]

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/households/shopping/lists":
            return httpx.Response(200, json={"items": [{"id": "list-1"}]})
        if request.method == "GET":
            return httpx.Response(200, json={"items": existing})
        return httpx.Response(500)  # the PUT increment fails

    client = _client_for(handler)
    svc = MealieClientService("http://mealie", "key", client=client)
    [res] = await svc.add_to_shopping_list(["Milk"])
    await client.aclose()
    assert res["added"] is False and res["updated"] is False
    assert "500" in res["detail"]


@pytest.mark.asyncio
async def test_add_to_shopping_list_records_item_post_transport_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/households/shopping/lists":
            return httpx.Response(200, json={"items": [{"id": "list-1"}]})
        if request.method == "GET":
            return httpx.Response(200, json={"items": []})
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
    _patch_own_client(monkeypatch, _shopping_handler([]))
    svc = MealieClientService("http://mealie", "key")  # no client injected
    results = await svc.add_to_shopping_list(["Milk"])
    assert results[0]["added"] is True
