"""Focused tests for the three POST /compare strategies.

Uses synthetic offer maps so the numbers are exact. Live-catalogue shape checks
stay in test_api.py.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.compare import PickedOffer, _resolve_image, build_compare_options  # noqa: E402

RETAILERS = ["coles", "woolworths", "aldi"]


def offer(retailer, pid, price, name="Item", sku=None, rname=None, image=None):
    return PickedOffer(
        retailer=retailer,
        product_id=pid,
        product_name=name,
        retailer_product_id=sku,
        retailer_product_name=rname or f"{retailer} {name}",
        unit_price=price,
        image_url=image,
    )


def options(wanted, offers, known=None, retailers=RETAILERS):
    known = known if known is not None else list(wanted)
    return build_compare_options(wanted, known, retailers, offers)


def by_id(opts):
    return {o.id: o for o in opts}


def test_three_strategies_on_a_split_basket():
    # milk cheapest at WW, bread cheapest at Coles, eggs cheapest at ALDI.
    # Every retailer stocks all three, so a complete single store exists.
    offers = {
        "coles": {
            "milk": offer("coles", "milk", 4.0, "Milk"),
            "bread": offer("coles", "bread", 3.0, "Bread"),
            "eggs": offer("coles", "eggs", 5.0, "Eggs"),
        },
        "woolworths": {
            "milk": offer("woolworths", "milk", 3.0, "Milk"),
            "bread": offer("woolworths", "bread", 5.0, "Bread"),
            "eggs": offer("woolworths", "eggs", 5.0, "Eggs"),
        },
        "aldi": {
            "milk": offer("aldi", "milk", 5.0, "Milk"),
            "bread": offer("aldi", "bread", 5.0, "Bread"),
            "eggs": offer("aldi", "eggs", 2.0, "Eggs"),
        },
    }
    wanted = {"milk": 1, "bread": 1, "eggs": 1}
    o = by_id(options(wanted, offers))

    # singles: WW 13, Coles 12, ALDI 12 → cheapest 12 (Coles, first on tie with ALDI)
    # max complete single (baseline) = 13
    # split: Coles+ALDI = milk 4 + bread 3 + eggs 2 = 9
    # lowest: WW milk 3 + Coles bread 3 + ALDI eggs 2 = 8
    assert o["cheapest-single-store"].total == 12.0
    assert o["cheapest-single-store"].stores == 1
    assert o["cheapest-single-store"].description == "Coles"
    assert o["cheapest-single-store"].recommended is False
    assert o["cheapest-single-store"].savings == 1.0  # 13 - 12

    assert o["recommended-split"].total == 9.0
    assert o["recommended-split"].stores == 2
    assert o["recommended-split"].description == "Coles and ALDI"
    assert o["recommended-split"].recommended is True
    assert o["recommended-split"].savings == 4.0  # 13 - 9
    assert {b.retailer for b in o["recommended-split"].breakdown} == {"coles", "aldi"}

    assert o["lowest-possible-price"].total == 8.0
    assert o["lowest-possible-price"].stores == 3
    assert o["lowest-possible-price"].description == "Coles, Woolworths and ALDI"
    assert o["lowest-possible-price"].recommended is False
    assert o["lowest-possible-price"].savings == 5.0  # 13 - 8
    assert len(o["lowest-possible-price"].breakdown) == 3


def test_split_falls_back_to_single_store_when_a_second_shop_does_not_help():
    offers = {
        "coles": {"milk": offer("coles", "milk", 10.0, "Milk")},
        "woolworths": {"milk": offer("woolworths", "milk", 3.0, "Milk")},
        "aldi": {"milk": offer("aldi", "milk", 9.0, "Milk")},
    }
    o = by_id(options({"milk": 1}, offers))
    assert o["recommended-split"].stores == 1
    assert o["recommended-split"].description == "Woolworths"
    assert o["recommended-split"].total == 3.0
    assert o["cheapest-single-store"].total == 3.0
    assert o["lowest-possible-price"].total == 3.0
    assert o["lowest-possible-price"].stores == 1


def test_quantity_stays_on_one_offer_and_scales_line_total():
    offers = {
        "coles": {"milk": offer("coles", "milk", 2.0, "Milk", sku="c1")},
        "woolworths": {"milk": offer("woolworths", "milk", 3.0, "Milk", sku="w1")},
    }
    o = by_id(options({"milk": 3}, offers, retailers=["coles", "woolworths"]))
    item = o["cheapest-single-store"].breakdown[0].items[0]
    assert item.quantity == 3
    assert item.unit_price == 2.0
    assert item.line_total == 6.0
    assert item.retailer_product_id == "c1"
    assert o["cheapest-single-store"].total == 6.0


def test_cheapest_single_unavailable_when_no_store_has_the_full_basket():
    offers = {
        "coles": {"milk": offer("coles", "milk", 1.0, "Milk")},
        "woolworths": {"bread": offer("woolworths", "bread", 2.0, "Bread")},
    }
    o = by_id(options({"milk": 1, "bread": 1}, offers, retailers=["coles", "woolworths"]))
    single = o["cheapest-single-store"]
    assert single.total is None
    assert single.savings is None
    assert single.stores == 0
    assert single.breakdown == []
    assert single.description == ""
    # a 2-store split can still fulfil
    assert o["recommended-split"].total == 3.0
    assert o["recommended-split"].stores == 2
    assert o["recommended-split"].savings is None  # no complete single-store baseline
    assert o["lowest-possible-price"].total == 3.0


def test_lowest_unavailable_when_a_known_item_has_no_offer():
    offers = {
        "coles": {"milk": offer("coles", "milk", 1.0, "Milk")},
    }
    o = by_id(options({"milk": 1, "ghost": 1}, offers, known=["milk", "ghost"], retailers=["coles"]))
    for oid in ("recommended-split", "cheapest-single-store", "lowest-possible-price"):
        assert o[oid].total is None
        assert o[oid].savings is None
        assert o[oid].stores == 0
        assert o[oid].breakdown == []
        assert o[oid].description == ""
    assert o["recommended-split"].recommended is True
    assert o["cheapest-single-store"].recommended is False


def test_image_url_falls_back_offer_then_product_then_null():
    assert _resolve_image("https://offer/a.jpg", "https://product/a.jpg") == "https://offer/a.jpg"
    assert _resolve_image(None, "https://product/b.jpg") == "https://product/b.jpg"
    assert _resolve_image(None, None) is None
    assert _resolve_image("", "https://product/c.jpg") == "https://product/c.jpg"
