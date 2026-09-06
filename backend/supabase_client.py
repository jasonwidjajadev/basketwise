"""Read-only Supabase (PostgREST) access for multi-day price history.

The immutable SQLite artifact only ever holds the crawl it was built from. The
Supabase project accumulates every upload, so it is the only source with a real
series. Credentials come from the environment; without them every call returns
empty and the caller degrades to local-only data.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request

URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
KEY = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY") or ""
TIMEOUT = float(os.getenv("SUPABASE_TIMEOUT", "8"))


def enabled() -> bool:
    return bool(URL and KEY)


def get(path: str) -> list[dict]:
    """GET one PostgREST path. Returns [] on any failure -- never raises.

    A price chart is decoration: if Supabase is slow or down the product page must
    still render, so every error collapses to "no history".
    """
    if not enabled():
        return []
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            body = json.load(r)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return []
    return body if isinstance(body, list) else []


def in_list(values) -> str:
    """PostgREST in.(...) needs each member quoted; ids are uuids and vendor skus."""
    return "(" + ",".join('"' + str(v).replace('"', '') + '"' for v in values) + ")"


def stores() -> dict[str, str]:
    """retailer code -> store uuid. Cached after the first call."""
    global _stores
    if _stores is None:
        _stores = {s["code"]: s["id"] for s in get("stores?select=id,code") if s.get("code")}
    return _stores


_stores: dict[str, str] | None = None
