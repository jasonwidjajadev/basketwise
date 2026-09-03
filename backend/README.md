# BasketWise API

Read-only, public, no auth. Serves the canonical grocery catalogue built by
`scraper/tui/build_api_db.py`.

**Live:** https://basket.taskglass.work · **Swagger:** https://basket.taskglass.work/docs

```
backend/
├── routes/
│   ├── categories.py
│   ├── compare.py
│   └── products.py
├── tests/
│   ├── test_api.py
│   └── test_compare.py
├── data/
│   └── essentials.txt
├── main.py                 FastAPI app, CORS, ETag, /health
├── db.py                   read-only SQLite + warm cache
├── models.py               Pydantic → OpenAPI
├── shapes.py               JSON dicts; also imported by scraper/tui/build_api_db.py
├── Dockerfile
├── compose.yml
├── openapi.json            checked-in dump; live schema is GET /openapi.json
└── pyproject.toml
```

## For the frontend team

Types are generated from the live schema — never hand-write them:

```bash
npx openapi-typescript https://basket.taskglass.work/openapi.json -o src/api/schema.d.ts
```

Then use the typed client in `frontend/src/api/client.ts`:

```ts
import { getCategories, getEssentials, getProducts, compare } from "@/api/client";

const categories = await getCategories();                          // browse nav
const essentials = await getEssentials();                          // Home, 20 items
const page = await getProducts({ category: "dairy-eggs-fridge", limit: 24, offset: 0 });
const hits = await getProducts({ q: "milk", limit: 10 });
const result = await compare([{ product_id: "full-cream-milk-2l", quantity: 2 }]);
```

### Three rules

1. The basket stores the canonical `product_id` only — never a retailer SKU.
2. Never total a basket on the frontend. `POST /compare` owns that arithmetic.
3. Category labels come from `GET /categories`, not a local map.

### Loading the landing page in two steps

`limit` is capped at 100, so the 50k-product catalogue can never arrive in one
response. Request a small first page for first paint, then page in the rest:

```ts
const first = await getProducts({ limit: 24 });                 // pre-rendered, ~0.5 ms
const more  = await getProducts({ limit: 24, offset: 24 });     // after mount
```

`GET /categories`, `GET /products?limit=24` and the first page of each category are
pre-rendered at build time and served as bytes, so they cost the origin nothing.

## Routes

| Route | Purpose |
|---|---|
| `GET /categories` | Canonical categories + subcategories, with product counts |
| `GET /products` | Filter by `essential`, `category`, `subcategory`, `tag`, `q`, `special`, `retailer`, `multi_retailer`; page with `limit`/`offset` |
| `GET /products/{id}` | One product with every retailer's offer, cheapest first |
| `GET /products/{id}/price-history` | Price observations per retailer, for a sparkline |
| `POST /compare` | Basket in → three buying strategies (`options[]`) with store breakdowns |
| `GET /health` | Status + `build_id` + row counts |

`GET /products` returns `[]` when nothing matches — it never 404s. It also sets
**`X-Total-Count`** with the number of matches ignoring `limit`/`offset`, so you can
render "24 of 1,240" and know when to stop paging:

```ts
const { data, total } = await getProductsPage({ category: "pantry", limit: 24 });
```

### What a product card can render without a second request

Every price field describes the **same** (cheapest) retailer, so nothing contradicts:

```ts
p.image_url          // absolute https CDN url — 100% coverage
p.brand              // 99% coverage
p.min_price          // 8.40
p.cheapest_retailer  // "woolworths"  → RETAILER_LABEL[p.cheapest_retailer]
p.was_price          // 14.00 when on special, else null
formatUnitPrice(p)   // "$0.84 / 100ml"  — 71% coverage
discountPercent(p)   // 40  → "SAVE 40%"
formatSize(p)        // "1 L"
p.retailer_count     // 2  → "at 2 stores"
p.tags               // ["vegan"] — 2,558 products carry a dietary tag
```

`rating_avg` / `rating_count` exist in the schema but are **null for almost every
product** — the Woolworths detail crawl has not run yet. Render them only if present.

`POST /compare` returns three complete-basket strategies (`recommended-split`,
`cheapest-single-store`, `lowest-possible-price`). A strategy that cannot fulfil
every known item has `total: null` and an empty `breakdown` — never a silent
partial total. Unknown basket ids are listed in `unknown_product_ids`.

## Run it locally

```bash
cd backend
uv venv .venv && VIRTUAL_ENV=.venv uv pip install fastapi 'uvicorn[standard]' pytest
.venv/bin/uvicorn main:app --reload      # http://127.0.0.1:8000/docs
.venv/bin/python -m pytest tests -q      # 15 contract tests
```

Point it at a database with `BASKETWISE_DB=/path/to/basketwise.db`; it defaults to
`../scraper/data/basketwise.db`.

## How it stays small

The API does **no** processing. Canonicalisation, cross-retailer matching, taxonomy
mapping, FTS and VACUUM all happen on the build machine, which turns a 3.4 GB
`master.db` into a 52 MB immutable artifact. The server just reads it.

- ~250 MB RSS, flat regardless of catalogue size
- SQLite opened `mode=ro&immutable=1` — the process **cannot** write to its own data
- Container is `read_only`, `cap_drop: ALL`, non-root (uid 10001), capped at 512 MB
- No published host port: the Cloudflare Tunnel dials out, so nothing new listens
  on the public interface

# Deploying the BasketWise API to hpsrv

hpsrv **serves only**. It never scrapes and never post-processes — it receives a
finished 52 MB SQLite artifact and answers requests from it. Steady state is ~250 MB.

## One-time setup

Data and code are already synced to `/srv/basketwise` (`data/` + `app/`).

### 1. Start the API

```bash
ssh hpsrv@hpsrv
cd /srv/basketwise/app
docker compose build api && docker compose up -d api
curl -s http://$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' basketwise-api):8000/health | head -c 300
docker stats --no-stream basketwise-api          # expect < 300 MB
```

The container publishes **no host port** — it is reachable only on its own Docker
network, and after step 2, through the tunnel.

### 2. Create the Cloudflare Tunnel

This needs your Cloudflare account, so it is yours to run. Do **not** reuse the
kniageo tunnel — that one serves production `kniamaps.com` and a shared config file
is a shared blast radius.

In the Cloudflare dashboard: **Zero Trust → Networks → Tunnels → Create a tunnel**
→ Cloudflared → name it `basketwise` → copy the token.

> `api.taskglass.work` was already taken, so this deployment uses **`basket`**.

Add a **public hostname** on that tunnel:

| Field | Value |
|---|---|
| Subdomain | `basket` |
| Domain | `taskglass.work` |
| Service | `HTTP` → `api:8000` |

`api:8000` is the container's name on the compose network, which is why no host
port is needed. Cloudflare creates the `basket.taskglass.work` DNS record for you.

Then on hpsrv:

```bash
cd /srv/basketwise/app
printf 'CLOUDFLARE_TUNNEL_TOKEN=%s\n' 'PASTE_TOKEN_HERE' > .env
chmod 600 .env
docker compose up -d
curl -s https://basket.taskglass.work/health
```

This is a **named** tunnel, so `basket.taskglass.work` is stable across restarts and
reboots forever. A quick tunnel (`trycloudflare.com`) would hand out a new random
hostname every restart and break the frontend contract.

### 3. Lock down CORS once the frontend has a domain

While `*`, any site can call the API. It is public read-only data so this is not a
leak, but narrow it when you know the origin:

```bash
echo 'BASKETWISE_CORS=https://basketwise.pages.dev,http://localhost:5173' >> .env
docker compose up -d api
```

## Daily updates

Run on the **build machine**, not hpsrv:

```bash
scraper/deploy/nightly.sh              # crawl, canonicalise, validate, ship
scraper/deploy/nightly.sh --no-crawl   # rebuild + ship from existing crawl data
```

It refuses to ship a bad artifact — if the product count drops more than 20%, or a
retailer disappears, or fewer than 2,000 products are comparable, it aborts and
hpsrv keeps serving yesterday's data.

Schedule it on the Mac with launchd (03:30 daily):

```bash
cat > ~/Library/LaunchAgents/work.taskglass.basketwise.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>work.taskglass.basketwise</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>~/Sync/uni/Devsoc/TP26T2/basketwise/scraper/deploy/nightly.sh</string>
  </array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>30</integer></dict>
  <key>StandardOutPath</key><string>/tmp/basketwise-nightly.log</string>
  <key>StandardErrorPath</key><string>/tmp/basketwise-nightly.err</string>
</dict></plist>
PLIST
launchctl load ~/Library/LaunchAgents/work.taskglass.basketwise.plist
```

The Mac being asleep is not an outage: hpsrv keeps serving the last good artifact.

## Security posture

- No inbound port on hpsrv. The tunnel dials out; nothing new listens publicly.
- Container is non-root (uid 10001), `read_only`, `cap_drop: ALL`,
  `no-new-privileges`, `mem_limit: 512m`, `pids_limit: 128`.
- The database is mounted `:ro` **and** opened `mode=ro&immutable=1`, so the
  process cannot write to the data it serves even if the app is compromised.
- No auth means no credentials to leak. The only secret on the box is the tunnel
  token in `.env` (mode 600). Rate limiting and bot protection belong at the
  Cloudflare edge, not in application code.

## Rollback

```bash
cd /srv/basketwise/app && docker compose down          # take the API offline
docker compose up -d                                   # bring it back
```

The artifact is a single file. Keep a copy before a risky rebuild:

```bash
ssh hpsrv@hpsrv 'cp /srv/basketwise/data/basketwise.db /srv/basketwise/data/basketwise.db.prev'
```
