#!/usr/bin/env python3
"""Build data/master.db from the per-store hyperscrape DBs.

Unifies every store (Coles, Woolworths, ALDI, Harris Farm, ...) into one
`products` table, links matching products across ALL of them by barcode (tier
1) and a name+size fallback (tier 2), marks products the old scrapers had but
the new crawl no longer finds as deprecated, and prints a source comparison:
Python (Supabase) vs old Go scraper vs new hyperscrape.

  uv run tui/build_master.py
"""
from __future__ import annotations

import argparse
import re
import sqlite3
from pathlib import Path

from rich.table import Table

from common import DATA_DIR, OLD_GO_DB, OLD_ID_PREFIX, STORES, console, db_path, load_env

MASTER = DATA_DIR / "master.db"

_brandnoise = re.compile(r"\b(coles|woolworths|ww|the|by|brand|select|essentials|homebrand|macro)\b")
_unit = re.compile(r"(\d+(?:\.\d+)?)\s*(kg|g|l|ml|pk|pack|ea|each)\b")
_punct = re.compile(r"[^a-z0-9 ]+")
_ws = re.compile(r"\s+")


def norm_name(name: str, size: str) -> str:
    s = f"{name} {size}".lower()

    def conv(m: re.Match) -> str:
        v, u = float(m.group(1)), m.group(2)
        if u == "kg":
            return f"{v * 1000:g}g"
        if u == "l":
            return f"{v * 1000:g}ml"
        if u in ("pack", "ea", "each"):
            return f"{v:g}pk"
        return f"{v:g}{u}"

    s = _unit.sub(conv, s)
    s = _brandnoise.sub(" ", s)
    s = _punct.sub(" ", s)
    return _ws.sub(" ", s).strip()


def build(schema_src: Path) -> None:
    if MASTER.exists():
        MASTER.unlink()
    m = sqlite3.connect(MASTER)
    m.row_factory = sqlite3.Row
    src = sqlite3.connect(schema_src)
    for (sql,) in src.execute("SELECT sql FROM sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'"):
        m.executescript(sql + ";")
    src.close()
    # N-way cross-store links: one row per matched (store,id) pair, store_a<store_b
    # alphabetically so each pair is stored once regardless of discovery order.
    m.execute("""CREATE TABLE IF NOT EXISTS product_links (
        store_a TEXT, id_a TEXT, store_b TEXT, id_b TEXT, method TEXT, confidence REAL,
        PRIMARY KEY (store_a, id_a, store_b, id_b))""")
    m.execute("""CREATE TABLE IF NOT EXISTS source_counts (
        source TEXT, store TEXT, unique_products INTEGER, note TEXT,
        PRIMARY KEY (source, store))""")
    for store in STORES:
        p = db_path(store)
        if not p.exists():
            console.print(f"[yellow]skip {store}: {p} missing[/]")
            continue
        m.execute("ATTACH DATABASE ? AS s", (str(p),))
        cols = ",".join(r[1] for r in m.execute("PRAGMA table_info(products)"))
        m.execute(f"INSERT OR REPLACE INTO products ({cols}) SELECT {cols} FROM s.products")
        m.execute("INSERT OR IGNORE INTO price_history SELECT * FROM s.price_history")
        m.execute("INSERT OR REPLACE INTO categories SELECT * FROM s.categories")
        m.commit()
        m.execute("DETACH DATABASE s")
    m.commit()
    console.print(f"[green]master products:[/] {m.execute('SELECT COUNT(*) FROM products').fetchone()[0]:,}")
    link(m)
    counts = source_counts(m)
    report(m, counts)
    m.commit()
    m.close()


_MAX_GROUP = 25  # skip pathologically large groups (near-empty/generic keys) to stay O(n)


def _link_groups(m: sqlite3.Connection, groups: dict[str, list[tuple[str, str]]], method: str, confidence: float) -> int:
    """Insert a pairwise cross-store link for every distinct-store pair sharing a group key."""
    n = 0
    for members in groups.values():
        uniq = sorted(set(members))
        if len(uniq) < 2 or len(uniq) > _MAX_GROUP:
            continue
        for i in range(len(uniq)):
            for j in range(i + 1, len(uniq)):
                a, b = uniq[i], uniq[j]
                if a[0] == b[0]:  # same store: not a cross-store match
                    continue
                m.execute(
                    "INSERT OR IGNORE INTO product_links VALUES (?,?,?,?,?,?)",
                    (a[0], a[1], b[0], b[1], method, confidence),
                )
                n += 1
    return n


def link(m: sqlite3.Connection) -> None:
    """Cross-store product matching, tier 1 (barcode, exact) then tier 2 (normalised
    name+size, fuzzy). ALDI has no barcode, so it only ever links via tier 2."""
    barcode_groups: dict[str, list[tuple[str, str]]] = {}
    for r in m.execute("SELECT store, product_id, barcode FROM products WHERE barcode NOT IN ('', '0') AND barcode IS NOT NULL"):
        barcode_groups.setdefault(r["barcode"], []).append((r["store"], r["product_id"]))
    n_bar = _link_groups(m, barcode_groups, "barcode", 1.0)

    name_groups: dict[str, list[tuple[str, str]]] = {}
    for r in m.execute("SELECT store, product_id, name, size FROM products"):
        key = norm_name(r["name"] or "", r["size"] or "")
        if len(key) < 6:
            continue
        name_groups.setdefault(key, []).append((r["store"], r["product_id"]))
    n_name = _link_groups(m, name_groups, "name", 0.5)

    m.commit()
    console.print(f"[green]links:[/] {n_bar:,} by barcode, {n_name:,} by name+size")


def old_go_ids(store: str) -> set[str]:
    p = OLD_GO_DB.get(store)
    if not p or not p.exists():
        return set()
    conn = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
    pref = OLD_ID_PREFIX.get(store, "")
    try:
        ids = {row[0].removeprefix(pref) for row in conn.execute("SELECT productID FROM products") if row[0]}
    except sqlite3.OperationalError:
        ids = set()
    conn.close()
    return ids


def supabase_ids() -> dict[str, set[str]]:
    url, key = load_env()
    out: dict[str, set[str]] = {}
    if not (url and key):
        return out
    try:
        from supabase import create_client
        sb = create_client(url, key)
        stores = {r["id"]: r["code"] for r in sb.table("stores").select("id,code").execute().data}
        for sid, code in stores.items():
            ids: set[str] = set()
            start = 0
            while True:
                rows = sb.table("store_products").select("external_product_id").eq("store_id", sid).range(start, start + 999).execute().data
                if not rows:
                    break
                ids |= {str(r["external_product_id"]) for r in rows}
                if len(rows) < 1000:
                    break
                start += 1000
            out[code] = ids
    except Exception as e:  # noqa: BLE001
        console.print(f"[yellow]supabase read failed: {e}[/]")
    return out


def source_counts(m: sqlite3.Connection) -> dict:
    sb = supabase_ids()
    result: dict[str, dict] = {}
    for store in STORES:
        new_ids = {r[0] for r in m.execute("SELECT product_id FROM products WHERE store=?", (store,))}
        old_ids = old_go_ids(store)
        py_ids = sb.get(store, set())
        gone = (old_ids | py_ids) - new_ids
        for pid in gone:
            m.execute("UPDATE products SET deprecated=1 WHERE store=? AND product_id=?", (store, pid))
        result[store] = {
            "hyperscrape": len(new_ids),
            "old_go": len(old_ids),
            "python": (len(py_ids) if (py_ids or sb) else None),
            "overlap_new_old": len(new_ids & old_ids),
            "new_only": len(new_ids - old_ids),
            "old_only": len(old_ids - new_ids),
        }
    m.commit()
    for store, c in result.items():
        note = None if c["python"] is not None else "no .env / supabase unavailable"
        m.execute("INSERT OR REPLACE INTO source_counts VALUES (?,?,?,?)", ("python_scraper", store, c["python"], note))
        m.execute("INSERT OR REPLACE INTO source_counts VALUES (?,?,?,?)", ("old_go_scraper", store, c["old_go"], None))
        m.execute("INSERT OR REPLACE INTO source_counts VALUES (?,?,?,?)", ("hyperscrape", store, c["hyperscrape"], None))
    return result


def report(m: sqlite3.Connection, counts: dict) -> None:
    t = Table(title="unique products per source")
    t.add_column("source")
    for store in STORES:
        t.add_column(store, justify="right")
    for src, label in [("python", "python scraper (Supabase)"), ("old_go", "old go scraper (*.db)"), ("hyperscrape", "NEW hyperscrape")]:
        row = [label]
        for store in STORES:
            v = counts[store][src]
            row.append("n/a" if v is None else f"{v:,}")
        t.add_row(*row)
    t.add_section()
    for src, label in [("overlap_new_old", "overlap new∩old"), ("new_only", "new only"), ("old_only", "old only (→ deprecated)")]:
        t.add_row(label, *[f"{counts[store][src]:,}" for store in STORES])
    console.print(t)
    nb = m.execute("SELECT COUNT(*) FROM product_links WHERE method='barcode'").fetchone()[0]
    nn = m.execute("SELECT COUNT(*) FROM product_links WHERE method='name'").fetchone()[0]
    dep = m.execute("SELECT COUNT(*) FROM products WHERE deprecated=1").fetchone()[0]
    console.print(f"[bold]master.db[/] → {MASTER}")
    console.print(f"cross-store links: [green]{nb:,}[/] barcode, {nn:,} name.  deprecated: {dep:,}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--schema-from", help="store db to copy schema from (default: first existing)")
    args = ap.parse_args()
    schema = Path(args.schema_from) if args.schema_from else next((db_path(s) for s in STORES if db_path(s).exists()), None)
    if not schema:
        console.print("[red]no store db found in data/[/]")
        return 1
    build(schema)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
