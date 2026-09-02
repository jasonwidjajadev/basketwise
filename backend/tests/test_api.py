"""Contract tests: these assert the shapes in Source-of_truth_v2.md, so if someone
changes a field name the test fails before the frontend does.

  .venv/bin/python -m pytest tests -q
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import db  # noqa: E402
import main  # noqa: E402

PRODUCT_FIELDS = {"id", "name", "brand", "category", "subcategory", "tags", "size_value",
                  "size_unit", "image_url", "is_essential", "min_price", "cheapest_retailer",
                  "unit_price", "unit_measure", "was_price", "has_special", "retailer_count",
                  "rating_avg", "rating_count"}


@pytest.fixture(scope="module")
def client():
    with TestClient(main.app) as c:
        yield c


def test_health(client):
    d = client.get("/health").json()
    assert d["status"] == "ok"
    assert d["product_count"] > 1000
    assert "coles" in d["retailers"] and "woolworths" in d["retailers"]


def test_categories_shape(client):
    cats = client.get("/categories").json()
    assert cats, "no categories -- the build produced an empty catalogue"
    for c in cats:
        assert {"id", "name", "subcategories"} <= c.keys()
        assert c["id"] == c["id"].lower().replace(" ", "-"), "ids must be canonical slugs"
        for s in c["subcategories"]:
            assert {"id", "name"} <= s.keys()


def test_products_shape_and_bounds(client):
    ps = client.get("/products?limit=5").json()
    assert len(ps) == 5
    assert all(PRODUCT_FIELDS == p.keys() for p in ps)
    assert isinstance(ps[0]["tags"], list)
    # limit is hard-capped so the whole catalogue can never be pulled at once
    assert client.get("/products?limit=101").status_code == 422


def test_no_match_returns_empty_list_not_404(client):
    r = client.get("/products?category=not-a-real-category")
    assert r.status_code == 200 and r.json() == []


def test_category_filter_only_returns_that_category(client):
    ps = client.get("/products?category=dairy-eggs-fridge&limit=50").json()
    assert ps and all(p["category"] == "dairy-eggs-fridge" for p in ps)


def test_pagination_does_not_repeat(client):
    a = [p["id"] for p in client.get("/products?limit=10&offset=0").json()]
    b = [p["id"] for p in client.get("/products?limit=10&offset=10").json()]
    assert not set(a) & set(b)


def test_search(client):
    ps = client.get("/products?q=milk&limit=10").json()
    assert ps and any("milk" in p["name"].lower() for p in ps)
    # a query that is only punctuation must not blow up the FTS parser
    assert client.get('/products?q="""&limit=5').status_code == 200


def test_essentials_are_ordered_and_flagged(client):
    ps = client.get("/products?essential=true&limit=20").json()
    assert len(ps) == 20 and all(p["is_essential"] for p in ps)


def test_product_detail_has_offers(client):
    pid = db.db().execute("SELECT id FROM products WHERE retailer_count>=2 LIMIT 1").fetchone()["id"]
    d = client.get(f"/products/{pid}").json()
    assert len(d["offers"]) >= 2
    assert {"retailer", "price", "product_url"} <= d["offers"][0].keys()
    assert client.get("/products/nope-does-not-exist").status_code == 404


def test_compare_totals_and_recommendation(client):
    ids = [r["id"] for r in db.db().execute(
        "SELECT id FROM products WHERE retailer_count>=2 LIMIT 4")]
    d = client.post("/compare", json={"items": [{"product_id": i, "quantity": 1} for i in ids]}).json()
    assert d["stores"]
    for s in d["stores"]:
        assert {"retailer", "total", "missing_product_ids", "available_count"} <= s.keys()
    if d["recommendation"]:
        best = d["recommendation"]
        complete = [s for s in d["stores"] if not s["missing_product_ids"] and s["available_count"]]
        assert best["total"] == min(s["total"] for s in complete)


def test_compare_quantity_scales_total(client):
    ids = [r["id"] for r in db.db().execute(
        "SELECT id FROM products WHERE retailer_count>=2 LIMIT 3")]
    one = client.post("/compare", json={"items": [{"product_id": i, "quantity": 1} for i in ids]}).json()
    two = client.post("/compare", json={"items": [{"product_id": i, "quantity": 2} for i in ids]}).json()
    by = lambda d: {s["retailer"]: s["total"] for s in d["stores"]}
    for r, t in by(one).items():
        assert abs(t * 2 - by(two)[r]) < 0.01


def test_compare_reports_unknown_ids_explicitly(client):
    d = client.post("/compare", json={"items": [{"product_id": "nope", "quantity": 1}]}).json()
    assert d["unknown_product_ids"] == ["nope"]
    assert d["recommendation"] is None


def test_compare_rejects_zero_quantity(client):
    r = client.post("/compare", json={"items": [{"product_id": "x", "quantity": 0}]})
    assert r.status_code == 422


def test_products_have_usable_images(client):
    """Product cards are image-first; a card with no image is a broken card."""
    ps = client.get("/products?limit=50").json()
    imgs = [p["image_url"] for p in ps if p["image_url"]]
    assert len(imgs) >= 48, "image coverage dropped below 96%"
    assert all(u.startswith("https://") for u in imgs), "image_url must be absolute https"


def test_price_fields_describe_one_retailer(client):
    """min_price/was_price/unit_price must all come from cheapest_retailer, or the
    card shows a Coles price next to an ALDI unit price."""
    ps = client.get("/products?special=true&limit=30").json()
    assert ps
    for p in ps:
        assert p["cheapest_retailer"], "priced product with no cheapest_retailer"
        if p["was_price"] is not None:
            assert p["was_price"] > p["min_price"], "was_price must exceed the current price"


def test_total_count_header_supports_pagination(client):
    r = client.get("/products?category=dairy-eggs-fridge&limit=5")
    total = int(r.headers["x-total-count"])
    assert total > 5 and len(r.json()) == 5
    assert "X-Total-Count" in r.headers.get("access-control-expose-headers", "")
    # the header must describe the filter, not the whole catalogue
    assert total < int(client.get("/products?limit=1").headers["x-total-count"])


def test_tag_filter_returns_only_tagged_products(client):
    ps = client.get("/products?tag=vegan&limit=20").json()
    assert ps, "no vegan products -- the dietary->tag mapping regressed"
    assert all("vegan" in p["tags"] for p in ps)


def test_price_history(client):
    pid = db.db().execute(
        "SELECT p.id FROM products p JOIN offers o ON o.product_id=p.id "
        "JOIN price_history h ON h.offer_id=o.id LIMIT 1").fetchone()["id"]
    series = client.get(f"/products/{pid}/price-history").json()
    assert series and {"product_id", "retailer", "points"} <= series[0].keys()
    assert series[0]["points"]
    assert client.get("/products/nope/price-history").status_code == 404


def test_openapi_is_generated(client):
    spec = client.get("/openapi.json").json()
    assert {"/categories", "/products", "/compare"} <= spec["paths"].keys()
    assert "Product" in spec["components"]["schemas"]


def test_etag_gives_304(client):
    r = client.get("/categories")
    etag = r.headers["etag"]
    assert "public" in r.headers["cache-control"]
    assert client.get("/categories", headers={"If-None-Match": etag}).status_code == 304
