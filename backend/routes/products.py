"""GET /products -- canonical product listing, filtering and search."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path, Query, Response

import db
from models import PriceHistory, Product, ProductDetail
from shapes import dumps, offer_dict, product_dict, product_rows_to_json

router = APIRouter(tags=["catalogue"])

MAX_LIMIT = 100
DEFAULT_LIMIT = 24


@router.get(
    "/products",
    response_model=list[Product],
    summary="List, filter and search canonical products",
    description=(
        "Bounded listing of canonical products. Returns `[]` when nothing matches -- never 404.\n\n"
        "**Load the landing page in two steps:** request a small first page "
        "(`?essential=true&limit=20`) for first paint, then page with `limit`/`offset` "
        "once the app has mounted. `limit` is hard-capped at 100 so the full "
        "50k-product catalogue can never be pulled in one request.\n\n"
        "Filters combine with AND. `q` searches product names and brands.\n\n"
        "The **`X-Total-Count`** response header carries how many products match the "
        "filter ignoring `limit`/`offset` -- use it to render \"24 of 1,240\" and to "
        "know when to stop paging. The body stays a bare array."
    ),
    responses={200: {"headers": {"X-Total-Count": {
        "description": "Total matches ignoring limit/offset.",
        "schema": {"type": "integer"}}}}},
)
def list_products(
    essential: bool | None = Query(None, description="Only curated Home Essentials."),
    category: str | None = Query(None, examples=["dairy-eggs-fridge"], description="Canonical category id."),
    subcategory: str | None = Query(None, examples=["milk"], description="Canonical subcategory id."),
    tag: str | None = Query(None, examples=["gluten-free"], description="Canonical tag id."),
    q: str | None = Query(None, examples=["milk"], description="Full-text search over product names."),
    special: bool | None = Query(None, description="Only products on special at some retailer."),
    retailer: str | None = Query(None, examples=["coles"], description="Only products this retailer stocks."),
    multi_retailer: bool | None = Query(None, description="Only products carried by 2+ retailers (comparable)."),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0),
) -> Response:
    # Hot paths are pre-rendered at build time and returned as bytes, skipping both
    # SQLite and serialization. Cloudflare then caches them at the edge on top.
    if offset == 0 and not any((subcategory, tag, q, special, retailer, multi_retailer)):
        if essential and limit == 20 and not category:
            if (hit := db.warm("essentials")) is not None:
                return _json(hit, db.warm_count("essentials"))
        if not essential and limit == DEFAULT_LIMIT:
            key = f"category_{category}_p0" if category else "products_p0"
            if (hit := db.warm(key)) is not None:
                return _json(hit, db.warm_count(key))

    where, params = [], []
    if essential:
        where.append("p.is_essential = 1")
    if category:
        where.append("p.category = ?")
        params.append(category)
    if subcategory:
        where.append("p.subcategory = ?")
        params.append(subcategory)
    if tag:
        # tags is a JSON array; the LIKE is exact-token because ids are quoted.
        where.append("p.tags LIKE ?")
        params.append(f'%"{tag}"%')
    if special:
        where.append("p.has_special = 1")
    if multi_retailer:
        where.append("p.retailer_count >= 2")
    if retailer:
        where.append("EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id AND o.retailer = ?)")
        params.append(retailer)

    if q:
        # FTS5 prefix search. Quote each token so user input can't inject operators.
        terms = " ".join(f'"{t}"*' for t in q.replace('"', " ").split() if t)
        if not terms:
            return _json(b"[]")
        where.append("p.id IN (SELECT id FROM products_fts WHERE products_fts MATCH ?)")
        params.append(terms)
        order = "p.retailer_count DESC, p.id"
    else:
        order = "p.is_essential DESC, p.essential_rank, p.id" if essential else "p.id"

    clause = (" WHERE " + " AND ".join(where)) if where else ""
    total = db.db().execute(f"SELECT COUNT(*) FROM products p{clause}", params).fetchone()[0]
    rows = db.db().execute(
        f"SELECT p.* FROM products p{clause} ORDER BY {order} LIMIT ? OFFSET ?",
        (*params, limit, offset)).fetchall()
    return _json(product_rows_to_json(rows), total)


@router.get(
    "/products/{product_id}",
    response_model=ProductDetail,
    summary="One product with every retailer's offer",
    responses={404: {"description": "No such canonical product id."}},
    description="The product plus one offer per retailer, cheapest first -- what the Compare page needs.",
)
def get_product(product_id: str = Path(examples=["full-cream-milk-2l"])) -> Response:
    row = db.db().execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if row is None:
        raise HTTPException(404, f"no product with id {product_id!r}")
    offers = db.db().execute(
        "SELECT * FROM offers WHERE product_id = ? ORDER BY price", (product_id,)).fetchall()
    return _json(dumps({**product_dict(row), "offers": [offer_dict(o) for o in offers]}))


@router.get(
    "/products/{product_id}/price-history",
    response_model=list[PriceHistory],
    summary="Observed price history per retailer",
    responses={404: {"description": "No such canonical product id."}},
    description=(
        "One series per retailer, oldest first. Backs a price sparkline and a "
        "\"cheapest in 30 days\" badge.\n\n"
        "Coverage is currently thin -- the crawler has only recently begun recording "
        "daily observations, so expect one or two points per offer until it has run "
        "for a while."
    ),
)
def price_history(
    product_id: str = Path(examples=["full-cream-milk-2l"]),
    days: int = Query(30, ge=1, le=365, description="Look back this many days."),
) -> Response:
    if db.db().execute("SELECT 1 FROM products WHERE id=?", (product_id,)).fetchone() is None:
        raise HTTPException(404, f"no product with id {product_id!r}")
    rows = db.db().execute(
        "SELECT o.retailer, h.price, h.was_price, h.is_special, h.recorded_at "
        "FROM price_history h JOIN offers o ON o.id = h.offer_id "
        "WHERE o.product_id = ? AND h.recorded_at >= date('now', ?) "
        "ORDER BY o.retailer, h.recorded_at",
        (product_id, f"-{days} days")).fetchall()
    series: dict[str, list[dict]] = {}
    for r in rows:
        series.setdefault(r["retailer"], []).append({
            "price": r["price"], "was_price": r["was_price"],
            "is_special": bool(r["is_special"]) if r["is_special"] is not None else None,
            "recorded_at": r["recorded_at"],
        })
    return _json(dumps([{"product_id": product_id, "retailer": k, "points": v}
                        for k, v in sorted(series.items())]))


def _json(payload: bytes, total: int | None = None) -> Response:
    headers = {"X-Total-Count": str(total), "Access-Control-Expose-Headers": "X-Total-Count"} \
        if total is not None else None
    return Response(payload, media_type="application/json", headers=headers)
