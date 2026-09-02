# hyperscrape — full-catalogue crawler (Coles, Woolworths, ALDI, Harris Farm)

A high-concurrency crawler (Go) driven by a live TUI (Python) that pulls the entire
product catalogue of each supported store into local SQLite, previews it, then
optionally uploads to Supabase. It replaces the old sleep-based Python scrapers and the
listing-only Go scraper. Coles and Woolworths get the full per-product detail
(nutrition, ingredients, allergens, GTIN/barcode, images, retail/promo limits, ratings)
described in `example_requests/*/goal.md`; ALDI and Harris Farm have no per-product
detail endpoint, so they get everything their listing API carries (price, brand, size,
unit price, images, category — see "What it collects" below).

## Adding a store

Each retailer is one file implementing `crawl.Store` (`internal/crawl/engine.go:23-35`)
— see `internal/stores/aldi/aldi.go` for the simplest example (no anti-bot, listing
only). A store with no detail endpoint must make `DetailItem`'s `Do` a true no-op (never
call `e.OnDetail`) and be added to `noDetail` in `cmd/hyperscrape/main.go`, because the
detail-upsert SQL doesn't `COALESCE` every column — an empty `Product` would clobber
real listing data. Wire the new package into the `switch *store` and `defaultMaxRate` in
`main.go`, and add it to `STORES`/`STORE_HOSTS`/`STORE_WARMUP_PATH` in `tui/common.py`.

## Quick start

```bash
# 1. build the Go crawler (cgo — needs a C toolchain; Xcode CLT on mac)
go build -o hyperscrape ./cmd/hyperscrape

# 2. python tooling (uv). Use an isolated env so it doesn't touch the old .venv:
UV_PROJECT_ENVIRONMENT=.venv-hs uv sync
UV_PROJECT_ENVIRONMENT=.venv-hs uv run playwright install chromium   # for the fallback tiers

# 3. run all stores with the live TUI
UV_PROJECT_ENVIRONMENT=.venv-hs uv run tui/hyperscrape.py --stores coles,woolworths,aldi,harrisfarm --phase all

# ...or run one store headless and watch the raw stats
./hyperscrape -store coles -phase all            # writes data/hyper_coles.db
./hyperscrape -store aldi -phase all             # no anti-bot, no cookies, ~15s for the full catalogue
```

## The AIMD rate controller (TCP-style congestion control)

Each store runs its own controller that *discovers* the maximum error-free request rate:

- **Slow start** from `0.1 req/s` (one request per 10 s), doubling every 2 s epoch.
- **Additive increase** (probe) once past the safe threshold: `+max(1, 10% )` per clean epoch.
- **Latency guard**: growth pauses if p50 latency climbs past 3× the observed baseline
  (catches server queueing before it turns into errors).
- **Backoff on any HTTP error / anti-bot interstitial**: pause 5 s, then
  - *isolated* error (successes on either side): ease rate to 75% and keep probing near the ceiling;
  - *sustained* errors (no success between backoffs): classic halving, and the pause doubles each time.
- **Ceiling memory**: the best sustained clean rate is remembered; after a backoff it
  re-climbs only to 90% of it. The peak is saved to `crawl_runs`, so `-start-rate auto`
  resumes at 25% of the last peak instead of crawling up from 0.1.
- **Give-up / escalate**: N consecutive *dead* backoffs (no success at all in between) flag
  the crawl as blocked and it exits with code 2 for the TUI to escalate (see fallback tiers).

404 (missing product) and 401 (transient session blip) are not treated as rate signals.

## What it collects

Everything from the store listing APIs plus the product-detail APIs:

- **Coles**: `GET /_next/data/{buildId}/en/browse/{cat}.json?page=N` (listing) and
  `/_next/data/{buildId}/en/product/{slug}.json` (detail). Build id auto-discovered and
  cached; the JSON endpoints work without a warmed cookie jar. Wrong slug → resolved via
  the `/product/x-{id}` 308 redirect, else marked deprecated.
- **Woolworths**: `POST /apis/ui/browse/category` (listing, pageSize 36) and
  `GET /apis/ui/product/detail/{stockcode}` (detail). Needs cookies warmed from an HTML
  page first. Ratings come from a batched `POST /graphql` `productTile` query (50 ids/call).
  Mega marketplace categories (Everyday Market etc.) are crawled via their leaf nodes.
- **ALDI**: `GET api.aldi.com.au/v3/product-search?categoryKey=...&limit=60&offset=N`
  (`serviceType=walk-in` = national in-store range, no store/servicePoint needed).
  No API key, no cookies, no anti-bot observed. Category keys come straight off the
  homepage nav (`href="/products/{slug}/k/{id}"`) in one request — no redirect-chasing.
  **Listing only**: there is no product-detail endpoint (nutrition/ingredients exist on
  the ~500KB HTML product page but are out of scope — see "Adding a store" above).
- **Harris Farm Markets**: Shopify's public `GET /products.json?limit=250&page=N` feed.
  No auth, no anti-bot, no total count — pages walk until one comes back empty. Also
  listing-only; the feed already has everything (price, size, description, images,
  occasional barcode) with no separate detail call.

Raw listing/detail JSON is zstd-compressed into the row so nothing is lost.

## Fallback tiers (anti-bot)

1. **Direct JSON** (fast path) — the default.
2. **Warmed cookies** — on a `blocked` event the TUI runs `tui/harvest_cookies.py`
   (headless Chromium that solves the Imperva/Akamai JS challenge) and relaunches the Go
   binary with `-cookies data/cookies_<store>.json`.
3. **Browser mode** — if still blocked, `tui/browser_mode.py` fetches each detail JSON from
   inside a live Playwright page (`page.evaluate(fetch(...))`) at a gentle self-adjusting rate.

> Note: bursting a store to hundreds of req/s gets the IP flagged for several minutes
> (Woolworths/Akamai especially). The controller's per-store `-max-rate` cap (Coles 45,
> Woolworths 18, ALDI 25, Harris Farm 15 by default) exists to stay under that. If an IP
> is already flagged, wait for the cooldown or use tier 2/3. ALDI and Harris Farm have no
> observed anti-bot — their caps are just politeness, not a discovered ceiling.

## SQLite schema

`data/hyper_<store>.db` — `products` (all listing + detail fields, `WITHOUT ROWID`,
PK `store,product_id`), `price_history` (append-only, one row per price change),
`categories` (crawl progress), `crawl_runs` (per-run metrics incl. peak rate). Nutrition is
normalised to one shape across every store: `[{name, per_serving, per_100, di}]`.

## Preview, master DB, upload

```bash
uv run tui/preview.py --store coles                 # counts, fill-rates, samples
uv run tui/preview.py --store woolworths --id 759044 # one product in full
uv run tui/preview.py --store aldi

uv run tui/build_master.py                          # data/master.db: all stores unified,
                                                    # cross-store links (barcode + name/size),
                                                    # deprecated marking, source comparison

uv run tui/upload_supabase.py --store coles --dry-run   # needs scraper/.env
uv run tui/upload_supabase.py --store coles              # store_products + price_history + product_details
```

`build_master.py` prints unique product counts for **python scraper (Supabase)** vs
**old go scraper (`*.db`)** vs **new hyperscrape**, plus overlap / new-only / old-only, for
every store in `STORES`.

### Cross-store product matching

`product_links(store_a, id_a, store_b, id_b, method, confidence)` — one row per matched
pair, `store_a < store_b` alphabetically so each pair is stored once:
- **Tier 1 — barcode** (`confidence 1.0`): exact match on Coles `gtin` / Woolworths
  `Barcode` / Harris Farm `barcode`. ALDI has no barcode, so it never appears here.
- **Tier 2 — name+size** (`confidence 0.5`): normalised `brand+name+size` (lowercase,
  strip filler words, unit-normalise kg→g / l→ml), grouped and pairwise-linked across
  stores. This is what links ALDI/Harris Farm's own-brand items to national brands, e.g.
  ALDI "Baked Beans in Tomato Sauce 420g" $1.09 ↔ Woolworths "Baked Beans In Tomato Sauce
  420g" $1.10.
- **Follow-up (not built)**: an embedding-similarity tier (`sentence-transformers`
  MiniLM on `brand+name+size`, cosine threshold, category-blocked) for near-miss names
  tier 2 can't normalise its way to — e.g. ALDI vs national-brand wording differences.

Supabase reuses the existing `store_products` / `price_history` tables exactly as
`import_products.py` does; the extra detail fields go to a new `product_details` table
(create it once with `supabase/001_product_details.sql`).

## Serving the data: build_api_db.py

`build_master.py` produces a 3.4 GB research artifact with the raw JSON kept. The API
cannot serve that, so one more step turns it into what the backend actually reads:

```bash
uv run tui/build_api_db.py --dry-run   # report dedupe + mapping coverage, write nothing
uv run tui/build_api_db.py             # data/basketwise.db (52 MB) + data/warm/
```

What it does:

- **Drops the marketplace noise.** Woolworths' `is_market=1` rows are Everyday Market
  third-party listings (Home & Lifestyle, Electronics, Gift Ideas) -- ~490k of its
  514k rows, and not groceries. 550,906 master rows become 59,542 serving rows.
- **Canonicalises** those into ~50k BasketWise products: union-find over barcode
  (strong) then normalised name+size (fallback, the only tier ALDI and Harris Farm
  have). ~8.5k products end up carried by 2+ retailers -- those are what Compare compares.
- **Maps taxonomy** with `tui/canonical.py` (the Source-of-Truth v2 appendix, plus a
  volume-driven extension and a Harris Farm map v2 lacks). ~90% land on a canonical
  category, ~60% on a subcategory; the rest stay NULL rather than being guessed.
- **Drops the zstd blobs** (2.3 GB of the 3.4 GB) and builds an FTS5 index.
- **Pre-renders** the hot API responses into `data/warm/` so the server never
  serializes them at request time.

Nightly crawl + build + ship, run from the build machine:

```bash
deploy/nightly.sh              # crawl all 4 stores, rebuild, validate, ship to hpsrv
deploy/nightly.sh --no-crawl   # rebuild + ship from the crawl data already on disk
```

It validates before shipping and aborts on a bad build, so the server keeps serving
the last good artifact rather than garbage. See `backend/DEPLOY.md`.

## CLI flags (Go)

```
-store coles|woolworths|aldi|harrisfarm   -db data/hyper_<store>.db   -phase list|detail|all
-start-rate 0.1|auto         -max-rate <req/s>             -pause 5s
-workers 64                  -max-inflight 96              -seed-db <old go db>
-cookies <playwright.json>   -leaves (coles)               -no-ratings (woolworths)
-max-pages N (testing)       -detail-max-age 24h           -quiet
```

`-phase detail` (or `-phase all`) on `aldi`/`harrisfarm` is a documented no-op — see
"Adding a store" above.

## Other Australian providers considered

Probed live, not built in this pass:
- **IGA** (`www.igashop.com.au/api/storefront/*`) — works, but store-scoped: 521
  independently-priced stores, so a Sydney store id must be chosen first and pricing
  isn't national. Medium effort follow-up.
- **Costco AU** (`/rest/v2/australia/products/search`, SAP Hybris) — works, national,
  but a much smaller/limited product range. Optional follow-up.
- **Skipped**: Amazon Fresh AU (discontinued in AU, 302→404), Chemist Warehouse
  (Cloudflare-protected, not a grocery source).
