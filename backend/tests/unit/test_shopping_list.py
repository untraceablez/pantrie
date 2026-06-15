"""Unit tests for pushing items to a Mealie shopping list (US5)."""
import httpx
import pytest

from src.core.exceptions import ExternalServiceError
from src.services.mealie_client_service import MealieClientService


@pytest.mark.asyncio
async def test_add_to_shopping_list_partial_success() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/households/shopping/lists":
            return httpx.Response(200, json={"items": [{"id": "list-1"}]})
        if request.url.path == "/api/households/shopping/items":
            body = request.content.decode()
            # Fail one specific item to exercise partial success.
            return httpx.Response(500 if "vanilla" in body else 201)
        return httpx.Response(404)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://mealie")
    svc = MealieClientService("http://mealie", "key", client=client)
    results = await svc.add_to_shopping_list(["flour", "vanilla"])
    await client.aclose()

    by_name = {r["name"]: r for r in results}
    assert by_name["flour"]["added"] is True
    assert by_name["vanilla"]["added"] is False
    assert by_name["vanilla"]["detail"]


@pytest.mark.asyncio
async def test_add_to_shopping_list_no_list_raises() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/households/shopping/lists":
            return httpx.Response(200, json={"items": []})
        return httpx.Response(404)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://mealie")
    svc = MealieClientService("http://mealie", "key", client=client)
    with pytest.raises(ExternalServiceError):
        await svc.add_to_shopping_list(["flour"])
    await client.aclose()
