#!/usr/bin/env python3
"""Harvest a warm cookie jar from a store using a headless browser (tier-2 fallback).

Used automatically by the TUI when the Go crawler reports it is blocked by anti-bot
(Coles Imperva "Pardon Our Interruption" / Woolworths Akamai 403). Blocks images,
media and fonts so it stays lightweight, waits for the anti-bot JS to mint cookies,
then writes Playwright-style cookies JSON that the Go binary imports with -cookies.

  uv run tui/harvest_cookies.py --store coles --out data/cookies_coles.json
"""
from __future__ import annotations

import argparse
import json
import sys

from common import STORE_HOSTS, STORE_WARMUP_PATH, USER_AGENT, console

BLOCK = {"image", "media", "font"}


def harvest(store: str, out: str, headed: bool) -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        console.print("[red]playwright not installed[/] — run: uv run playwright install chromium")
        return 3
    url = STORE_HOSTS[store] + STORE_WARMUP_PATH[store]
    with sync_playwright() as pw:
        try:
            browser = pw.chromium.launch(headless=not headed)
        except Exception as e:  # noqa: BLE001
            console.print(f"[red]chromium launch failed:[/] {e}\nrun: uv run playwright install chromium")
            return 3
        ctx = browser.new_context(user_agent=USER_AGENT, viewport={"width": 1440, "height": 900}, locale="en-AU")
        page = ctx.new_page()
        page.route("**/*", lambda route: route.abort() if route.request.resource_type in BLOCK else route.continue_())
        console.print(f"[cyan]loading {url}[/]")
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
        # give the anti-bot script time to solve and set cookies
        for _ in range(30):
            page.wait_for_timeout(1000)
            body = ""
            try:
                body = page.content()
            except Exception:  # noqa: BLE001
                pass
            if "Pardon Our Interruption" in body or "Just a moment" in body:
                continue
            names = {c["name"] for c in ctx.cookies()}
            ready = ("reese84" in names or "visid_incap" in " ".join(names)) if store == "coles" else ("_abck" in names and "bm_sz" in names)
            if ready:
                break
        cookies = ctx.cookies()
        browser.close()
    with open(out, "w") as f:
        json.dump(cookies, f)
    console.print(f"[green]wrote {len(cookies)} cookies[/] → {out}")
    console.print("names: " + ", ".join(sorted(c["name"] for c in cookies)))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--store", choices=["coles", "woolworths"], required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--headed", action="store_true")
    args = ap.parse_args()
    return harvest(args.store, args.out, args.headed)


if __name__ == "__main__":
    sys.exit(main())
