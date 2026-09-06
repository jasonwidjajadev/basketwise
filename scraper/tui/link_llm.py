#!/usr/bin/env python3
"""Tier 4: LLM adjudication of ambiguous cross-retailer product matches.

Tiers 1-3 (barcode, exact name, mutual-best token scoring -- see matcher.py)
auto-link the confident cases. This handles the residual band where the scorer
found plausible candidates but could not commit: real equivalents whose names
diverge too much for token overlap alone ("Lampomodoro Pasta Sauce" vs
"Woolworths Essentials Chunky Pasta Sauce 700g").

Verdicts are written to master.db's existing `product_links` table with
method='llm', so build_api_db.py picks them up as a tier-0 seed on the next
build and the GPU pass never has to repeat itself.

  uv run tui/link_llm.py --dry-run          # show the candidate set, no LLM
  uv run tui/link_llm.py                    # adjudicate and persist
  uv run tui/link_llm.py --limit 200        # small trial run

Requires a ToastControlBox profile to be RUNNING (the gateway does not
auto-load one). Check: curl -H "Authorization: Bearer $(cat
~/.config/toastcontrolbox/gateway.token)" http://127.0.0.1:8100/v1/models
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sqlite3
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_api_db as B
import matcher as M
from common import DATA_DIR, console

MASTER = DATA_DIR / "master.db"
GATEWAY = os.getenv("TOASTBOX_URL", "http://127.0.0.1:8100/v1/chat/completions")
TOKEN_FILE = Path.home() / ".config/toastcontrolbox/gateway.token"
MODEL = os.getenv("TOASTBOX_MODEL", "fast")
BATCH = 8          # products per request -- keeps prompts inside a comfy window
MAX_CAND = 20      # candidates shown per product
CONFIDENCE = 0.72  # what an accepted LLM verdict is worth in product_links

# Strict schema: one verdict per product in the batch. `match` is the 1-based
# index into that product's candidate list, or 0 for "no equivalent".
SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["verdicts"],
    "properties": {
        "verdicts": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["item", "match"],
                "properties": {
                    "item": {"type": "integer"},
                    "match": {"type": "integer"},
                },
            },
        }
    },
}

SYSTEM = (
    "You match grocery products across Australian supermarkets. Two products match "
    "only if a shopper would accept one as a substitute for the other: same kind of "
    "product, same variant/flavour, and same pack size. Different flavour, different "
    "size, or a different product type is NOT a match. Store-brand vs national brand "
    "IS acceptable when the product and size are the same. Answer 0 when unsure."
)


class Runner:
    """Adaptive concurrency limiter (pattern from deep-research v4/extract_v4.py).

    Ramps in-flight requests up while the endpoint keeps up and backs off hard on
    latency or errors, so a local vLLM server is saturated but never stampeded.
    """

    def __init__(self, start: int = 24, ceiling: int = 72) -> None:
        self.size = start
        self.ceiling = ceiling
        self.inflight = 0
        self.lat: list[float] = []
        self.errors = 0
        self.done = 0

    async def gate(self) -> None:
        while self.inflight >= self.size:
            await asyncio.sleep(0.05)
        self.inflight += 1

    def release(self, elapsed: float, ok: bool) -> None:
        self.inflight -= 1
        self.done += 1
        self.lat.append(elapsed)
        if not ok:
            self.errors += 1
        if self.done % 25 == 0:
            window = self.lat[-50:]
            p95 = sorted(window)[int(len(window) * 0.95) - 1] if window else 0
            rate = self.errors / max(self.done, 1)
            if p95 < 120 and rate < 0.03:
                self.size = min(self.ceiling, self.size + 6)
            else:
                self.size = max(8, int(self.size * 0.75))


def build_candidates(limit: int | None) -> tuple[list, dict]:
    """Deterministic candidate generation -- no LLM, runs in seconds."""
    src = sqlite3.connect(f"file:{MASTER}?mode=ro", uri=True)
    src.row_factory = sqlite3.Row
    rows = B.load_rows(src)
    B.enrich(rows)
    by: dict[str, list] = {}
    for r in rows:
        by.setdefault(r["store"], []).append(r)
    index = {(r["store"], r["product_id"]): r for r in rows}

    tasks = []
    names = sorted(by)
    for i, sa in enumerate(names):
        for sb in names[i + 1:]:
            # Anything tiers 1-3 already settled must not be re-litigated.
            settled = {a for a, _b, _s in M.mutual_pairs(by[sa], by[sb])}
            band = M.ambiguous(by[sa], by[sb], top=MAX_CAND)
            for a_id, cands in band.items():
                if a_id in settled:
                    continue
                tasks.append((sa, a_id, sb, [c for _s, c in cands]))
    tasks.sort(key=lambda t: (t[0], t[2], t[1]))
    if limit:
        tasks = tasks[:limit]
    return tasks, index


def render(batch: list, index: dict) -> str:
    def desc(store: str, pid: str) -> str:
        r = index[(store, pid)]
        size = (r.get("size") or "").strip()
        brand = (r.get("brand") or "").strip()
        price = (r.get("price_cents") or 0) / 100
        bits = [r["name"]]
        if brand:
            bits.append(f"brand={brand}")
        if size:
            bits.append(f"size={size}")
        bits.append(f"${price:.2f}")
        return " | ".join(bits)

    out = []
    for n, (sa, a_id, sb, cands) in enumerate(batch, 1):
        out.append(f"ITEM {n} ({sa}): {desc(sa, a_id)}")
        for k, c in enumerate(cands, 1):
            out.append(f"   {k}. ({sb}) {desc(sb, c)}")
        out.append("")
    out.append(
        f"For each of the {len(batch)} items return the candidate number that is the "
        "same product, or 0 if none is."
    )
    return "\n".join(out)


async def adjudicate(client, runner: Runner, batch: list, index: dict) -> list:
    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": render(batch, index)},
        ],
        "max_tokens": 900,
        "temperature": 0,
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "verdicts", "strict": True, "schema": SCHEMA},
        },
    }
    await runner.gate()
    t0 = time.time()
    accepted = []
    try:
        for attempt in range(3):
            resp = await client.post(GATEWAY, json=body)
            if resp.status_code == 503:  # profile still warming
                await asyncio.sleep(3 * (attempt + 1))
                continue
            resp.raise_for_status()
            data = json.loads(resp.json()["choices"][0]["message"]["content"])
            for v in data.get("verdicts", []):
                i, m = int(v["item"]) - 1, int(v["match"])
                if not (0 <= i < len(batch)) or m <= 0:
                    continue
                sa, a_id, sb, cands = batch[i]
                if m <= len(cands):
                    accepted.append((sa, a_id, sb, cands[m - 1]))
            runner.release(time.time() - t0, True)
            return accepted
        runner.release(time.time() - t0, False)
    except Exception as exc:  # noqa: BLE001 -- one bad batch must not kill the run
        console.print(f"[yellow]batch failed: {exc}[/]")
        runner.release(time.time() - t0, False)
    return accepted


async def main_async(args) -> int:
    import httpx

    tasks, index = build_candidates(args.limit)
    console.print(f"ambiguous products needing adjudication: [cyan]{len(tasks):,}[/]")
    if args.dry_run:
        for t in tasks[:3]:
            console.print(render([t], index))
        console.print("[yellow]--dry-run: no LLM called, nothing written[/]")
        return 0
    if not tasks:
        return 0

    batches = [tasks[i:i + BATCH] for i in range(0, len(tasks), BATCH)]
    console.print(f"dispatching [cyan]{len(batches):,}[/] batches -> {GATEWAY} model={MODEL}")
    token = TOKEN_FILE.read_text().strip()
    runner = Runner()
    t0 = time.time()
    async with httpx.AsyncClient(
        timeout=300,
        headers={
            "Authorization": f"Bearer {token}",
            "X-ToastBox-Priority": "low",
        },
        limits=httpx.Limits(max_connections=100),
    ) as client:
        results = await asyncio.gather(
            *(adjudicate(client, runner, b, index) for b in batches)
        )
    links = [p for r in results for p in r]
    console.print(
        f"accepted [green]{len(links):,}[/] new links from {len(tasks):,} candidates "
        f"in {time.time() - t0:.0f}s (errors={runner.errors})"
    )

    db = sqlite3.connect(MASTER)
    db.executemany(
        "INSERT OR REPLACE INTO product_links "
        "(store_a, id_a, store_b, id_b, method, confidence) VALUES (?,?,?,?,'llm',?)",
        [(sa, a, sb, b, CONFIDENCE) for sa, a, sb, b in links],
    )
    db.commit()
    db.close()
    console.print(f"wrote to {MASTER} product_links -- now run tui/build_api_db.py")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="show candidates, call no LLM")
    ap.add_argument("--limit", type=int, help="cap the number of products adjudicated")
    return asyncio.run(main_async(ap.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
