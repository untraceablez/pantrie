"""Barcode lookup API endpoints."""
from typing import Annotated

from fastapi import APIRouter, Query, status
from fastapi.responses import JSONResponse

from src.services.barcode_service import BarcodeService

router = APIRouter(prefix="/barcode", tags=["Barcode"])


# Registered before "/{barcode}" so "/barcode/search" isn't captured as a barcode.
@router.get("/search")
async def search_products(
    q: Annotated[str, Query(min_length=2, description="Product name to search for")],
    limit: Annotated[int, Query(ge=1, le=10)] = 3,
) -> JSONResponse:
    """Search Open Food Facts by name, returning a few suggestions + a results link."""
    barcode_service = BarcodeService()
    payload = await barcode_service.search_products(q, limit=limit)
    return JSONResponse(status_code=status.HTTP_200_OK, content=payload)


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
