#!/usr/bin/env python3
"""Preview a hyperscrape SQLite database before uploading to Supabase.

  uv run tui/preview.py --store coles
  uv run tui/preview.py --store woolworths --id 759044
"""
from __future__ import annotations

import argparse
import json
import sqlite3

from rich.table import Table

from common import STORES, console, db_path, load_json, open_db, zstd_decode

FILL_COLS = [
    "name", "brand", "size", "price_cents", "was_price_cents", "unit_price_str", "barcode",
    "image_urls", "ingredients", "allergens", "dietary", "nutrition", "country_of_origin",
    "rating_avg", "health_star", "retail_limit", "promo_limit", "detail_json",
]
NUMERIC = {"price_cents", "was_price_cents", "rating_avg", "health_star", "retail_limit", "promo_limit"}


def one(conn: sqlite3.Connection, sql: str, *args) -> int:
    r = conn.execute(sql, args).fetchone()
    return r[0] if r and r[0] is not None else 0


def summary(conn: sqlite3.Connection) -> None:
    total = one(conn, "SELECT COUNT(*) FROM products")
    console.rule(f"[bold]{total:,} products")
    t = Table(title="counts")
    t.add_column("metric")
    t.add_column("value", justify="right")
    t.add_row("products", f"{total:,}")
    t.add_row("with detail", f"{one(conn, 'SELECT COUNT(detail_fetched_at) FROM products'):,}")
    t.add_row("with nutrition", f"{one(conn, 'SELECT COUNT(*) FROM products WHERE nutrition IS NOT NULL'):,}")
    t.add_row("with ingredients", f"{one(conn, 'SELECT COUNT(*) FROM products WHERE ingredients IS NOT NULL'):,}")
    t.add_row("with barcode", f"{one(conn, 'SELECT COUNT(*) FROM products WHERE barcode IS NOT NULL'):,}")
    t.add_row("with rating", f"{one(conn, 'SELECT COUNT(*) FROM products WHERE rating_count>0'):,}")
    t.add_row("on special (was>now)", f"{one(conn, 'SELECT COUNT(*) FROM products WHERE was_price_cents>price_cents'):,}")
    t.add_row("deprecated", f"{one(conn, 'SELECT COUNT(*) FROM products WHERE deprecated=1'):,}")
    t.add_row("price_history rows", f"{one(conn, 'SELECT COUNT(*) FROM price_history'):,}")
    t.add_row("categories done/total", f"{one(conn, 'SELECT SUM(done) FROM categories'):,} / {one(conn, 'SELECT COUNT(*) FROM categories'):,}")
    console.print(t)

    if total:
        ft = Table(title="field fill-rate")
        ft.add_column("column")
        ft.add_column("filled", justify="right")
        ft.add_column("%", justify="right")
        for col in FILL_COLS:
            if col in NUMERIC:
                n = one(conn, f"SELECT COUNT(*) FROM products WHERE {col} IS NOT NULL AND {col}>0")
            else:
                n = one(conn, f"SELECT COUNT(*) FROM products WHERE {col} IS NOT NULL AND {col}!=''")
            ft.add_row(col, f"{n:,}", f"{100 * n / total:.0f}%")
        console.print(ft)

    bt = Table(title="top 15 brands")
    bt.add_column("brand")
    bt.add_column("n", justify="right")
    for row in conn.execute("SELECT COALESCE(NULLIF(brand,''),'(none)') b, COUNT(*) n FROM products GROUP BY b ORDER BY n DESC LIMIT 15"):
        bt.add_row(row["b"], f"{row['n']:,}")
    console.print(bt)

    dt = Table(title="departments")
    dt.add_column("dept")
    dt.add_column("n", justify="right")
    for row in conn.execute("SELECT COALESCE(NULLIF(dept,''),'(none)') d, COUNT(*) n FROM products GROUP BY d ORDER BY n DESC LIMIT 20"):
        dt.add_row(row["d"], f"{row['n']:,}")
    console.print(dt)

    st = Table(title="5 random samples")
    for c in ("product_id", "name", "brand", "size", "price", "was", "unit_price", "detail?"):
        st.add_column(c)
    for row in conn.execute("SELECT * FROM products ORDER BY RANDOM() LIMIT 5"):
        st.add_row(row["product_id"], (row["name"] or "")[:40], (row["brand"] or "")[:16], row["size"] or "",
                   f"${(row['price_cents'] or 0) / 100:.2f}", f"${(row['was_price_cents'] or 0) / 100:.2f}",
                   row["unit_price_str"] or "", "yes" if row["detail_fetched_at"] else "no")
    console.print(st)


def show_product(conn: sqlite3.Connection, pid: str) -> None:
    row = conn.execute("SELECT * FROM products WHERE product_id=?", (pid,)).fetchone()
    if not row:
        console.print(f"[red]no product {pid}[/]")
        return
    d = dict(row)
    for k in ("listing_json", "detail_json"):
        d.pop(k, None)
    console.rule(f"[bold]{pid} — {row['name']}")
    console.print_json(json.dumps({k: v for k, v in d.items() if v not in (None, "", 0)}, default=str))
    if row["nutrition"]:
        console.print("[bold]nutrition:[/]")
        console.print_json(row["nutrition"])
    if row["detail_json"]:
        dj = load_json(zstd_decode(row["detail_json"]))
        if isinstance(dj, dict):
            console.print(f"[dim]detail_json top-level keys: {list(dj.keys())}[/]")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--store", choices=list(STORES), required=True)
    ap.add_argument("--db")
    ap.add_argument("--id", help="show one product in full")
    args = ap.parse_args()
    path = db_path(args.store, args.db)
    if not path.exists():
        console.print(f"[red]not found: {path}[/]")
        return 1
    conn = open_db(path, readonly=True)
    if args.id:
        show_product(conn, args.id)
    else:
        summary(conn)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
