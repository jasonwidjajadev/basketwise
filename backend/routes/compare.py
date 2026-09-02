"""POST /compare -- basket in, per-retailer totals and a recommendation out.

The only route with real logic, and the reason this is an API rather than a set of
static JSON blobs. All arithmetic happens here: the frontend must never total a
basket itself, or two screens will disagree.
"""
from __future__ import annotations

from fastapi import APIRouter

import db
from models import CompareRequest, CompareResponse, Recommendation, StoreComparison

router = APIRouter(tags=["compare"])

MAX_ITEMS = 200


@router.post(
    "/compare",
    response_model=CompareResponse,
    summary="Price a basket across every retailer",
    description=(
        "Send the whole basket; get one total per retailer plus a recommendation.\n\n"
        "- `total` sums only the items that retailer actually stocks.\n"
        "- `missing_product_ids` lists what it does not stock, explicitly -- a cheap total "
        "with three missing items is not a real win, so show this in the UI.\n"
        "- `recommendation` is the cheapest retailer stocking the **entire** basket, and is "
        "`null` when no retailer stocks everything.\n"
        "- `unknown_product_ids` lists ids that do not exist at all (usually a stale basket).\n\n"
        "Call this again whenever the basket changes."
    ),
)
def compare(req: CompareRequest) -> CompareResponse:
    # Merge duplicate lines so a basket listing the same product twice is priced once.
    wanted: dict[str, int] = {}
    for item in req.items[:MAX_ITEMS]:
        wanted[item.product_id] = wanted.get(item.product_id, 0) + item.quantity
    if not wanted:
        return CompareResponse(stores=[], recommendation=None, unknown_product_ids=[])

    ids = list(wanted)
    ph = ",".join("?" * len(ids))

    known = {r["id"] for r in db.db().execute(f"SELECT id FROM products WHERE id IN ({ph})", ids)}
    unknown = sorted(set(ids) - known)

    # One indexed pass over offers for the whole basket -- never a query per item.
    # MIN() because a retailer can list the same canonical product more than once.
    rows = db.db().execute(
        f"SELECT retailer, product_id, MIN(price) AS price FROM offers "
        f"WHERE product_id IN ({ph}) AND COALESCE(is_available, 1) = 1 "
        f"GROUP BY retailer, product_id",
        ids,
    ).fetchall()

    priced: dict[str, dict[str, float]] = {}
    for r in rows:
        priced.setdefault(r["retailer"], {})[r["product_id"]] = r["price"]

    stores: list[StoreComparison] = []
    for retailer in db.retailers():
        have = priced.get(retailer, {})
        total = sum(price * wanted[pid] for pid, price in have.items())
        missing = sorted(pid for pid in known if pid not in have)
        stores.append(StoreComparison(
            retailer=retailer,
            total=round(total, 2),
            missing_product_ids=missing,
            available_count=len(have),
        ))

    stores.sort(key=lambda s: (len(s.missing_product_ids), s.total))
    complete = [s for s in stores if not s.missing_product_ids and s.available_count]
    best = min(complete, key=lambda s: s.total) if complete else None

    return CompareResponse(
        stores=stores,
        recommendation=Recommendation(retailer=best.retailer, total=best.total) if best else None,
        unknown_product_ids=unknown,
    )
