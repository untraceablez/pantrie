"""Product search and barcode lookup API endpoints."""
from typing import Annotated

from fastapi import APIRouter, Query, status
from fastapi.responses import JSONResponse

from src.services.barcode_service import BarcodeService
from src.services.product_sources import SOURCE_KEYS

router = APIRouter(prefix="/barcode", tags=["Barcode"])


# Registered before "/{barcode}" so "/barcode/search" isn't captured as a barcode.
@router.get("/search")
async def search_products(
    q: Annotated[str, Query(min_length=2, description="Product name to search for")],
    limit: Annotated[int, Query(ge=1, le=10)] = 3,
) -> JSONResponse:
    """Search every open product database by name, grouped by source.

    Each group carries its own "see more" link so the user can keep looking in
    whichever source is most relevant to what they typed.
    """
    barcode_service = BarcodeService()
    payload = await barcode_service.search_products(q, limit=limit)
    return JSONResponse(status_code=status.HTTP_200_OK, content=payload)


# Also registered before "/{barcode}" so the literal path wins.
@router.get("/product")
async def lookup_product(
    source: Annotated[str, Query(description=f"One of: {', '.join(SOURCE_KEYS)}")],
    id: Annotated[str, Query(description="Barcode, or FDC id for the usda source")],
) -> JSONResponse:
    """Look up a search suggestion's full details in the source it came from."""
    if source not in SOURCE_KEYS:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": "Unknown product source",
                "details": {"source": source, "supported": list(SOURCE_KEYS)},
            },
        )

    product_info = await BarcodeService().lookup_product(source, id)

    if product_info:
        return JSONResponse(status_code=status.HTTP_200_OK, content=product_info)

    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "error": "Product not found",
            "details": {"source": source, "id": id},
        },
    )


@router.get("/{barcode}")
async def lookup_barcode(barcode: str) -> JSONResponse:
    """
    Look up product information by barcode.

    Args:
        barcode: The barcode to look up (UPC, EAN, etc.)

    Returns:
        Product information if found, 404 if not found
    """
    barcode_service = BarcodeService()
    product_info = await barcode_service.lookup_barcode(barcode)

    if product_info:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=product_info,
        )

    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "error": "Product not found",
            "details": {"barcode": barcode},
        },
    )
