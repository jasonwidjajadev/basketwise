"""Shared helpers for the hyperscrape Python tooling."""
from __future__ import annotations

import json
import os
import re
import sqlite3
from pathlib import Path
from typing import Any

import zstandard
from rich.console import Console

SCRAPER_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = SCRAPER_DIR / "data"
STORES = ("coles", "woolworths", "aldi", "harrisfarm")
STORE_DISPLAY_NAME = {"coles": "Coles", "woolworths": "Woolworths", "aldi": "ALDI", "harrisfarm": "Harris Farm Markets"}
STORE_HOSTS = {
    "coles": "https://www.coles.com.au",
    "woolworths": "https://www.woolworths.com.au",
    "aldi": "https://www.aldi.com.au",
    "harrisfarm": "https://www.harrisfarm.com.au",
}
STORE_WARMUP_PATH = {"coles": "/browse", "woolworths": "/shop/browse/fruit-veg", "aldi": "/", "harrisfarm": "/"}
# Stores with no per-product detail endpoint (everything is in the listing) — keep in
# sync with cmd/hyperscrape/main.go's noDetail map.
STORES_NO_DETAIL = {"aldi", "harrisfarm"}
# Only stores inherited from the pre-hyperscrape Go scraper have an old db / id prefix.
OLD_GO_DB = {"coles": SCRAPER_DIR / "coles.db", "woolworths": SCRAPER_DIR / "woolworths.db"}
OLD_ID_PREFIX = {"coles": "coles_id_", "woolworths": "woolworths_sku_"}
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
)

console = Console()
_dctx = zstandard.ZstdDecompressor()
_cctx = zstandard.ZstdCompressor(level=3)


def db_path(store: str, override: str | None = None) -> Path:
    return Path(override) if override else DATA_DIR / f"hyper_{store}.db"


def open_db(path: Path, readonly: bool = False) -> sqlite3.Connection:
    if readonly:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    else:
        conn = sqlite3.connect(path)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=10000")
    conn.row_factory = sqlite3.Row
    return conn


def zstd_decode(blob: bytes | None) -> str:
    if not blob:
        return ""
    return _dctx.decompress(blob, max_output_size=64 * 1024 * 1024).decode("utf-8", "replace")


def zstd_encode(text: str) -> bytes:
    return _cctx.compress(text.encode("utf-8"))


def load_json(text: str) -> Any:
    try:
        return json.loads(text) if text else None
    except json.JSONDecodeError:
        return None


_ws = re.compile(r"\s+")


def coles_slug(brand: str, name: str, size: str, pid: str) -> str:
    """Canonical Coles slug: lowercase 'brand name size', whitespace -> '-', punctuation kept."""
    base = _ws.sub("-", " ".join(x for x in (brand, name, size) if x).strip().lower()).strip("-")
    return f"{base}-{pid}" if base else f"x-{pid}"


def load_env() -> tuple[str | None, str | None]:
    from dotenv import load_dotenv

    load_dotenv(SCRAPER_DIR / ".env")
    return os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY")


def human_bytes(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if abs(n) < 1024:
            return f"{n:,.1f} {unit}"
        n /= 1024
    return f"{n:,.1f} TB"


def fmt_secs(s: float) -> str:
    s = int(s)
    if s < 60:
        return f"{s}s"
    if s < 3600:
        return f"{s // 60}m{s % 60:02d}s"
    return f"{s // 3600}h{(s % 3600) // 60:02d}m"
