"""The single definition of the JSON the API returns.

Both the API (cold path) and scraper/tui/build_api_db.py (warm cache) serialize
through here, so a pre-rendered response and a live one are byte-identical.
Shapes follow Source-of-truth.md sections 0.3, 0.4 and 0.7.
"""
from __future__ import annotations

import json
import sqlite3
from typing import Any


def product_offer_dict(row: sqlite3.Row | Any) -> dict:
    """Lightweight offer shape used by product cards."""
    return {
        "retailer": row["retailer"],
        "price": row["price"],
    }


def product_dict(
    row: sqlite3.Row | Any,
    offers: list[dict] | None = None,
) -> dict:
    """One canonical product, exactly the v2 section 0.3 `Product` shape.

    `min_price` / `retailer_count` are additive conveniences so the frontend can
    render a "from $x at N stores" card without a second round trip; the required
    contract fields are unchanged.
    """
    return {
        "id": row["id"],
        "name": row["name"],
        "brand": row["brand"],
        "category": row["category"],
        "subcategory": row["subcategory"],
        "tags": json.loads(row["tags"]) if row["tags"] else [],
        "size_value": row["size_value"],
        "size_unit": row["size_unit"],
        "image_url": row["image_url"],
        "is_essential": bool(row["is_essential"]),

        # Every price field below describes the SAME (cheapest) retailer, so a
        # product card can render one coherent headline without a second request.
        "min_price": row["min_price"],
        "cheapest_retailer": row["cheapest_retailer"],
        "unit_price": row["unit_price"],
        "unit_measure": row["unit_measure"],
        "was_price": row["was_price"],
        "has_special": bool(row["has_special"]),
        "retailer_count": row["retailer_count"],
        "rating_avg": row["rating_avg"],
        "rating_count": row["rating_count"],

        # Lightweight retailer prices for the frontend product card.
        "offers": offers or [],
    }


def offer_dict(row: sqlite3.Row | Any) -> dict:
    """v2 section 0.4 `Offer`."""
    return {
        "id": row["id"],
        "product_id": row["product_id"],
        "retailer": row["retailer"],
        "retailer_product_id": row["retailer_product_id"],
        "retailer_product_name": row["retailer_product_name"],
        "retailer_brand": row["retailer_brand"],
        "source_category": row["source_category"],
        "source_subcategory": row["source_subcategory"],
        "price": row["price"],
        "was_price": row["was_price"],
        "is_special": (
            bool(row["is_special"])
            if row["is_special"] is not None
            else None
        ),
        "special_type": row["special_type"],
        "special_end_date": row["special_end_date"],
        "size_value": row["size_value"],
        "size_unit": row["size_unit"],
        "unit_price": row["unit_price"],
        "product_url": row["product_url"],
        "image_url": row["image_url"],
        "is_available": (
            bool(row["is_available"])
            if row["is_available"] is not None
            else None
        ),
        "last_updated": row["last_updated"],
    }


def dumps(obj: Any) -> bytes:
    """Compact, stable JSON. Separators matter: warm and cold bytes must match."""
    return json.dumps(
        obj,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")


def product_rows_to_json(
    rows,
    conn: sqlite3.Connection,
) -> bytes:
    """Serialize products with their existing retailer offers.

    Fetch all offers for the current page in one query rather than making
    one database query per product.
    """
    rows = list(rows)

    if not rows:
        return dumps([])

    product_ids = [row["id"] for row in rows]

    placeholders = ",".join(
        "?" for _ in product_ids
    )

    offer_rows = conn.execute(
        f"""
        SELECT product_id, retailer, price
        FROM offers
        WHERE product_id IN ({placeholders})
        ORDER BY product_id, price, retailer
        """,
        product_ids,
    ).fetchall()

    offers_by_product: dict[str, list[dict]] = {}

    for offer in offer_rows:
        offers_by_product.setdefault(
            offer["product_id"],
            [],
        ).append(
            product_offer_dict(offer)
        )

    return dumps(
        [
            product_dict(
                row,
                offers_by_product.get(
                    row["id"],
                    [],
                ),
            )
            for row in rows
        ]
    )


def category_payload(db: sqlite3.Connection) -> bytes:
    """GET /categories: return the full canonical category tree.

    All canonical categories and subcategories are returned, even when their
    current product_count is 0, so the API shape matches categories.json.
    """

    subs: dict[str, list[dict]] = {}

    for r in db.execute(
        "SELECT category_id, id, name, product_count "
        "FROM subcategories "
        "ORDER BY category_id, position, name"
    ):
        subs.setdefault(
            r["category_id"],
            [],
        ).append(
            {
                "id": r["id"],
                "name": r["name"],
                "product_count": r["product_count"],
            }
        )

    out = [
        {
            "id": r["id"],
            "name": r["name"],
            "product_count": r["product_count"],
            "subcategories": subs.get(
                r["id"],
                [],
            ),
        }
        for r in db.execute(
            "SELECT id, name, product_count "
            "FROM categories "
            "ORDER BY position"
        )
    ]

    return dumps(out)