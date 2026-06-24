"""Outbound HTTP client for a Mealie instance (Phase 2, Pantrie -> Mealie).

Mealie's API shape varies by version; calls are encapsulated here and fail with
actionable ExternalServiceError messages (FR-027). The shopping-list path in
particular differs across Mealie versions and should be verified against the
target instance.
"""
import httpx

from src.core.exceptions import ExternalServiceError
from src.core.logging import setup_logging
from src.services.ingredient_matching import is_match

logger = setup_logging()

DEFAULT_TIMEOUT = 15.0


def _item_display_name(item: dict) -> str:
    """Best human label for an existing Mealie shopping-list item."""
    food = item.get("food") or {}
    return (food.get("name") or item.get("note") or item.get("display") or "").strip()


def extract_ingredient_names(recipe_detail: dict) -> list[str]:
    """Pull human ingredient names from a Mealie recipe detail payload."""
    names: list[str] = []
    for ing in recipe_detail.get("recipeIngredient", []) or []:
        food = ing.get("food") or {}
        name = food.get("name") or ing.get("note") or ing.get("display") or ing.get("originalText")
        if name and name.strip():
            names.append(name.strip())
    return names


class MealieClientService:
    """Talks to a single Mealie instance. `client` is injectable for tests."""

    def __init__(self, base_url: str, api_key: str, client: httpx.AsyncClient | None = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self._client = client

    def _build_client(self) -> httpx.AsyncClient:
        return self._client or httpx.AsyncClient(
            base_url=self.base_url,
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=DEFAULT_TIMEOUT,
        )

    async def _get_json(self, client: httpx.AsyncClient, path: str, params: dict | None = None) -> dict:
        try:
            resp = await client.get(path, params=params)
        except httpx.HTTPError as e:
            raise ExternalServiceError(message=f"Could not reach Mealie at {self.base_url}: {e}")
        if resp.status_code == 401:
            raise ExternalServiceError(message="Mealie rejected the API key (401 Unauthorized)")
        if resp.status_code >= 400:
            raise ExternalServiceError(
                message=f"Mealie returned {resp.status_code} for {path}"
            )
        try:
            return resp.json()
        except ValueError:
            raise ExternalServiceError(message=f"Mealie returned a non-JSON response for {path}")

    async def fetch_recipes_with_ingredients(self, limit: int = 30) -> list[dict]:
        """Return [{recipe_id, name, ingredients: [str]}] for up to `limit` recipes."""
        client = self._build_client()
        should_close = self._client is None
        try:
            listing = await self._get_json(
                client, "/api/recipes", params={"page": 1, "perPage": limit}
            )
            items = listing.get("items") if isinstance(listing, dict) else listing
            items = items or []

            recipes: list[dict] = []
            for item in items[:limit]:
                slug = item.get("slug") or item.get("id")
                if not slug:
                    continue
                detail = await self._get_json(client, f"/api/recipes/{slug}")
                recipes.append(
                    {
                        "recipe_id": str(slug),
                        "name": detail.get("name") or item.get("name") or str(slug),
                        "ingredients": extract_ingredient_names(detail),
                    }
                )
            logger.info("Fetched recipes from Mealie", base_url=self.base_url, count=len(recipes))
            return recipes
        finally:
            if should_close:
                await client.aclose()

    async def _fetch_list_items(self, client: httpx.AsyncClient, list_id: str) -> list[dict]:
        """Existing items on a shopping list, used to de-duplicate before adding."""
        payload = await self._get_json(
            client,
            "/api/households/shopping/items",
            params={"queryFilter": f"shoppingListId={list_id}"},
        )
        items = payload.get("items") if isinstance(payload, dict) else payload
        return items or []

    @staticmethod
    def _find_existing(name: str, existing: list[dict]) -> dict | None:
        """The existing line item whose name matches ``name`` (normalized), if any."""
        for item in existing:
            label = _item_display_name(item)
            if label and is_match(name, label):
                return item
        return None

    async def add_to_shopping_list(self, item_names: list[str]) -> list[dict]:
        """Merge items into the household's first Mealie shopping list (best-effort).

        Before adding, the list's current items are fetched; an ingredient that
        matches an existing line (via the shared normalized matcher) increments
        that line's quantity instead of creating a duplicate (#34). Returns a
        per-item ``{name, added, updated, detail}`` list so partial success is
        visible to the caller (FR-026).
        """
        client = self._build_client()
        should_close = self._client is None
        try:
            lists = await self._get_json(client, "/api/households/shopping/lists")
            items = lists.get("items") if isinstance(lists, dict) else lists
            if not items:
                raise ExternalServiceError(
                    message="No Mealie shopping list exists to add items to"
                )
            list_id = items[0].get("id")

            # Local copy of the list so repeated names within one batch also merge.
            existing = await self._fetch_list_items(client, list_id)

            results: list[dict] = []
            for name in item_names:
                try:
                    match = self._find_existing(name, existing)
                    if match is not None:
                        new_qty = (match.get("quantity") or 1) + 1
                        resp = await client.put(
                            f"/api/households/shopping/items/{match['id']}",
                            json={**match, "quantity": new_qty},
                        )
                        ok = resp.status_code < 300
                        if ok:
                            match["quantity"] = new_qty
                        results.append(
                            {
                                "name": name,
                                "added": ok,
                                "updated": ok,
                                "detail": None if ok else f"Mealie returned {resp.status_code}",
                            }
                        )
                    else:
                        resp = await client.post(
                            "/api/households/shopping/items",
                            json={
                                "shoppingListId": list_id,
                                "note": name,
                                "quantity": 1,
                                "checked": False,
                            },
                        )
                        ok = resp.status_code < 300
                        if ok:
                            # Track it so a duplicate later in this batch increments.
                            created = {"note": name, "quantity": 1}
                            try:
                                created.update({"id": resp.json().get("id")})
                            except ValueError:
                                pass
                            existing.append(created)
                        results.append(
                            {
                                "name": name,
                                "added": ok,
                                "updated": False,
                                "detail": None if ok else f"Mealie returned {resp.status_code}",
                            }
                        )
                except httpx.HTTPError as e:
                    results.append({"name": name, "added": False, "updated": False, "detail": str(e)})
            logger.info(
                "Pushed items to Mealie shopping list",
                base_url=self.base_url,
                requested=len(item_names),
                added=sum(1 for r in results if r["added"]),
                updated=sum(1 for r in results if r["updated"]),
            )
            return results
        finally:
            if should_close:
                await client.aclose()
