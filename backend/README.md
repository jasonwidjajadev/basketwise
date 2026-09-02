# BasketWise API

Read-only, public, no auth. Serves the canonical grocery catalogue built by
`scraper/tui/build_api_db.py`.

**Live:** https://basket.taskglass.work · **Swagger:** https://basket.taskglass.work/docs

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
| `POST /compare` | Basket in → per-retailer totals, missing items, recommendation |
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

`POST /compare` returns `missing_product_ids` explicitly rather than silently
dropping items, and `recommendation` is `null` unless some retailer stocks the
*entire* basket. A cheap total with three missing items is not a real win, so show
the missing count in the UI.

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

## Files

| File | Role |
|---|---|
| `main.py` | App, CORS, ETag/cache middleware, `/health` |
| `db.py` | Read-only connection + warm-response cache |
| `models.py` | Pydantic models → the OpenAPI schema the frontend generates from |
| `shapes.py` | The one definition of the JSON, shared with the builder |
| `routes/` | `categories.py`, `products.py`, `compare.py` |
| `data/essentials.txt` | Curated Home essentials, in display order — edit freely |
| `tests/test_api.py` | Contract tests asserting the v2 shapes |
