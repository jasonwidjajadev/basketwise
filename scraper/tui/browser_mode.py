#!/usr/bin/env python3
"""Tier-3 fallback: fetch product detail JSON from inside a real browser page.

When even a warmed cookie jar gets blocked, this drives a Playwright page on the
store and uses page.evaluate(fetch(...)) so the requests inherit the browser's live
anti-bot context. It fills detail_json (zstd-compressed raw text) + detail_fetched_at
for every product still missing detail, at a gentle self-adjusting rate. The parsed
columns are left for a later `hyperscrape -phase detail` pass (which reads nothing
here; it re-fetches) — the raw text is preserved so nothing is lost.

  uv run tui/browser_mode.py --store woolworths --db data/hyper_woolworths.db
"""
from __future__ import annotations

import argparse
import sys
import time

from common import STORE_HOSTS, STORE_WARMUP_PATH, USER_AGENT, coles_slug, console, db_path, open_db, zstd_encode

BLOCK = {"image", "media", "font"}


def detail_url(store: str, row, build_id: str) -> str:
    if store == "woolworths":
        return f"/apis/ui/product/detail/{row['product_id']}?isMobile=false&useVariant=true"
    url = row["url"] or ("/product/" + coles_slug(row["brand"] or "", row["name"] or "", row["size"] or "", row["product_id"]))
    slug = url.rsplit("/product/", 1)[-1]
    return f"/_next/data/{build_id}/en/product/{slug}.json?slug={slug}"


def run(store: str, db: str, rate: float, limit: int) -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        console.print("[red]playwright not installed[/] — run: uv run playwright install chromium")
        return 3
    conn = open_db(db_path(store, db))
    rows = conn.execute("SELECT product_id,name,brand,size,url FROM products WHERE detail_fetched_at IS NULL AND deprecated=0" + (f" LIMIT {limit}" if limit else "")).fetchall()
    if not rows:
        console.print("[green]nothing to fetch[/]")
        return 0
    console.print(f"[cyan]browser mode: {len(rows):,} products[/]")
    host = STORE_HOSTS[store]
    ok = err = 0
    delay = 1.0 / max(rate, 0.1)
    with sync_playwright() as pw:
        try:
            browser = pw.chromium.launch(headless=True)
        except Exception as e:  # noqa: BLE001
            console.print(f"[red]chromium launch failed:[/] {e}")
            return 3
        ctx = browser.new_context(user_agent=USER_AGENT, locale="en-AU")
        page = ctx.new_page()
        page.route("**/*", lambda r: r.abort() if r.request.resource_type in BLOCK else r.continue_())
        page.goto(host + STORE_WARMUP_PATH[store], wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(4000)
        build_id = ""
        if store == "coles":
            try:
                build_id = page.evaluate("() => window.__NEXT_DATA__ && window.__NEXT_DATA__.buildId") or ""
            except Exception:  # noqa: BLE001
                pass
        from rich.progress import Progress
        with Progress() as prog:
            task = prog.add_task("fetching", total=len(rows))
            batch = []
            for row in rows:
                url = host + detail_url(store, row, build_id)
                try:
                    text = page.evaluate(
                        "async (u) => { const r = await fetch(u, {headers:{'Accept':'application/json'}}); return r.status===200 ? await r.text() : ('ERR'+r.status); }",
                        url,
                    )
                except Exception:  # noqa: BLE001
                    text = "ERRnet"
                if text and not text.startswith("ERR") and "Pardon Our Interruption" not in text:
                    batch.append((zstd_encode(text), row["product_id"]))
                    ok += 1
                    if ok % 10 == 0:
                        delay = max(delay / 2, 1.0 / 50)  # speed up while clean
                else:
                    err += 1
                    delay = min(delay * 2, 5.0)
                    time.sleep(5)
                if len(batch) >= 50:
                    conn.executemany("UPDATE products SET detail_json=?, detail_fetched_at=datetime('now') WHERE product_id=?", batch)
                    conn.commit()
                    batch.clear()
                prog.update(task, advance=1, description=f"ok={ok} err={err} delay={delay:.2f}s")
                time.sleep(delay)
            if batch:
                conn.executemany("UPDATE products SET detail_json=?, detail_fetched_at=datetime('now') WHERE product_id=?", batch)
                conn.commit()
        browser.close()
    console.print(f"[green]done[/] ok={ok:,} err={err:,}")
    console.print("[dim]re-parse raw detail_json into columns with: ./hyperscrape -store {0} -phase detail[/]".format(store))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--store", choices=["coles", "woolworths"], required=True)
    ap.add_argument("--db")
    ap.add_argument("--rate", type=float, default=2.0)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    return run(args.store, args.db, args.rate, args.limit)


if __name__ == "__main__":
    sys.exit(main())
