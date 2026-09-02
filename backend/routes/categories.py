"""GET /categories -- the source of truth for category ids AND their display labels."""
from __future__ import annotations

from fastapi import APIRouter, Response

import db
from models import Category
from shapes import category_payload

router = APIRouter(tags=["catalogue"])


@router.get(
    "/categories",
    response_model=list[Category],
    summary="Canonical categories with subcategories",
    description=(
        "Returns every canonical BasketWise category that has products, each with its "
        "subcategories.\n\n"
        "Use `id` in API requests and `name` for display. Do **not** build your own "
        "id-to-label map on the frontend -- this endpoint is the source of truth for both."
    ),
)
def get_categories() -> Response:
    cached = db.warm("categories")
    return Response(cached or category_payload(db.db()), media_type="application/json")
