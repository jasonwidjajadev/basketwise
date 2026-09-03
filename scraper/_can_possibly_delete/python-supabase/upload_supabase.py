#!/usr/bin/env python3
"""Upload a hyperscrape store DB to Supabase.

Writes the same tables/columns the existing import_products.py uses
(store_products upsert on store_id+external_product_id, price_history insert),
and the richer per-product fields to a new product_details table
(migration: supabase/001_product_details.sql). Never runs automatically — preview
first, then run this explicitly (or press 'u' in the TUI).

  uv run tui/upload_supabase.py --store coles
  uv run tui/upload_supabase.py --store woolworths --dry-run
"""
from __future__ import annotations

import argparse
import json
import sys
import time

from common import STORE_DISPLAY_NAME, STORES, console, db_path, load_env, load_json, open_db

BATCH = 500


def retry(fn, tries: int = 5):
    for i in range(tries):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            wait = 2 ** i
            console.print(f"[yellow]retry in {wait}s: {e}[/]")
            time.sleep(wait)


def ensure_stores(sb) -> dict[str, int]:
    want = STORE_DISPLAY_NAME
    have = {r["code"]: r["id"] for r in sb.table("stores").select("id,code").execute().data}
    for code, name in want.items():
        if code not in have:
            sb.table("stores").insert({"code": code, "name": name}).execute()
    return {r["code"]: r["id"] for r in sb.table("stores").select("id,code").execute().data}


def first_image(image_urls: str | None) -> str | None:
    arr = load_json(image_urls) if image_urls else None
    return arr[0] if isinstance(arr, list) and arr else None


def upload(store: str, db: str | None, dry: bool) -> int:
    url, key = load_env()
    if not (url and key):
        console.print("[red]SUPABASE_URL / SUPABASE_KEY missing[/] — add scraper/.env (see database.py)")
        return 1
    path = db_path(store, db)
    if not path.exists():
        console.print(f"[red]not found: {path}[/]")
        return 1
    from supabase import create_client
    sb = create_client(url, key)
    store_id = ensure_stores(sb)[store]
    conn = open_db(path, readonly=True)
    rows = conn.execute("SELECT * FROM products WHERE deprecated=0").fetchall()
    console.print(f"[cyan]{len(rows):,} products → store_products (store_id={store_id})[/]")

    from rich.progress import Progress
    sp_rows = [{
        "store_id": store_id,
        "external_product_id": r["product_id"],
        "name": r["name"],
        "brand": r["brand"],
        "description": r["description"],
        "image_url": first_image(r["image_urls"]),
        "package_size": r["size"],
        "source_category": r["category_path"],
        "is_weighted": bool(r["is_weighted"]),
        "quantity": None,
        "unit": r["unit_measure"],
    } for r in rows]

    if dry:
        console.print("[yellow]dry run — sample store_products row:[/]")
        console.print_json(json.dumps(sp_rows[0], default=str))
    else:
        with Progress() as prog:
            task = prog.add_task("store_products", total=len(sp_rows))
            for i in range(0, len(sp_rows), BATCH):
                chunk = sp_rows[i:i + BATCH]
                retry(lambda c=chunk: sb.table("store_products").upsert(c, on_conflict="store_id,external_product_id").execute())
                prog.update(task, advance=len(chunk))

    # map external id -> store_product id for price_history + details
    idmap: dict[str, int] = {}
    start = 0
    while True:
        page = sb.table("store_products").select("id,external_product_id").eq("store_id", store_id).range(start, start + 999).execute().data
        if not page:
            break
        idmap.update({str(r["external_product_id"]): r["id"] for r in page})
        if len(page) < 1000:
            break
        start += 1000

    ph = [{"store_product_id": idmap[r["product_id"]], "price": (r["price_cents"] or 0) / 100}
          for r in rows if r["product_id"] in idmap and r["price_cents"]]
    console.print(f"[cyan]{len(ph):,} price_history rows[/]")
    if not dry:
        with Progress() as prog:
            task = prog.add_task("price_history", total=len(ph))
            for i in range(0, len(ph), BATCH):
                chunk = ph[i:i + BATCH]
                retry(lambda c=chunk: sb.table("price_history").insert(c).execute())
                prog.update(task, advance=len(chunk))

    details = []
    for r in rows:
        spid = idmap.get(r["product_id"])
        if not spid:
            continue
        details.append({
            "store_product_id": spid,
            "barcode": r["barcode"],
            "was_price": (r["was_price_cents"] or 0) / 100 or None,
            "save_amount": (r["save_cents"] or 0) / 100 or None,
            "unit_price": (r["unit_price_cents"] or 0) / 100 or None,
            "unit_measure": r["unit_measure"],
            "unit_price_str": r["unit_price_str"],
            "retail_limit": r["retail_limit"] or None,
            "promo_limit": r["promo_limit"] or None,
            "in_stock": bool(r["in_stock"]),
            "ingredients": r["ingredients"],
            "allergens": r["allergens"],
            "allergens_may": r["allergens_may"],
            "dietary": r["dietary"],
            "nutrition": load_json(r["nutrition"]) if r["nutrition"] else None,
            "images": load_json(r["image_urls"]) if r["image_urls"] else None,
            "country_of_origin": r["country_of_origin"],
            "health_star": r["health_star"] or None,
            "rating_avg": r["rating_avg"] or None,
            "rating_count": r["rating_count"] or None,
            "long_description": r["long_description"],
            "url": (r["url"] and __import__("common").STORE_HOSTS[store] + r["url"]) or None,
            "deprecated": bool(r["deprecated"]),
        })
    console.print(f"[cyan]{len(details):,} product_details rows[/]")
    if not dry:
        try:
            with Progress() as prog:
                task = prog.add_task("product_details", total=len(details))
                for i in range(0, len(details), BATCH):
                    chunk = details[i:i + BATCH]
                    retry(lambda c=chunk: sb.table("product_details").upsert(c, on_conflict="store_product_id").execute())
                    prog.update(task, advance=len(chunk))
        except Exception as e:  # noqa: BLE001
            console.print(f"[yellow]product_details skipped: {e}[/]")
            console.print("[yellow]create the table first: run supabase/001_product_details.sql in the Supabase SQL editor[/]")

    console.print(f"[green]done: {store}[/]")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--store", choices=list(STORES), required=True)
    ap.add_argument("--db")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    return upload(args.store, args.db, args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
