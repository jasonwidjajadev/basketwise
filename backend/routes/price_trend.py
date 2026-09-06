"""GET /products/{id}/price-trend -- price history merged from every source we have.

Two sources, deliberately kept separate from the existing /price-history route:

  local SQLite   the crawl the artifact was built from (one day, today)
  Supabase       every crawl ever uploaded (currently 6 days, 2026-08-28..09-06)

They do not share ids. The local catalogue keys on a canonical slug
("full-cream-milk-2l"); Supabase keys on each retailer's own sku. The join runs
through offers.retailer_product_id -> store_products.external_product_id, scoped
by store, which is the only linkage that exists between the two.

Results are merged and de-duplicated to one point per retailer per day, so a
product present in both sources does not draw a doubled line.
"""
from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException, Path, Query, Response
from starlette.concurrency import run_in_threadpool

import db
import supabase_client as sb
from models import PriceHistory
from shapes import dumps

router = APIRouter(tags=["catalogue"])

# One Supabase round trip per product is fine; one per viewer per second is not.
_CACHE: dict[str, tuple[float, bytes]] = {}
_TTL = float(300)
_CACHE_MAX = 512


def _local(product_id: str, days: int) -> dict[str, dict[str, dict]]:
    """Local artifact history, keyed retailer -> day -> point."""
    rows = db.db().execute(
        "SELECT o.retailer, h.price, h.was_price, h.is_special, h.recorded_at "
        "FROM price_history h JOIN offers o ON o.id = h.offer_id "
        "WHERE o.product_id = ? AND h.recorded_at >= date('now', ?) "
        "ORDER BY o.retailer, h.recorded_at",
        (product_id, f"-{days} days")).fetchall()
    out: dict[str, dict[str, dict]] = {}
    for r in rows:
        out.setdefault(r["retailer"], {})[r["recorded_at"][:10]] = {
            "price": r["price"], "was_price": r["was_price"],
            "is_special": bool(r["is_special"]) if r["is_special"] is not None else None,
            "recorded_at": r["recorded_at"],
        }
    return out


def _remote(offers: list[tuple[str, str]], days: int) -> dict[str, dict[str, dict]]:
    """Supabase history for these (retailer, retailer_product_id) pairs.

    Two requests total regardless of retailer count -- a request per retailer made
    the product page visibly slow.
    """
    if not offers or not sb.enabled():
        return {}
    store_ids = sb.stores()
    wanted = {(store_ids[r], pid): r for r, pid in offers if r in store_ids}
    if not wanted:
        return {}

    skus = {pid for _, pid in offers}
    rows = sb.get(
        "store_products?select=id,store_id,external_product_id"
        f"&external_product_id=in.{sb.in_list(skus)}")
    # retailer per store_product uuid, keeping only the (store, sku) pairs we asked for.
    by_sp: dict[str, str] = {}
    for r in rows:
        retailer = wanted.get((r.get("store_id"), r.get("external_product_id")))
        if retailer:
            by_sp[r["id"]] = retailer
    if not by_sp:
        return {}

    cutoff = time.strftime("%Y-%m-%d", time.gmtime(time.time() - days * 86400))
    hist = sb.get(
        "price_history?select=store_product_id,price,captured_at"
        f"&store_product_id=in.{sb.in_list(by_sp)}"
        f"&captured_at=gte.{cutoff}&order=captured_at&limit=5000")

    out: dict[str, dict[str, dict]] = {}
    for h in hist:
        retailer = by_sp.get(h.get("store_product_id"))
        ts = h.get("captured_at")
        if not retailer or not ts or h.get("price") is None:
            continue
        out.setdefault(retailer, {})[ts[:10]] = {
            "price": float(h["price"]), "was_price": None,
            "is_special": None, "recorded_at": ts,
        }
    return out


def _build(product_id: str, days: int) -> bytes:
    offers = [(r["retailer"], r["retailer_product_id"]) for r in db.db().execute(
        "SELECT retailer, retailer_product_id FROM offers "
        "WHERE product_id = ? AND retailer_product_id IS NOT NULL", (product_id,))]

    merged = _local(product_id, days)
    # Supabase wins on a same-day collision: it is the live upload, the artifact is a copy.
    for retailer, byday in _remote(offers, days).items():
        merged.setdefault(retailer, {}).update(byday)

    series = [
        {"product_id": product_id, "retailer": retailer,
         "points": [byday[d] for d in sorted(byday)]}
        for retailer, byday in sorted(merged.items()) if byday
    ]
    return dumps(series)


@router.get(
    "/products/{product_id}/price-trend",
    response_model=list[PriceHistory],
    summary="Price history merged across the local artifact and Supabase",
    responses={404: {"description": "No such canonical product id."}},
    description=(
        "One series per retailer, oldest first, de-duplicated to one point per day.\n\n"
        "Unlike `/price-history` (which reads only the immutable artifact, and so "
        "returns a single observation) this merges in every crawl uploaded to "
        "Supabase. Returns `[]` rather than an error if Supabase is unreachable."
    ),
)
async def price_trend(
    product_id: str = Path(examples=["chocolate-chip-brioche-rolls-8-pack"]),
    days: int = Query(30, ge=1, le=365, description="Look back this many days."),
) -> Response:
    if db.db().execute("SELECT 1 FROM products WHERE id=?", (product_id,)).fetchone() is None:
        raise HTTPException(404, f"no product with id {product_id!r}")

    key = f"{product_id}:{days}"
    hit = _CACHE.get(key)
    now = time.monotonic()
    if hit and now - hit[0] < _TTL:
        payload = hit[1]
    else:
        payload = await run_in_threadpool(_build, product_id, days)
        if len(_CACHE) >= _CACHE_MAX:
            _CACHE.clear()
        _CACHE[key] = (now, payload)
    return Response(payload, media_type="application/json")
