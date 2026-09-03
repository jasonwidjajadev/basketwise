"""POST /compare -- basket in, three buying strategies out.

The only route with real logic, and the reason this is an API rather than a set of
static JSON blobs. All arithmetic happens here: the frontend must never total a
basket itself, or two screens will disagree.
"""
from __future__ import annotations

from dataclasses import dataclass
from itertools import combinations

from fastapi import APIRouter

import db
from models import (
    CompareItem,
    CompareOption,
    CompareOptionId,
    CompareRequest,
    CompareResponse,
    StoreBreakdown,
)

router = APIRouter(tags=["compare"])

MAX_ITEMS = 200

RETAILER_LABEL = {
    "coles": "Coles",
    "woolworths": "Woolworths",
    "aldi": "ALDI",
    "harrisfarm": "Harris Farm",
}

_OPTION_NAME: dict[CompareOptionId, str] = {
    "recommended-split": "Recommended split",
    "cheapest-single-store": "Cheapest single store",
    "lowest-possible-price": "Lowest possible price",
}


@dataclass(frozen=True, slots=True)
class PickedOffer:
    retailer: str
    product_id: str
    product_name: str
    retailer_product_id: str | None
    retailer_product_name: str
    unit_price: float
    image_url: str | None


# retailer -> product_id -> cheapest available offer
OfferMap = dict[str, dict[str, PickedOffer]]


def _resolve_image(offer_image: str | None, product_image: str | None) -> str | None:
    return offer_image or product_image or None


def _money(n: float) -> float:
    return round(n, 2)


def _describe(retailers: list[str]) -> str:
    labels = [RETAILER_LABEL.get(r, r) for r in retailers]
    if not labels:
        return ""
    if len(labels) == 1:
        return labels[0]
    if len(labels) == 2:
        return f"{labels[0]} and {labels[1]}"
    return f"{', '.join(labels[:-1])} and {labels[-1]}"


def _unavailable(option_id: CompareOptionId) -> CompareOption:
    return CompareOption(
        id=option_id,
        name=_OPTION_NAME[option_id],
        description="",
        total=None,
        savings=None,
        stores=0,
        recommended=option_id == "recommended-split",
        breakdown=[],
    )


def _pick_cheaper(a: PickedOffer, b: PickedOffer, retailer_rank: dict[str, int]) -> PickedOffer:
    if a.unit_price < b.unit_price:
        return a
    if b.unit_price < a.unit_price:
        return b
    return a if retailer_rank[a.retailer] <= retailer_rank[b.retailer] else b


def _option_from_picks(
    option_id: CompareOptionId,
    wanted: dict[str, int],
    known: list[str],
    retailers: list[str],
    picks: dict[str, PickedOffer],
    baseline: float | None,
) -> CompareOption:
    if any(pid not in picks for pid in known):
        return _unavailable(option_id)

    by_retailer: dict[str, list[CompareItem]] = {r: [] for r in retailers}
    for pid in known:
        offer = picks[pid]
        qty = wanted[pid]
        by_retailer[offer.retailer].append(
            CompareItem(
                product_id=pid,
                product_name=offer.product_name,
                retailer_product_id=offer.retailer_product_id,
                retailer_product_name=offer.retailer_product_name,
                quantity=qty,
                unit_price=offer.unit_price,
                line_total=_money(offer.unit_price * qty),
                image_url=offer.image_url,
            )
        )

    breakdown: list[StoreBreakdown] = []
    total = 0.0
    for retailer in retailers:
        items = by_retailer[retailer]
        if not items:
            continue
        subtotal = _money(sum(i.line_total for i in items))
        total += subtotal
        breakdown.append(StoreBreakdown(retailer=retailer, subtotal=subtotal, items=items))

    total = _money(total)
    savings = _money(baseline - total) if baseline is not None else None
    used = [b.retailer for b in breakdown]
    return CompareOption(
        id=option_id,
        name=_OPTION_NAME[option_id],
        description=_describe(used),
        total=total,
        savings=savings,
        stores=len(breakdown),
        recommended=option_id == "recommended-split",
        breakdown=breakdown,
    )


def _cheapest_single(
    wanted: dict[str, int],
    known: list[str],
    retailers: list[str],
    offers: OfferMap,
    baseline: float | None,
) -> CompareOption:
    complete: list[tuple[float, str]] = []
    for retailer in retailers:
        have = offers.get(retailer, {})
        if any(pid not in have for pid in known):
            continue
        total = sum(have[pid].unit_price * wanted[pid] for pid in known)
        complete.append((total, retailer))
    if not complete:
        return _unavailable("cheapest-single-store")
    _total, winner = min(complete, key=lambda t: (t[0], retailers.index(t[1])))
    picks = {pid: offers[winner][pid] for pid in known}
    return _option_from_picks("cheapest-single-store", wanted, known, retailers, picks, baseline)


def _lowest_possible(
    wanted: dict[str, int],
    known: list[str],
    retailers: list[str],
    offers: OfferMap,
    baseline: float | None,
) -> CompareOption:
    rank = {r: i for i, r in enumerate(retailers)}
    picks: dict[str, PickedOffer] = {}
    for pid in known:
        candidates = [offers[r][pid] for r in retailers if pid in offers.get(r, {})]
        if not candidates:
            return _unavailable("lowest-possible-price")
        best = candidates[0]
        for c in candidates[1:]:
            best = _pick_cheaper(best, c, rank)
        picks[pid] = best
    return _option_from_picks("lowest-possible-price", wanted, known, retailers, picks, baseline)


def _recommended_split(
    wanted: dict[str, int],
    known: list[str],
    retailers: list[str],
    offers: OfferMap,
    baseline: float | None,
) -> CompareOption:
    rank = {r: i for i, r in enumerate(retailers)}
    candidates: list[tuple[float, int, tuple[str, ...], dict[str, PickedOffer]]] = []

    def consider(store_ids: tuple[str, ...]) -> None:
        picks: dict[str, PickedOffer] = {}
        for pid in known:
            available = [offers[r][pid] for r in store_ids if pid in offers.get(r, {})]
            if not available:
                return
            best = available[0]
            for c in available[1:]:
                best = _pick_cheaper(best, c, rank)
            picks[pid] = best
        total = sum(picks[pid].unit_price * wanted[pid] for pid in known)
        used = tuple(sorted({p.retailer for p in picks.values()}, key=lambda r: rank[r]))
        candidates.append((total, len(used), used, picks))

    for retailer in retailers:
        consider((retailer,))
    for a, b in combinations(retailers, 2):
        consider((a, b))

    if not candidates:
        return _unavailable("recommended-split")
    _total, _n, _used, picks = min(candidates, key=lambda t: (t[0], t[1], t[2]))
    return _option_from_picks("recommended-split", wanted, known, retailers, picks, baseline)


def _complete_single_totals(
    wanted: dict[str, int],
    known: list[str],
    retailers: list[str],
    offers: OfferMap,
) -> list[float]:
    totals: list[float] = []
    for retailer in retailers:
        have = offers.get(retailer, {})
        if any(pid not in have for pid in known):
            continue
        totals.append(sum(have[pid].unit_price * wanted[pid] for pid in known))
    return totals


def build_compare_options(
    wanted: dict[str, int],
    known: list[str],
    retailers: list[str],
    offers: OfferMap,
) -> list[CompareOption]:
    """Pure compare math. Used by the route and by tests."""
    singles = _complete_single_totals(wanted, known, retailers, offers)
    baseline = max(singles) if singles else None
    return [
        _recommended_split(wanted, known, retailers, offers, baseline),
        _cheapest_single(wanted, known, retailers, offers, baseline),
        _lowest_possible(wanted, known, retailers, offers, baseline),
    ]


def _load_offers(ids: list[str]) -> OfferMap:
    ph = ",".join("?" * len(ids))
    rows = db.db().execute(
        f"""
        SELECT o.retailer, o.product_id, o.price, o.retailer_product_id,
               o.retailer_product_name, o.image_url AS offer_image,
               p.name AS product_name, p.image_url AS product_image
        FROM offers o
        JOIN products p ON p.id = o.product_id
        WHERE o.product_id IN ({ph}) AND COALESCE(o.is_available, 1) = 1
        """,
        ids,
    ).fetchall()

    best: OfferMap = {}
    for r in rows:
        offer = PickedOffer(
            retailer=r["retailer"],
            product_id=r["product_id"],
            product_name=r["product_name"],
            retailer_product_id=r["retailer_product_id"],
            retailer_product_name=r["retailer_product_name"],
            unit_price=r["price"],
            image_url=_resolve_image(r["offer_image"], r["product_image"]),
        )
        bucket = best.setdefault(offer.retailer, {})
        current = bucket.get(offer.product_id)
        key = (offer.unit_price, offer.retailer_product_id or "")
        if current is None or key < (current.unit_price, current.retailer_product_id or ""):
            bucket[offer.product_id] = offer
    return best


@router.post(
    "/compare",
    response_model=CompareResponse,
    summary="Price a basket as three buying strategies",
    description=(
        "Send the whole basket; get three complete-basket options:\n\n"
        "- `recommended-split` — cheapest practical basket using at most two retailers "
        "(a single store if a second shop does not help).\n"
        "- `cheapest-single-store` — cheapest retailer that stocks every known item.\n"
        "- `lowest-possible-price` — cheapest offer per item, any number of retailers.\n\n"
        "A strategy that cannot fulfil the complete known basket returns `total: null` "
        "and an empty `breakdown` — never a silent partial total.\n"
        "`unknown_product_ids` lists ids that do not exist at all (usually a stale basket).\n"
        "`savings` is against the most expensive complete single-store basket.\n\n"
        "Call this again whenever the basket changes."
    ),
)
def compare(req: CompareRequest) -> CompareResponse:
    wanted: dict[str, int] = {}
    for item in req.items[:MAX_ITEMS]:
        wanted[item.product_id] = wanted.get(item.product_id, 0) + item.quantity
    if not wanted:
        return CompareResponse(options=[], unknown_product_ids=[])

    ids = list(wanted)
    ph = ",".join("?" * len(ids))
    known_set = {r["id"] for r in db.db().execute(f"SELECT id FROM products WHERE id IN ({ph})", ids)}
    unknown = sorted(set(ids) - known_set)
    known = [pid for pid in wanted if pid in known_set]
    if not known:
        return CompareResponse(options=[], unknown_product_ids=unknown)

    return CompareResponse(
        options=build_compare_options(wanted, known, db.retailers(), _load_offers(known)),
        unknown_product_ids=unknown,
    )
