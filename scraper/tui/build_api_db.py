#!/usr/bin/env python3
"""Build data/basketwise.db -- the slim, read-only artifact the API serves.

Runs on the BUILD machine, never on the serving host. Reads data/master.db and
emits the canonical products -> offers -> price_history model from
Source-of-truth.md, plus an FTS5 index and pre-serialized
"warm" JSON for the API's hot paths.

Every expensive thing (dedupe, cross-retailer matching, taxonomy mapping, FTS,
VACUUM) happens here so the API does none of it at request time.

  uv run tui/build_api_db.py --dry-run     # report only, writes nothing
  uv run tui/build_api_db.py               # build data/basketwise.db + data/warm/
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import canonical as C
from common import DATA_DIR, STORE_DISPLAY_NAME, console

MASTER = DATA_DIR / "master.db"
OUT = DATA_DIR / "basketwise.db"
WARM = DATA_DIR / "warm"
ESSENTIALS_FILE = Path(__file__).resolve().parents[2] / "backend" / "data" / "essentials.txt"

# Groups larger than this come from a near-empty or hopelessly generic match key
# ("milk", "") and would fuse unrelated products. Same guard build_master.py uses.
MAX_GROUP = 25
PAGE = 24  # must match the API's default limit so warm pages are actually hits

SCHEMA = """
PRAGMA journal_mode=OFF;
PRAGMA synchronous=OFF;

CREATE TABLE products (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  brand         TEXT,
  category      TEXT,
  subcategory   TEXT,
  tags          TEXT NOT NULL DEFAULT '[]',   -- JSON array of canonical tag ids
  size_value    REAL,
  size_unit     TEXT,
  image_url     TEXT,
  is_essential  INTEGER NOT NULL DEFAULT 0,
  essential_rank INTEGER,
  is_active     INTEGER NOT NULL DEFAULT 1,
  retailer_count INTEGER NOT NULL DEFAULT 0,  -- how many retailers carry it
  min_price     REAL,
  cheapest_retailer TEXT,                     -- who sells it at min_price
  unit_price    REAL,                         -- at the cheapest retailer
  unit_measure  TEXT,                         -- e.g. "100g" -- pairs with unit_price
  was_price     REAL,                         -- pre-special price at that retailer
  has_special   INTEGER NOT NULL DEFAULT 0,
  rating_avg    REAL,
  rating_count  INTEGER
);

CREATE TABLE offers (
  id                    TEXT PRIMARY KEY,
  product_id            TEXT NOT NULL REFERENCES products(id),
  retailer              TEXT NOT NULL,
  retailer_product_id   TEXT,
  retailer_product_name TEXT NOT NULL,
  retailer_brand        TEXT,
  source_category       TEXT,
  source_subcategory    TEXT,
  price                 REAL NOT NULL,
  was_price             REAL,
  is_special            INTEGER,
  special_type          TEXT,
  special_end_date      TEXT,
  size_value            REAL,
  size_unit             TEXT,
  unit_price            REAL,
  product_url           TEXT,
  image_url             TEXT,
  is_available          INTEGER,
  last_updated          TEXT
);

CREATE TABLE price_history (
  id          INTEGER PRIMARY KEY,
  offer_id    TEXT NOT NULL REFERENCES offers(id),
  price       REAL NOT NULL,
  was_price   REAL,
  is_special  INTEGER,
  special_type TEXT,
  recorded_at TEXT NOT NULL
);

CREATE TABLE categories (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  position INTEGER NOT NULL,
  product_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE subcategories (
  id          TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  product_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (category_id, id)
);

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE VIRTUAL TABLE products_fts USING fts5(
  name, id UNINDEXED, tokenize='porter unicode61'
);
"""

INDEXES = """
CREATE INDEX idx_products_cat      ON products(category, subcategory, id);
CREATE INDEX idx_products_ess      ON products(is_essential, essential_rank) WHERE is_essential=1;
CREATE INDEX idx_products_special  ON products(has_special) WHERE has_special=1;
CREATE INDEX idx_offers_product    ON offers(product_id, retailer);
CREATE INDEX idx_offers_retailer   ON offers(retailer);
CREATE INDEX idx_ph_offer          ON price_history(offer_id, recorded_at);
CREATE INDEX idx_sub_cat           ON subcategories(category_id, position);
"""


class Union:
    """Union-find over (store, product_id) so barcode and name matches compose."""

    def __init__(self) -> None:
        self.parent: dict[tuple[str, str], tuple[str, str]] = {}

    def find(self, x):
        self.parent.setdefault(x, x)
        root = x
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[x] != root:  # path compression
            self.parent[x], x = root, self.parent[x]
        return root

    def union(self, a, b) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def load_rows(conn: sqlite3.Connection) -> list[dict]:
    """Serving rows only: real groceries with a price, marketplace listings excluded.

    Woolworths' `is_market=1` rows are Everyday Market third-party listings
    (Home & Lifestyle, Electronics, Gift Ideas). They are ~490k of its 514k rows
    and are not supermarket groceries, so they never reach the API.
    """
    sql = """
        SELECT store, product_id, name, brand, size, description,
               price_cents, was_price_cents, save_cents,
               unit_price_cents, unit_measure, in_stock, available,
               barcode, dept, category, aisle, dietary, rating_avg, rating_count,
               image_urls, url, last_seen, detail_fetched_at
        FROM products
        WHERE COALESCE(deprecated,0) = 0
          AND price_cents IS NOT NULL AND price_cents > 0
          AND name IS NOT NULL AND TRIM(name) <> ''
          AND (store <> 'woolworths' OR COALESCE(is_market,0) = 0)
    """
    return [dict(r) for r in conn.execute(sql)]


def first_image(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = raw.strip()
    if raw.startswith("["):
        try:
            arr = json.loads(raw)
            for item in arr:
                if isinstance(item, str) and item.strip():
                    return item.strip()
                if isinstance(item, dict):
                    for k in ("url", "src", "large", "medium"):
                        if item.get(k):
                            return str(item[k])
        except json.JSONDecodeError:
            pass
        return None
    return raw.split(",")[0].strip() or None


def enrich(rows: list[dict]) -> None:
    """Attach canonical taxonomy + parsed size to every retailer row, in place."""
    for r in rows:
        store = r["store"]
        # Taxonomy is dept > category > aisle. v2's SUBCATEGORY_MAP keys are the
        # middle level ("Cooking Sauces & Recipe Bases"), but a few retailers put the
        # mappable name one level deeper, so try both and keep whichever resolves.
        src_cat = r["dept"] or r["category"]
        src_sub = r["category"] if r["dept"] else r["aisle"]
        r["src_cat"] = src_cat
        r["src_sub"] = src_sub
        r["cat"] = C.normalize_category(store, src_cat)
        r["sub"] = next(
            (m for lvl in (src_sub, r["aisle"], r["category"])
             if (m := C.normalize_subcategory(store, lvl))), None)
        # A subcategory only counts if it belongs to the mapped category (v2 rule:
        # prefer NULL over a mapping that contradicts itself).
        if r["sub"] and r["cat"] and r["sub"] not in C.CANONICAL_SUBCATEGORIES.get(r["cat"], []):
            if r["sub"] not in C.SUBCATEGORY_NAME:
                r["sub"] = None
        # Collection labels are weak evidence; the per-product `dietary` claim is strong.
        r["tags"] = sorted(set(C.normalize_tags(store, src_cat, src_sub))
                           | set(C.tags_from_dietary(r["dietary"])))
        sv, su = C.parse_size(r["size"], r["name"])
        if sv is None:
            sv, su = 1.0, "ea"
        r["size_value"], r["size_unit"] = sv, su
        r["image"] = first_image(r["image_urls"])
        r["key"] = C.norm_name(r["name"] or "", r["size"] or "")


def group(rows: list[dict]) -> dict[tuple[str, str], list[dict]]:
    """Cluster retailer rows into canonical products: barcode first, then name+size."""
    uf = Union()
    idx = {(r["store"], r["product_id"]): r for r in rows}
    for r in rows:
        uf.find((r["store"], r["product_id"]))

    def merge(groups: dict[str, list[tuple[str, str]]]) -> None:
        for members in groups.values():
            uniq = sorted(set(members))
            if len(uniq) < 2 or len(uniq) > MAX_GROUP:
                continue
            for other in uniq[1:]:
                uf.union(uniq[0], other)

    by_barcode: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for r in rows:
        bc = (r["barcode"] or "").strip()
        if bc and bc not in ("0", "00000000"):
            by_barcode[bc].append((r["store"], r["product_id"]))
    merge(by_barcode)

    by_name: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for r in rows:
        # size_value guards against fusing "Milk 1L" with "Milk 2L" when the
        # normalised text collapses to the same string.
        if len(r["key"]) >= 6:
            by_name[f"{r['key']}|{r['size_value']}{r['size_unit']}"].append((r["store"], r["product_id"]))
    merge(by_name)

    clusters: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for k, r in idx.items():
        clusters[uf.find(k)].append(r)
    return clusters


# Prefer the retailer with the richest, most reliably-named catalogue as the
# canonical name/image source.
STORE_RANK = {"coles": 0, "woolworths": 1, "aldi": 2, "harrisfarm": 3}


def pick_representative(members: list[dict]) -> dict:
    return min(members, key=lambda r: (
        STORE_RANK.get(r["store"], 9),
        0 if r["detail_fetched_at"] else 1,
        0 if r["cat"] else 1,
        0 if r["image"] else 1,
    ))


def build(dry_run: bool) -> int:
    t0 = time.time()
    if not MASTER.exists():
        console.print(f"[red]missing {MASTER} -- run tui/build_master.py first[/]")
        return 1

    src = sqlite3.connect(f"file:{MASTER}?mode=ro", uri=True)
    src.row_factory = sqlite3.Row
    total = src.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    rows = load_rows(src)
    console.print(f"master rows: [cyan]{total:,}[/] -> serving rows: [green]{len(rows):,}[/]")
    per_store = defaultdict(int)
    for r in rows:
        per_store[r["store"]] += 1
    console.print("  " + "  ".join(f"{s}=[bold]{n:,}[/]" for s, n in sorted(per_store.items())))

    enrich(rows)
    clusters = group(rows)
    console.print(f"canonical products: [green]{len(clusters):,}[/] "
                  f"(collapsed {len(rows) - len(clusters):,} duplicate/matched listings)")

    multi = sum(1 for m in clusters.values() if len({r['store'] for r in m}) >= 2)
    mapped = sum(1 for m in clusters.values() if pick_representative(m)["cat"])
    subbed = sum(1 for m in clusters.values() if pick_representative(m)["sub"])
    console.print(f"  multi-retailer: [bold]{multi:,}[/]  "
                  f"with canonical category: {mapped:,} ({mapped / max(len(clusters), 1):.0%})  "
                  f"with subcategory: {subbed:,} ({subbed / max(len(clusters), 1):.0%})")

    if dry_run:
        console.print("[yellow]--dry-run: nothing written[/]")
        src.close()
        return 0

    # ---- assign stable slug ids -------------------------------------------------
    essentials: list[str] = []
    if ESSENTIALS_FILE.exists():
        essentials = [ln.strip() for ln in ESSENTIALS_FILE.read_text().splitlines()
                      if ln.strip() and not ln.startswith("#")]
    ess_rank = {pid: i for i, pid in enumerate(essentials)}

    used: dict[str, int] = {}
    products, offers, history = [], [], []
    for members in clusters.values():
        rep = pick_representative(members)
        # Only append the size when the name doesn't already carry it, or every id
        # ends up like "...-280g-280-g". These ids are a permanent public contract.
        nm, sz = rep["name"].strip(), (rep["size"] or "").strip()
        flat = lambda t: C.slugify(t).replace("-", "")   # "280 g" and "280g" must compare equal
        base = C.slugify(nm if (not sz or flat(sz) in flat(nm)) else f"{nm} {sz}")
        n = used.get(base, 0)
        used[base] = n + 1
        pid = base if n == 0 else f"{base}-{n + 1}"

        tags = sorted({t for r in members for t in r["tags"]})
        # The card shows one headline price, so every price-shaped field on the
        # product must come from the SAME retailer -- the cheapest one. Mixing
        # min_price from Coles with unit_price from ALDI would be a lie.
        best = min(members, key=lambda r: r["price_cents"])
        was = best["was_price_cents"] / 100 if best["was_price_cents"] else None
        price = best["price_cents"] / 100
        has_special = any(r["was_price_cents"] and r["was_price_cents"] > r["price_cents"] for r in members)
        rated = next((r for r in members if r["rating_avg"]), None)
        products.append((
            pid, rep["name"].strip(), rep["brand"], rep["cat"], rep["sub"], json.dumps(tags),
            rep["size_value"], rep["size_unit"], rep["image"],
            1 if pid in ess_rank else 0, ess_rank.get(pid), 1,
            len({r["store"] for r in members}), round(price, 2), best["store"],
            best["unit_price_cents"] / 100 if best["unit_price_cents"] else None,
            best["unit_measure"] or None,
            was if (was and was > price) else None,
            1 if has_special else 0,
            rated["rating_avg"] if rated else None,
            rated["rating_count"] if rated else None,
        ))

        seen_store: set[str] = set()
        for r in sorted(members, key=lambda x: (STORE_RANK.get(x["store"], 9), x["price_cents"])):
            if r["store"] in seen_store:   # one offer per retailer per canonical product
                continue
            seen_store.add(r["store"])
            oid = f"{r['store']}:{r['product_id']}"
            was = r["was_price_cents"] / 100 if r["was_price_cents"] else None
            price = r["price_cents"] / 100
            special = bool(was and was > price)
            offers.append((
                oid, pid, r["store"], r["product_id"], (r["name"] or "").strip(), r["brand"],
                r["src_cat"], r["src_sub"], price, was, 1 if special else 0,
                "special" if special else None, None,
                r["size_value"], r["size_unit"],
                r["unit_price_cents"] / 100 if r["unit_price_cents"] else None,
                r["url"], r["image"],
                1 if (r["available"] if r["available"] is not None else r["in_stock"]) else 0,
                r["last_seen"],
            ))

    valid_offers = {o[0] for o in offers}
    for r in src.execute("SELECT store, product_id, ts, price_cents, was_price_cents FROM price_history"):
        oid = f"{r['store']}:{r['product_id']}"
        if oid in valid_offers and r["price_cents"]:
            was = r["was_price_cents"] / 100 if r["was_price_cents"] else None
            p = r["price_cents"] / 100
            history.append((oid, p, was, 1 if (was and was > p) else 0,
                            "special" if (was and was > p) else None, r["ts"]))
    src.close()

    # ---- write ------------------------------------------------------------------
    tmp = OUT.with_suffix(".db.tmp")
    tmp.unlink(missing_ok=True)
    db = sqlite3.connect(tmp)
    db.executescript(SCHEMA)
    db.executemany("INSERT INTO products VALUES (" + ",".join("?" * 21) + ")", products)
    db.executemany("INSERT INTO offers VALUES (" + ",".join("?" * 20) + ")", offers)
    db.executemany(
        "INSERT INTO price_history (offer_id,price,was_price,is_special,special_type,recorded_at)"
        " VALUES (?,?,?,?,?,?)", history)
    # brand is searchable too: people type "Coles milk" and "Bega cheese".
    db.executemany("INSERT INTO products_fts (name, id) VALUES (?,?)",
                   [(f"{p[1]} {p[2] or ''}".strip(), p[0]) for p in products])

    for pos, (cid, cname) in enumerate(C.CATEGORIES):
        db.execute("INSERT INTO categories VALUES (?,?,?,0)", (cid, cname, pos))
    for cid, subs in C.CANONICAL_SUBCATEGORIES.items():
        for pos, sid in enumerate(subs):
            db.execute("INSERT INTO subcategories VALUES (?,?,?,?,0)", (sid, cid, C.subcategory_name(sid), pos))
    # subcategories discovered in data but absent from the v2 starter list
    for (cid, sid) in db.execute(
            "SELECT DISTINCT category, subcategory FROM products "
            "WHERE category IS NOT NULL AND subcategory IS NOT NULL").fetchall():
        db.execute("INSERT OR IGNORE INTO subcategories VALUES (?,?,?,999,0)",
                   (sid, cid, C.subcategory_name(sid)))

    db.execute("UPDATE categories SET product_count="
               "(SELECT COUNT(*) FROM products p WHERE p.category=categories.id)")
    db.execute("UPDATE subcategories SET product_count=(SELECT COUNT(*) FROM products p "
               "WHERE p.category=subcategories.category_id AND p.subcategory=subcategories.id)")
    db.executescript(INDEXES)

    build_id = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    for k, v in [("build_id", build_id), ("built_at", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
                 ("product_count", str(len(products))), ("offer_count", str(len(offers))),
                 ("retailers", json.dumps(sorted({o[2] for o in offers})))]:
        db.execute("INSERT INTO meta VALUES (?,?)", (k, v))
    db.commit()
    db.execute("PRAGMA optimize")
    db.execute("VACUUM")
    db.close()

    write_warm(tmp, build_id)
    tmp.replace(OUT)
    os.chmod(OUT, 0o444)

    size_mb = OUT.stat().st_size / 1048576
    console.print(f"[green]wrote[/] {OUT}  [bold]{size_mb:,.1f} MB[/]  "
                  f"products={len(products):,} offers={len(offers):,} history={len(history):,}")
    console.print(f"build_id=[cyan]{build_id}[/]  in {time.time() - t0:,.1f}s")
    return 0


def write_warm(db_path: Path, build_id: str) -> None:
    """Pre-serialize the hot responses. The API returns these bytes verbatim.

    Same payloads can later be uploaded to R2 and served from the edge with the
    origin removed -- no API change, just a different destination.
    """
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
    from shapes import category_payload, product_rows_to_json

    WARM.mkdir(exist_ok=True)
    for stale in WARM.glob("*.json"):
        stale.unlink()
    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row

    counts: dict[str, int] = {}
    (WARM / "categories.json").write_bytes(category_payload(db))
    ess = db.execute("SELECT * FROM products WHERE is_essential=1 "
                     "ORDER BY essential_rank LIMIT 20").fetchall()
    if not ess:  # no curated list yet -- fall back to the widest-stocked products
        ess = db.execute("SELECT * FROM products WHERE image_url IS NOT NULL "
                         "ORDER BY retailer_count DESC, min_price ASC LIMIT 20").fetchall()
    (WARM / "essentials.json").write_bytes(product_rows_to_json(ess))
    counts["essentials"] = db.execute("SELECT COUNT(*) FROM products WHERE is_essential=1").fetchone()[0]

    n = 0
    for (cid,) in db.execute("SELECT id FROM categories WHERE product_count > 0"):
        rows = db.execute("SELECT * FROM products WHERE category=? ORDER BY id LIMIT ?",
                          (cid, PAGE)).fetchall()
        (WARM / f"category_{cid}_p0.json").write_bytes(product_rows_to_json(rows))
        counts[f"category_{cid}_p0"] = db.execute(
            "SELECT COUNT(*) FROM products WHERE category=?", (cid,)).fetchone()[0]
        n += 1
    rows = db.execute("SELECT * FROM products ORDER BY id LIMIT ?", (PAGE,)).fetchall()
    (WARM / "products_p0.json").write_bytes(product_rows_to_json(rows))
    counts["products_p0"] = db.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    (WARM / "_counts.json").write_bytes(json.dumps(counts).encode())
    (WARM / "_build.json").write_bytes(json.dumps({"build_id": build_id}).encode())
    db.close()
    console.print(f"warm cache: [green]{n + 3}[/] pre-rendered responses -> {WARM}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="report counts, write nothing")
    return build(ap.parse_args().dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
