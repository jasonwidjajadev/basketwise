#!/usr/bin/env bash
# Nightly crawl -> canonicalise -> validate -> ship.
#
# Runs on the BUILD machine (Brandan's Mac, or any box with the crawler).
# hpsrv only ever receives the finished artifact; it never scrapes or processes.
#
#   scraper/deploy/nightly.sh            full run
#   scraper/deploy/nightly.sh --no-crawl rebuild + ship from existing crawl data
set -euo pipefail

SCRAPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA="$SCRAPER_DIR/data"
REMOTE="${BASKETWISE_REMOTE:-hpsrv@hpsrv}"
REMOTE_DIR="${BASKETWISE_REMOTE_DIR:-/srv/basketwise}"
export UV_PROJECT_ENVIRONMENT=.venv-hs
cd "$SCRAPER_DIR"

log() { printf '\n=== %s ===\n' "$*"; }

if [[ "${1:-}" != "--no-crawl" ]]; then
  log "cookies (woolworths anti-bot)"
  uv run tui/harvest_cookies.py --store woolworths || echo "cookie harvest failed; continuing on direct tier"
  for store in coles woolworths aldi harrisfarm; do
    log "crawl $store"
    ./hyperscrape -store "$store" -phase all -start-rate auto || echo "$store crawl exited $? -- keeping previous data"
  done
  log "merge -> master.db"
  uv run tui/build_master.py
fi

log "canonicalise -> basketwise.db"
uv run tui/build_api_db.py

log "validate"
# A truncated or mis-built artifact must never reach the server: hpsrv keeps
# serving yesterday's data instead, which is far better than serving garbage.
uv run python - <<'PY'
import sqlite3, sys, json, pathlib
p = pathlib.Path("data/basketwise.db")
db = sqlite3.connect(f"file:{p}?mode=ro", uri=True); db.row_factory = sqlite3.Row
n_prod = db.execute("SELECT COUNT(*) FROM products").fetchone()[0]
n_off  = db.execute("SELECT COUNT(*) FROM offers").fetchone()[0]
n_cat  = db.execute("SELECT COUNT(*) FROM categories WHERE product_count>0").fetchone()[0]
n_multi= db.execute("SELECT COUNT(*) FROM products WHERE retailer_count>=2").fetchone()[0]
stores = [r[0] for r in db.execute("SELECT DISTINCT retailer FROM offers")]
fail = []
if n_prod < 20000:  fail.append(f"only {n_prod} products")
if n_off  < 20000:  fail.append(f"only {n_off} offers")
if n_cat  < 10:     fail.append(f"only {n_cat} non-empty categories")
if n_multi < 2000:  fail.append(f"only {n_multi} comparable products -- /compare would be useless")
if len(stores) < 2: fail.append(f"only {len(stores)} retailers: {stores}")
prev = pathlib.Path("data/.last_build.json")
if prev.exists():
    old = json.loads(prev.read_text())
    if n_prod < old["products"] * 0.8:
        fail.append(f"products dropped {old['products']:,} -> {n_prod:,} (>20%)")
if fail:
    print("VALIDATION FAILED:"); [print("  -", f) for f in fail]; sys.exit(1)
prev.write_text(json.dumps({"products": n_prod, "offers": n_off}))
print(f"ok: {n_prod:,} products, {n_off:,} offers, {n_multi:,} comparable, retailers={stores}")
PY

log "ship -> $REMOTE:$REMOTE_DIR"
ssh "$REMOTE" "mkdir -p $REMOTE_DIR/incoming/warm"
rsync -az --partial "$DATA/basketwise.db" "$REMOTE:$REMOTE_DIR/incoming/basketwise.db"
rsync -az --delete "$DATA/warm/" "$REMOTE:$REMOTE_DIR/incoming/warm/"

log "activate"
ssh "$REMOTE" bash -se <<EOSSH
set -euo pipefail
cd "$REMOTE_DIR"
mkdir -p data
mv -f incoming/basketwise.db data/basketwise.db
rm -rf data/warm && mv -f incoming/warm data/warm
chmod 444 data/basketwise.db && chmod -R a-w data/warm
docker restart basketwise-api >/dev/null
for i in \$(seq 1 30); do
  sleep 1
  if curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1 || \
     docker exec basketwise-api python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=2)" 2>/dev/null; then
    echo "api healthy"; exit 0
  fi
done
echo "api did not come back healthy"; exit 1
EOSSH

log "done"
