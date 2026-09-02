"""Read-only SQLite access + the warm-response cache.

The database is opened immutable: the API process cannot write to it even if
compromised. All writes happen on the build machine (scraper/tui/build_api_db.py).
"""
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

# Defaults suit a local checkout; the container overrides both.
DB_PATH = Path(os.getenv("BASKETWISE_DB", Path(__file__).resolve().parents[1] / "scraper" / "data" / "basketwise.db"))
WARM_DIR = Path(os.getenv("BASKETWISE_WARM", Path(__file__).resolve().parents[1] / "scraper" / "data" / "warm"))

# Cap the page cache so RSS stays flat regardless of catalogue size. The OS page
# cache does the real caching and is evictable; this is just SQLite's own buffer.
CACHE_KB = int(os.getenv("BASKETWISE_CACHE_KB", "32000"))

_conn: sqlite3.Connection | None = None
_warm: dict[str, bytes] = {}
_warm_counts: dict[str, int] = {}
_meta: dict[str, str] = {}


def connect() -> sqlite3.Connection:
    # immutable=1 promises the file never changes under us, which lets SQLite skip
    # all locking and WAL checks. Safe because deploys swap the file and restart.
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro&immutable=1", uri=True, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute(f"PRAGMA cache_size=-{CACHE_KB}")
    conn.execute("PRAGMA temp_store=MEMORY")
    conn.execute("PRAGMA mmap_size=268435456")
    return conn


def startup() -> None:
    global _conn
    if not DB_PATH.exists():
        raise RuntimeError(
            f"database not found at {DB_PATH}\n"
            "Build it on the build machine with:  uv run tui/build_api_db.py")
    _conn = connect()
    _meta.clear()
    for r in _conn.execute("SELECT key, value FROM meta"):
        _meta[r["key"]] = r["value"]
    _warm.clear()
    _warm_counts.clear()
    if WARM_DIR.is_dir():
        for f in WARM_DIR.glob("*.json"):
            _warm[f.stem] = f.read_bytes()
    # Totals for the pre-rendered pages, so a warm hit can still send X-Total-Count.
    if (counts := _warm.pop("_counts", None)) is not None:
        _warm_counts.update(json.loads(counts))


def shutdown() -> None:
    global _conn
    if _conn is not None:
        _conn.close()
        _conn = None


def db() -> sqlite3.Connection:
    if _conn is None:
        raise RuntimeError("database not initialised")
    return _conn


def warm(key: str) -> bytes | None:
    """Pre-serialized response bytes, or None if this request isn't a hot path."""
    return _warm.get(key)


def warm_count(key: str) -> int | None:
    """Total matches for a pre-rendered page, for the X-Total-Count header."""
    return _warm_counts.get(key)


def meta(key: str, default: str | None = None) -> str | None:
    return _meta.get(key, default)


def build_id() -> str:
    return _meta.get("build_id", "dev")


def retailers() -> list[str]:
    raw = _meta.get("retailers")
    return json.loads(raw) if raw else []
