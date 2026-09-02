#!/usr/bin/env python3
"""hyperscrape TUI + orchestrator.

Spawns (or attaches to) one Go crawler per store and renders live stats:
bandwidth, products/s, unique vs duplicate counts, AIMD controller state.

  uv run tui/hyperscrape.py --stores coles,woolworths --phase all
  uv run tui/hyperscrape.py --attach            # tail data/<store>.ndjson of already-running crawlers

Keys: q = graceful stop (SIGINT to crawlers), u = upload to Supabase when finished.
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import select
import signal
import subprocess
import sys
import termios
import threading
import time
import tty
from dataclasses import dataclass, field
from pathlib import Path

from rich.console import Group
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from common import DATA_DIR, OLD_GO_DB, SCRAPER_DIR, STORES, console, fmt_secs, human_bytes

SPARK = "▁▂▃▄▅▆▇█"


def sparkline(values: list[float], width: int = 50) -> str:
    vals = list(values)[-width:]
    if not vals:
        return ""
    hi = max(vals) or 1.0
    return "".join(SPARK[min(7, int(v / hi * 7.999))] for v in vals)


@dataclass
class StoreState:
    name: str
    stats: dict = field(default_factory=dict)
    events: collections.deque = field(default_factory=lambda: collections.deque(maxlen=6))
    history: collections.deque = field(default_factory=lambda: collections.deque(maxlen=240))
    proc: subprocess.Popen | None = None
    exit_code: int | None = None
    tier: int = 1
    status: str = "starting"
    last_line_at: float = field(default_factory=time.time)

    def ingest(self, line: str) -> None:
        line = line.strip()
        if not line.startswith("{"):
            return
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            return
        self.last_line_at = time.time()
        if obj.get("t") == "stats":
            self.stats = obj
            self.history.append(float(obj.get("rate_actual", 0.0)))
        elif obj.get("t") == "event":
            self.events.append(f"{time.strftime('%H:%M:%S')} {obj.get('event')}: {obj.get('msg', '')}")
            if obj.get("event") == "blocked":
                self.status = "BLOCKED"
            elif obj.get("event") == "done":
                self.status = "done"


class Orchestrator:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.stores = {s: StoreState(s) for s in args.stores}
        self.threads: list[threading.Thread] = []
        self.stop = threading.Event()
        self.upload_requested = False
        self.messages: collections.deque = collections.deque(maxlen=5)
        self.t0 = time.time()

    # ---------- process management ----------
    def cmd_for(self, store: str, cookies: Path | None = None) -> list[str]:
        a = self.args
        cmd = [
            a.bin, "-store", store, "-db", str(DATA_DIR / f"hyper_{store}.db"), "-phase", a.phase,
            "-start-rate", str(a.start_rate), "-max-rate", str(a.max_rate), "-pause", f"{a.pause}s",
            "-workers", str(a.workers), "-max-inflight", str(a.max_inflight),
        ]
        old_db = OLD_GO_DB.get(store)
        if a.seed and old_db and old_db.exists():
            cmd += ["-seed-db", str(old_db)]
        if cookies:
            cmd += ["-cookies", str(cookies)]
        if a.extra:
            cmd += a.extra.split()
        return cmd

    def spawn(self, store: str, cookies: Path | None = None) -> None:
        st = self.stores[store]
        log = open(DATA_DIR / f"{store}.log", "ab")
        ndjson = open(DATA_DIR / f"{store}.ndjson", "wb")
        st.proc = subprocess.Popen(self.cmd_for(store, cookies), stdout=subprocess.PIPE, stderr=log, cwd=SCRAPER_DIR)
        st.status = "running"
        st.exit_code = None

        def reader() -> None:
            assert st.proc and st.proc.stdout
            for raw in st.proc.stdout:
                ndjson.write(raw)
                st.ingest(raw.decode("utf-8", "replace"))
            st.exit_code = st.proc.wait()
            ndjson.close()
            self.on_exit(store)

        t = threading.Thread(target=reader, daemon=True)
        t.start()
        self.threads.append(t)

    def attach(self, store: str) -> None:
        st = self.stores[store]
        path = DATA_DIR / f"{store}.ndjson"
        st.status = "attached"

        def tailer() -> None:
            pos = 0
            while not self.stop.is_set():
                try:
                    with open(path, "rb") as f:
                        f.seek(0)
                        lines = f.read().splitlines()
                    if len(lines) > pos:
                        for raw in lines[pos:]:
                            st.ingest(raw.decode("utf-8", "replace"))
                        pos = len(lines)
                except FileNotFoundError:
                    pass
                time.sleep(0.25)

        t = threading.Thread(target=tailer, daemon=True)
        t.start()
        self.threads.append(t)

    def on_exit(self, store: str) -> None:
        st = self.stores[store]
        code = st.exit_code
        if self.stop.is_set():
            st.status = f"stopped ({code})"
            return
        if code == 0:
            st.status = "done"
            return
        if code == 2 and st.tier == 1:
            self.messages.append(f"{store}: blocked -> harvesting cookies with headless browser (tier 2)")
            st.tier = 2
            cookies = DATA_DIR / f"cookies_{store}.json"
            r = subprocess.run([sys.executable, str(SCRAPER_DIR / "tui" / "harvest_cookies.py"), "--store", store, "--out", str(cookies)], cwd=SCRAPER_DIR)
            if r.returncode == 0:
                time.sleep(3)
                self.spawn(store, cookies)
                return
            self.messages.append(f"{store}: cookie harvest failed ({r.returncode})")
        if code == 2 and st.tier >= 2:
            self.messages.append(f"{store}: still blocked -> browser mode for remaining details (tier 3)")
            st.tier = 3
            st.status = "browser-mode"
            r = subprocess.run([sys.executable, str(SCRAPER_DIR / "tui" / "browser_mode.py"), "--store", store, "--db", str(DATA_DIR / f"hyper_{store}.db")], cwd=SCRAPER_DIR)
            st.status = "done (browser)" if r.returncode == 0 else f"browser-mode failed ({r.returncode})"
            return
        st.status = f"exited ({code})"

    def all_finished(self) -> bool:
        return all(s.proc is None or s.exit_code is not None for s in self.stores.values()) and not self.args.attach

    # ---------- rendering ----------
    def render_store(self, st: StoreState) -> Panel:
        d = st.stats
        g = lambda k, default=0: d.get(k, default)  # noqa: E731
        t = Table.grid(padding=(0, 2))
        t.add_column(style="bold cyan", justify="right")
        t.add_column()
        t.add_column(style="bold cyan", justify="right")
        t.add_column()
        ctrl = g("ctrl", "-")
        ctrl_txt = Text(ctrl, style={"paused": "bold red", "slowstart": "yellow", "probe": "green"}.get(ctrl, ""))
        if g("pause_remaining_s"):
            ctrl_txt.append(f" ({g('pause_remaining_s'):.1f}s)", style="red")
        t.add_row("phase", f"{g('phase', '-')}", "ctrl", ctrl_txt)
        t.add_row("rate target", f"{g('rate_target'):.1f} req/s", "rate actual", f"[bold]{g('rate_actual'):.1f}[/] req/s")
        t.add_row("inflight", str(g("inflight")), "p50 latency", f"{g('p50_ms'):.0f} ms")
        t.add_row("best clean", f"{g('best_rate'):.1f} req/s", "backoffs", str(g("backoffs")))
        mbit = g("bytes_wire_s") * 8 / 1e6
        t.add_row("bandwidth", f"[bold]{mbit:.2f} Mbit/s[/] wire", "decompressed", f"{human_bytes(g('bytes_raw_s'))}/s")
        t.add_row("downloaded", human_bytes(g("bytes_wire")), "raw", human_bytes(g("bytes_raw")))
        t.add_row("pages", f"{g('pages'):,}  ({g('pages_s'):.1f}/s)", "requests", f"{g('requests'):,}")
        t.add_row("products/s", f"[bold]{g('products_s'):.0f}[/]", "products seen", f"{g('products'):,}")
        t.add_row("unique", f"[bold green]{g('unique'):,}[/]", "duplicates", f"[yellow]{g('dupes'):,}[/]")
        t.add_row("unchanged", f"{g('unchanged'):,}", "details", f"{g('details'):,}  ({g('details_s'):.1f}/s)")
        errs = ", ".join(f"{k}:{v}" for k, v in sorted(g("errors_by_code", {}).items())) or "-"
        t.add_row("errors", f"[red]{g('errors')}[/]  {errs}", "challenges", str(g("challenges")))
        t.add_row("queue list", f"{g('queue_list'):,}", "queue detail", f"{g('queue_detail'):,}")
        eta = g("eta_s")
        t.add_row("ETA", fmt_secs(eta) if eta else "-", "elapsed", fmt_secs(g("elapsed_s")))
        spark = Text(sparkline(list(st.history)), style="cyan")
        ev = Text("\n".join(st.events) or "…", style="dim")
        last = g("last_error", "")
        stale = time.time() - st.last_line_at > 3 and st.status in ("running", "attached")
        title = f"[bold]{st.name.upper()}[/]  [{ 'red' if 'BLOCK' in st.status or 'exit' in st.status else 'green'}]{st.status}[/]"
        if st.tier > 1:
            title += f"  tier {st.tier}"
        if stale:
            title += "  [red](no stats for >3s)[/]"
        body = Group(t, Text("req/s (60s)", style="dim"), spark, Text(f"last error: {last}" if last else "", style="red"), ev)
        return Panel(body, title=title, border_style="cyan" if st.status in ("running", "attached") else "white")

    def render(self) -> Layout:
        layout = Layout()
        panels = [self.render_store(s) for s in self.stores.values()]
        root = Layout(name="root")
        root.split_column(Layout(name="body", ratio=1), Layout(name="footer", size=4 + len(self.messages)))
        body = Layout(name="body")
        body.split_row(*[Layout(p) for p in panels])
        root["body"].update(body)
        tot_u = sum(s.stats.get("unique", 0) for s in self.stores.values())
        tot_d = sum(s.stats.get("dupes", 0) for s in self.stores.values())
        tot_det = sum(s.stats.get("details", 0) for s in self.stores.values())
        mbit = sum(s.stats.get("bytes_wire_s", 0) for s in self.stores.values()) * 8 / 1e6
        pps = sum(s.stats.get("products_s", 0) for s in self.stores.values())
        foot = Text.assemble(
            ("TOTAL  ", "bold"), (f"unique {tot_u:,}", "bold green"), f"  dupes {tot_d:,}  details {tot_det:,}  ",
            (f"{mbit:.2f} Mbit/s", "bold"), f"  {pps:.0f} products/s  elapsed {fmt_secs(time.time() - self.t0)}\n",
            ("q", "bold yellow"), " stop   ", ("u", "bold yellow"), " upload to Supabase when done   ",
            ("preview: ", "dim"), ("uv run tui/preview.py --store coles", "dim"),
        )
        if self.messages:
            foot.append("\n" + "\n".join(self.messages), style="magenta")
        root["footer"].update(Panel(foot, border_style="white"))
        return root

    # ---------- keyboard ----------
    def key_loop(self) -> None:
        if not sys.stdin.isatty():
            return
        fd = sys.stdin.fileno()
        old = termios.tcgetattr(fd)
        try:
            tty.setcbreak(fd)
            while not self.stop.is_set():
                r, _, _ = select.select([sys.stdin], [], [], 0.2)
                if not r:
                    continue
                ch = sys.stdin.read(1)
                if ch in ("q", "\x03"):
                    self.request_stop()
                elif ch == "u":
                    self.upload_requested = True
                    self.messages.append("upload queued: runs when all crawlers finish")
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old)

    def request_stop(self) -> None:
        self.stop.set()
        for st in self.stores.values():
            if st.proc and st.proc.poll() is None:
                st.proc.send_signal(signal.SIGINT)

    # ---------- main ----------
    def run(self) -> int:
        for s in self.stores:
            if self.args.attach:
                self.attach(s)
            else:
                self.spawn(s)
        kt = threading.Thread(target=self.key_loop, daemon=True)
        kt.start()
        with Live(self.render(), console=console, refresh_per_second=4, screen=True) as live:
            while True:
                live.update(self.render())
                if self.stop.is_set():
                    if all(s.proc is None or s.proc.poll() is not None for s in self.stores.values()):
                        break
                elif self.all_finished():
                    break
                time.sleep(0.25)
        self.stop.set()
        self.summary()
        if self.upload_requested and not self.args.attach:
            for s in self.stores:
                subprocess.run([sys.executable, str(SCRAPER_DIR / "tui" / "upload_supabase.py"), "--store", s], cwd=SCRAPER_DIR)
        return 0

    def summary(self) -> None:
        t = Table(title="hyperscrape summary", show_lines=False)
        for col in ("store", "status", "unique", "duplicates", "details", "errors", "backoffs", "peak req/s", "downloaded", "elapsed", "db"):
            t.add_column(col)
        for st in self.stores.values():
            d = st.stats
            t.add_row(st.name, st.status, f"{d.get('unique', 0):,}", f"{d.get('dupes', 0):,}", f"{d.get('details', 0):,}", str(d.get("errors", 0)),
                      str(d.get("backoffs", 0)), f"{d.get('best_rate', 0):.1f}", human_bytes(d.get("bytes_wire", 0)), fmt_secs(d.get("elapsed_s", 0)),
                      str(DATA_DIR / f"hyper_{st.name}.db"))
        console.print(t)
        console.print("[dim]next: uv run tui/preview.py --store coles | uv run tui/build_master.py | uv run tui/upload_supabase.py --store coles[/]")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--stores", default="coles,woolworths")
    ap.add_argument("--phase", default="all", choices=["list", "detail", "all"])
    ap.add_argument("--bin", default=str(SCRAPER_DIR / "hyperscrape"))
    ap.add_argument("--start-rate", default="0.1")
    ap.add_argument("--max-rate", type=float, default=150)
    ap.add_argument("--pause", type=float, default=5)
    ap.add_argument("--workers", type=int, default=64)
    ap.add_argument("--max-inflight", type=int, default=64)
    ap.add_argument("--seed", action="store_true", help="seed detail ids from the old go dbs (coles.db / woolworths.db)")
    ap.add_argument("--attach", action="store_true", help="don't spawn; tail data/<store>.ndjson of running crawlers")
    ap.add_argument("--extra", default="", help="extra flags passed verbatim to the Go binary")
    args = ap.parse_args()
    args.stores = [s.strip() for s in args.stores.split(",") if s.strip() in STORES]
    if not args.stores:
        ap.error("no valid stores")
    DATA_DIR.mkdir(exist_ok=True)
    if not args.attach and not Path(args.bin).exists():
        console.print(f"[red]binary not found: {args.bin}[/] (build with: go build -o hyperscrape ./cmd/hyperscrape)")
        return 1
    return Orchestrator(args).run()


if __name__ == "__main__":
    os.chdir(SCRAPER_DIR)
    sys.exit(main())
