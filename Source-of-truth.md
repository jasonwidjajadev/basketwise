# BasketWise Source of Truth

## Document Rules

- This document is the contract between frontend, backend, database, and scraping/data work.
- API/schema changes should be reflected here and in OpenAPI.
- Retailer-specific IDs do not go into the shared basket.
- `GET /categories` is the frontend source of truth for canonical category/subcategory labels.

> **Current cleanup status:** the structure has been simplified. Some runtime/API details may still be stale and will be verified against Swagger in the next pass.

---

## 1. Workflow

### 1.1 Scraper

- **Harvest cookies:** Woolworths only via `tui/harvest_cookies.py`. Other stores skip this.
- **Crawl:** `./hyperscrape -store coles|woolworths|aldi|harrisfarm -phase all`
  - Writes SQLite, not JSON.
  - Output: `scraper/data/hyper_<store>.db`
  - `*.ndjson` files next to those DBs are crawl logs.
- **Merge:** `uv run tui/build_master.py`
  - Links the same product across stores using barcode first, then name + size.
  - Output: `scraper/data/master.db`
- **Slim for the API:** `uv run tui/build_api_db.py`
  - Matching, taxonomy, and search indexing happen here so the API does none of that at request time.
  - Output: `scraper/data/basketwise.db`
  - Warm cache: `data/warm/`
- **Ship:** `deploy/nightly.sh`
  - Validates the build, rsyncs it to `hpsrv`, then restarts the API container.
  - A bad build is refused and `hpsrv` keeps yesterday's data.
  - **Do not `docker restart` hpsrv unless you intend to deploy.**

```txt
hyper_<store>.db
↓
master.db
↓
basketwise.db
↓
FastAPI
```

### 1.2 Backend

- FastAPI on `hpsrv` reads `basketwise.db` only. It never scrapes.
- Live API: [https://basket.taskglass.work/](https://basket.taskglass.work/)
- Swagger: [https://basket.taskglass.work/docs](https://basket.taskglass.work/docs)
- Local default DB: `../scraper/data/basketwise.db`
- Contract: [`Source-of-truth.md`](Source-of-truth.md)

### 1.3 Frontend

- **Client:** `frontend/src/api/client.ts`
  - Can call the API using `VITE_API_BASE` or the live URL.
- **Pages:** Home / Browse / Compare do **not** use the client yet.
  - Browse reads `frontend/src/api/browseApi.js` → `frontend/src/mocks/browse/`.
  - Home / cart leftovers still read `frontend/src/data/`.

```txt
Scraper
↓
Backend
↓
Frontend
```

---

## 2. Data Model

The original contract described a **planned** canonical model (`products` → `offers` → `price_history`). The scraper pipeline actually uses **two SQLite schemas** (A crawl vs B serving). Same table names do **not** mean the same columns.

Planned first, then what is implemented. Planned vs current **API JSON** is in §4.

```txt
hyper_<store>.db     Schema A  crawl dump
     ↓
master.db            Schema A  + product_links, source_counts
     ↓
basketwise.db        Schema B  serving artifact (backend reads this)
```

Old Supabase tables under `scraper/_can_possibly_delete/` are leftovers, not a third live schema.

### 2.1 Planned schema

```txt
products
   ↓ 1-to-many
offers
   ↓ 1-to-many
price_history
```

- `products` = canonical BasketWise grocery
- `offers` = retailer-specific mapping + current retailer state
- `price_history` = historical observations for each retailer offer

#### `products` / Canonical Product

A canonical BasketWise product represents **what the user wants to buy**, not a specific retailer listing.

The database keeps full retailer details in `offers`, but `GET /products` returns the current retailer prices needed by the frontend.

```ts
type ProductOfferSummary = {
  retailer: "coles" | "woolworths" | "aldi" | "harrisfarm"
  price: number
}

type Product = {
  id: string
  name: string
  category: string
  subcategory: string | null
  tags: string[]
  size_value: number
  size_unit: string
  image_url: string
  is_essential: boolean
  min_price: number | null
  retailer_count: number
  offers: ProductOfferSummary[]
}
```

Example:

```json
{
  "id": "product-uuid",
  "name": "Full Cream Milk",
  "category": "dairy-eggs-fridge",
  "subcategory": "milk",
  "tags": [],
  "size_value": 2000,
  "size_unit": "ml",
  "image_url": "/images/milk.webp",
  "is_essential": true,
  "min_price": 2.89,
  "retailer_count": 3,
  "offers": [
    {
      "retailer": "woolworths",
      "price": 3.10
    },
    {
      "retailer": "coles",
      "price": 3.20
    },
    {
      "retailer": "aldi",
      "price": 2.89
    }
  ]
}
```

Rules:

- `id` is the stable canonical BasketWise product ID.
- Home, Browse, Basket, Compare and future features use this same canonical ID.
- Do not use retailer product IDs as canonical product IDs.
- `category` must use a BasketWise canonical category ID.
- `subcategory` can be `null` when a reliable canonical mapping does not exist yet.
- `size_value` / `size_unit` use the implemented normalized units `g` / `ml` / `pk` / `ea`.
- `min_price` and `retailer_count` remain available for compact product summaries.
- `offers` contains the current retailer prices the frontend needs to render the product.
- The frontend should not make a separate request per ProductCard to fetch prices.
- Full retailer metadata remains in the database `offers` table.

#### `offers` / Retailer Mapping

An `offer` represents the mapping from one canonical BasketWise product to one real retailer listing.

```txt
products
Full Cream Milk 2L
        ↓
offers
├── Woolworths Full Cream Milk 2L
├── Coles Full Cream Milk 2L
└── ALDI Farmdale Full Cream Milk 2L
```

```ts
type Offer = {
  id: string
  product_id: string
  retailer: "coles" | "woolworths" | "aldi" | "harrisfarm"
  retailer_product_id: string | null
  retailer_product_name: string
  retailer_brand: string | null
  source_category: string | null
  source_subcategory: string | null
  price: number
  was_price: number | null
  is_special: boolean | null
  special_type: string | null
  special_end_date: string | null
  size_value: number | null
  size_unit: string | null
  unit_price: number | null
  product_url: string | null
  image_url: string | null
  is_available: boolean | null
  last_updated: string
}
```

Rules:

- `product_id` must reference `products.id`.
- Preserve retailer metadata if the scraper provides it.
- `price` is the current price used by `POST /compare`.
- Specials belong to the retailer offer, not to `products.category`.
- The scraper should use a stable retailer product ID when available so the same offer can be upserted instead of duplicated.

#### `price_history`

Each scraping cycle creates a historical observation for the retailer offer.

```ts
type PriceHistory = {
  id: string
  offer_id: string
  price: number
  was_price: number | null
  is_special: boolean | null
  special_type: string | null
  recorded_at: string
}
```

Rules:

- `offer_id` references `offers.id`.
- Updating `offers.price` must not replace historical observations.
- The scraper updates the current `offers` row and inserts a new `price_history` row.
- One observation per offer per scraping period/day is enough initially.

### 2.2 Currently implemented

The live serving database is **Schema B** (`basketwise.db`). Schema A is scraper-internal. FastAPI does not read Schema A.

#### Schema A — crawl (internal)

Source: [`scraper/internal/crawl/schema.sql`](scraper/internal/crawl/schema.sql). One file per store: `scraper/data/hyper_<store>.db`.

- `products` PK `(store, product_id)` — retailer SKU, prices in **cents**, raw JSON blobs
- `price_history` PK `(store, product_id, ts)` — no `offer_id`
- `categories` — crawl nav progress, not Browse taxonomy
- `crawl_runs` — run metrics
- `master.db` copies Schema A and adds `product_links` / `source_counts`

`build_api_db.py` rebuilds Schema B from `master.db`; it does not serve Schema A.

#### Schema B — serving (`basketwise.db`)

Source: [`scraper/tui/build_api_db.py`](scraper/tui/build_api_db.py) `SCHEMA`. FastAPI reads this file only.

```txt
products  1 --*  offers  1 --*  price_history
categories  1 --*  subcategories
```

```sql
CREATE TABLE products (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  brand         TEXT,
  category      TEXT,
  subcategory   TEXT,
  tags          TEXT NOT NULL DEFAULT '[]',   -- JSON array of canonical tag ids
  size_value    REAL,
  size_unit     TEXT,
  image_url     TEXT,
  is_essential  INTEGER NOT NULL DEFAULT 0,
  essential_rank INTEGER,
  is_active     INTEGER NOT NULL DEFAULT 1,
  retailer_count INTEGER NOT NULL DEFAULT 0,
  min_price     REAL,
  cheapest_retailer TEXT,
  unit_price    REAL,
  unit_measure  TEXT,
  was_price     REAL,
  has_special   INTEGER NOT NULL DEFAULT 0,
  rating_avg    REAL,
  rating_count  INTEGER
);

CREATE TABLE offers (
  id                    TEXT PRIMARY KEY,
  product_id            TEXT NOT NULL REFERENCES products(id),
  retailer              TEXT NOT NULL,
  retailer_product_id   TEXT,
  retailer_product_name TEXT NOT NULL,
  retailer_brand        TEXT,
  source_category       TEXT,
  source_subcategory    TEXT,
  price                 REAL NOT NULL,
  was_price             REAL,
  is_special            INTEGER,
  special_type          TEXT,
  special_end_date      TEXT,
  size_value            REAL,
  size_unit             TEXT,
  unit_price            REAL,
  product_url           TEXT,
  image_url             TEXT,
  is_available          INTEGER,
  last_updated          TEXT
);

CREATE TABLE price_history (
  id          INTEGER PRIMARY KEY,
  offer_id    TEXT NOT NULL REFERENCES offers(id),
  price       REAL NOT NULL,
  was_price   REAL,
  is_special  INTEGER,
  special_type TEXT,
  recorded_at TEXT NOT NULL
);

CREATE TABLE categories (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  position INTEGER NOT NULL,
  product_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE subcategories (
  id          TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  product_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (category_id, id)
);

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE VIRTUAL TABLE products_fts USING fts5(
  name, id UNINDEXED, tokenize='porter unicode61'
);

CREATE INDEX idx_products_cat      ON products(category, subcategory, id);
CREATE INDEX idx_products_ess      ON products(is_essential, essential_rank) WHERE is_essential=1;
CREATE INDEX idx_products_special  ON products(has_special) WHERE has_special=1;
CREATE INDEX idx_offers_product    ON offers(product_id, retailer);
CREATE INDEX idx_offers_retailer   ON offers(retailer);
CREATE INDEX idx_ph_offer          ON price_history(offer_id, recorded_at);
CREATE INDEX idx_sub_cat           ON subcategories(category_id, position);
```

Diffs vs planned:

- `products`: extra columns (`brand`, `essential_rank`, `is_active`, `cheapest_retailer`, `unit_price`, `unit_measure`, `was_price`, `has_special`, `rating_avg`, `rating_count`); **no** `offers[]` column; `tags` is JSON text `'[]'`, not Postgres `TEXT[]`
- `offers`: same fields as planned; `last_updated` is nullable TEXT
- `price_history.id` is `INTEGER PRIMARY KEY`, not a string
- Extra tables: `categories`, `subcategories`, `meta`, `products_fts`
- Rebuild: hyperscrape writes Schema A; `build_api_db.py` **rebuilds** Schema B from `master.db`. It does not upsert a live Schema B `offers` row during crawl

### 2.3 Basket State

For the MVP, the basket is shared React state.

#### Basket item shape

```ts
type BasketItem = {
  product_id: string
  quantity: number
}
```

Example:

```json
{
  "product_id": "full-cream-milk-2l",
  "quantity": 2
}
```

Rules:

- Basket stores **canonical `product_id` only**.
- Do not store `offer_id` in the basket.
- Do not store Coles/Woolworths/ALDI-specific product IDs in the basket.
- Home, Browse, Search and Meals all add into the same basket.
- `quantity` must be greater than `0`.
- Removing the last unit removes the basket item.
- Basket persistence to the backend is not required for the first demo.

```txt
Essentials ─┐
Browse ─────┼──→ BasketItem[] ───→ POST /compare
Search ─────┤
Meals ──────┘
```

Current: no basket table or basket HTTP route. Matches planned (client state only).

---

## 3. Canonical Product & Taxonomy

BasketWise does not use retailer taxonomy directly.

```txt
Woolworths: Fruit & Veg
Coles:      Fruit & Vegetables
ALDI:       Fruit & Vegetable
             ↓
BasketWise: fruit-vegetables
             ↓
Frontend:   Fruit & Vegetables
```

Keep raw retailer taxonomy:

```txt
offers.source_category
offers.source_subcategory
```

Keep canonical BasketWise taxonomy:

```txt
products.category
products.subcategory
```

The raw retailer taxonomy is never thrown away.

### 3.1 Canonical Categories + Frontend Labels

The backend is the single source of truth:

```python
CATEGORIES = [
    {"id": "fruit-vegetables", "name": "Fruit & Vegetables"},
    {"id": "meat-seafood", "name": "Meat & Seafood"},
    {"id": "deli-chilled", "name": "Deli & Chilled"},
    {"id": "dairy-eggs-fridge", "name": "Dairy, Eggs & Fridge"},
    {"id": "bakery", "name": "Bakery"},
    {"id": "pantry", "name": "Pantry"},
    {"id": "snacks-confectionery", "name": "Snacks & Confectionery"},
    {"id": "frozen", "name": "Frozen"},
    {"id": "drinks", "name": "Drinks"},
    {"id": "cleaning-household", "name": "Cleaning & Household"},
    {"id": "health-beauty", "name": "Health & Beauty"},
    {"id": "baby", "name": "Baby"},
    {"id": "pet", "name": "Pet"},
    {"id": "liquor", "name": "Liquor"},
    {"id": "electronics", "name": "Electronics"},
    {"id": "home-garden", "name": "Home & Garden"},
    {"id": "tobacco", "name": "Tobacco"},
]
```

Frontend calls `GET /categories`, displays `name`, and uses `id` for filtering.

---

### 3.2 Category vs Subcategory vs Tag vs Offer Metadata

When normalizing scraped retailer taxonomy:

#### Category
Use for the broad type of product.

```txt
meat-seafood
dairy-eggs-fridge
pantry
frozen
```

#### Subcategory
Use for **what the product actually is**.

```txt
beef
poultry
milk
eggs
pasta-rice-grains
frozen-vegetables
```

#### Tag
Use for product attributes that can overlap multiple categories/subcategories.

```txt
organic
halal
kosher
vegan
vegetarian
gluten-free
high-protein
```

#### Offer metadata
Use for retailer-specific commercial state.

```txt
is_special
special_type
special_end_date
was_price
is_available
```

Examples:

```txt
Coles "Organic Meat"
→ category: meat-seafood
→ subcategory: determined from product itself, e.g. beef/mince
→ tag: organic
```

```txt
Coles "Halal"
→ category: meat-seafood
→ subcategory: determined from product itself
→ tag: halal
```

```txt
ALDI "Vegetarian & Vegan"
→ canonical category/subcategory based on the actual product
→ tag: vegetarian and/or vegan only when the product data supports it
```

```txt
Woolworths "Fruit & Veg Specials & Offers"
→ keep source taxonomy
→ canonical category based on the product
→ offer.is_special = true when the scraped offer indicates a promotion
→ do not create a `specials` category or product tag
```

**Important:** retailer taxonomy alone may be too broad to infer the exact subcategory/tag safely. Preserve the source value and leave canonical fields `null` when uncertain rather than inventing a mapping.

---

## 4. API by Page

> Planned examples below are the original contract. **Current return (live API)** is what FastAPI serializes today (`backend/shapes.py`, `backend/models.py`). They are listed together so a planned shape and a live shape can be compared without deleting either.

### 4.1 Home

#### Everyday Essentials

```http
GET /products?essential=true&limit=20
```

Uses the same `Product[]` planned and current contracts documented under Browse below.

---

### 4.2 Browse

#### Left sidebar

```http
GET /categories
```

Purpose: load the Browse left sidebar.

##### Planned response

```json
[
  {
    "id": "fruit-vegetables",
    "name": "Fruit & Vegetables",
    "subcategories": [
      {
        "id": "fruit",
        "name": "Fruit"
      },
      {
        "id": "vegetables",
        "name": "Vegetables"
      }
    ]
  }
]
```

```ts
type Subcategory = {
  id: string
  name: string
}

type Category = {
  id: string
  name: string
  subcategories: Subcategory[]
}
```

##### Current return (live API)

```json
[
  {
    "id": "fruit-vegetables",
    "name": "Fruit & Vegetables",
    "product_count": 4120,
    "subcategories": [
      {
        "id": "fruit",
        "name": "Fruit",
        "product_count": 890
      },
      {
        "id": "vegetables",
        "name": "Vegetables",
        "product_count": 1020
      }
    ]
  }
]
```

Differs: `product_count` on each category and subcategory. Empty categories are omitted.

The frontend displays `name` and sends `id` back in product requests.

---

#### Initial product grid

Default category: `fruit-vegetables`

```http
GET /products?category=fruit-vegetables&limit=24&offset=0
```

#### Category click

```http
GET /products?category={category_id}&limit=24&offset=0
```

#### Subcategory click

```http
GET /products?category={category_id}&subcategory={subcategory_id}&limit=24&offset=0
```

#### Pagination

```http
GET /products?category={category_id}&limit=24&offset=24
```

or

```http
GET /products?category={category_id}&subcategory={subcategory_id}&limit=24&offset=24
```

#### Product list — planned response

```ts
Product[]
```

```json
[
  {
    "id": "product-uuid",
    "name": "Broccoli",
    "category": "fruit-vegetables",
    "subcategory": "vegetables",
    "tags": [],
    "size_value": 1,
    "size_unit": "each",
    "image_url": "...",
    "is_essential": false,
    "min_price": 2.29,
    "retailer_count": 3,
    "offers": [
      {
        "retailer": "woolworths",
        "price": 2.50
      },
      {
        "retailer": "coles",
        "price": 2.40
      },
      {
        "retailer": "aldi",
        "price": 2.29
      }
    ]
  }
]
```

Behaviour (planned):

- No matching products → return `[]`.
- `category` and `subcategory` use canonical BasketWise IDs.
- `offers` must contain the current retailer prices needed by the frontend.
- Pagination is bounded. Do not return the full catalogue in one response.

Search, retailer filtering, sorting, tags and Specials filtering are extensions and can be added later as optional parameters.

#### Product list — current return (live API)

```http
GET /products?...
```

Bare `Product[]`. Header **`X-Total-Count`** is the match count ignoring `limit`/`offset`. Empty match → `[]`. **No `offers` key.**

```json
[
  {
    "id": "full-cream-milk-2l",
    "name": "Full Cream Milk",
    "brand": "Bega",
    "category": "dairy-eggs-fridge",
    "subcategory": "milk",
    "tags": [],
    "size_value": 2000,
    "size_unit": "ml",
    "image_url": "https://...",
    "is_essential": true,
    "min_price": 3.10,
    "cheapest_retailer": "coles",
    "unit_price": 1.55,
    "unit_measure": "100ml",
    "was_price": 4.20,
    "has_special": true,
    "retailer_count": 3,
    "rating_avg": null,
    "rating_count": null
  }
]
```

Differs: extra denormalised card fields; per-retailer prices are not on the list. Those live on `GET /products/{id}`.

#### Product detail

```http
GET /products/{id}
```

##### Planned response

Not specified as its own page contract in this section. Planned list `Product` plus full retailer `offers` was assumed available without a second request.

##### Current return (live API)

404 if the id does not exist. Body is the list product object plus full Schema B `offers` (cheapest first):

```json
{
  "id": "full-cream-milk-2l",
  "name": "Full Cream Milk",
  "brand": "Bega",
  "category": "dairy-eggs-fridge",
  "subcategory": "milk",
  "tags": [],
  "size_value": 2000,
  "size_unit": "ml",
  "image_url": "https://...",
  "is_essential": true,
  "min_price": 3.10,
  "cheapest_retailer": "coles",
  "unit_price": 1.55,
  "unit_measure": "100ml",
  "was_price": 4.20,
  "has_special": true,
  "retailer_count": 3,
  "rating_avg": null,
  "rating_count": null,
  "offers": [
    {
      "id": "coles:123",
      "product_id": "full-cream-milk-2l",
      "retailer": "coles",
      "retailer_product_id": "123",
      "retailer_product_name": "Coles Full Cream Milk 2L",
      "retailer_brand": "Coles",
      "source_category": "Dairy, Eggs & Fridge",
      "source_subcategory": "Milk",
      "price": 3.10,
      "was_price": 4.20,
      "is_special": true,
      "special_type": null,
      "special_end_date": null,
      "size_value": 2000,
      "size_unit": "ml",
      "unit_price": 1.55,
      "product_url": "https://...",
      "image_url": "https://...",
      "is_available": true,
      "last_updated": "2026-09-03"
    }
  ]
}
```

---

### 4.3 Basket

No backend Basket API is required in the current documented contract.

```ts
type BasketItem = {
  product_id: string
  quantity: number
}
```

The basket stores the canonical `product_id`, not retailer product IDs or `offer_id`.

Current return: none. There is no basket route on the live API.

---

### 4.4 Compare

#### `POST /compare`

Request type:

```ts
type CompareRequest = {
  items: BasketItem[]
}
```

Request:

```json
{
  "items": [
    {
      "product_id": "product-uuid-1",
      "quantity": 1
    },
    {
      "product_id": "product-uuid-2",
      "quantity": 2
    }
  ]
}
```

##### Response

Implemented in `backend/routes/compare.py`. Three complete-basket strategies; the frontend only renders the response.

```json
{
  "options": [
    {
      "id": "recommended-split",
      "name": "Recommended split",
      "description": "Woolworths and ALDI",
      "total": 54.80,
      "savings": 13.40,
      "stores": 2,
      "recommended": true,
      "breakdown": [
        {
          "retailer": "woolworths",
          "subtotal": 31.20,
          "items": [
            {
              "product_id": "product-uuid-1",
              "product_name": "Full Cream Milk",
              "retailer_product_id": "133211",
              "retailer_product_name": "Woolworths Full Cream Milk 2L",
              "quantity": 1,
              "unit_price": 3.10,
              "line_total": 3.10,
              "image_url": "..."
            }
          ]
        },
        {
          "retailer": "aldi",
          "subtotal": 23.60,
          "items": [
            {
              "product_id": "product-uuid-2",
              "product_name": "White Bread",
              "retailer_product_id": "12345",
              "retailer_product_name": "Bakers Life White Bread 700g",
              "quantity": 2,
              "unit_price": 2.20,
              "line_total": 4.40,
              "image_url": "..."
            }
          ]
        }
      ]
    },
    {
      "id": "cheapest-single-store",
      "name": "Cheapest single store",
      "description": "Woolworths",
      "total": 61.70,
      "savings": 6.50,
      "stores": 1,
      "recommended": false,
      "breakdown": [
        {
          "retailer": "woolworths",
          "subtotal": 61.70,
          "items": [
            {
              "product_id": "product-uuid-1",
              "product_name": "Full Cream Milk",
              "retailer_product_id": "133211",
              "retailer_product_name": "Woolworths Full Cream Milk 2L",
              "quantity": 1,
              "unit_price": 3.10,
              "line_total": 3.10,
              "image_url": "..."
            }
          ]
        }
      ]
    },
    {
      "id": "lowest-possible-price",
      "name": "Lowest possible price",
      "description": "Coles, Woolworths and ALDI",
      "total": 52.90,
      "savings": 15.30,
      "stores": 3,
      "recommended": false,
      "breakdown": [
        {
          "retailer": "coles",
          "subtotal": 14.40,
          "items": []
        },
        {
          "retailer": "woolworths",
          "subtotal": 18.30,
          "items": []
        },
        {
          "retailer": "aldi",
          "subtotal": 20.20,
          "items": []
        }
      ]
    }
  ],
  "unknown_product_ids": []
}
```

`breakdown` is fully populated on every option; empty `items` arrays on `lowest-possible-price` above only shorten the example.

Response contract:

```ts
type CompareItem = {
  product_id: string
  product_name: string
  retailer_product_id: string | null
  retailer_product_name: string
  quantity: number
  unit_price: number
  line_total: number
  image_url: string | null
}

type StoreBreakdown = {
  retailer: "coles" | "woolworths" | "aldi" | "harrisfarm"
  subtotal: number
  items: CompareItem[]
}

type CompareOption = {
  id: "recommended-split" | "cheapest-single-store" | "lowest-possible-price"
  name: string
  description: string
  total: number | null
  savings: number | null
  stores: number
  recommended: boolean
  breakdown: StoreBreakdown[]
}

type CompareResponse = {
  options: CompareOption[]
  unknown_product_ids: string[]
}
```

Frontend usage:

```txt
options[]
→ the 3 comparison cards

option.total
→ total basket cost

option.savings
→ saving against the agreed baseline

option.stores
→ number of supermarkets required

option.recommended
→ which card is highlighted

option.breakdown[]
→ store-by-store breakdown

breakdown[].items[]
→ exact retailer products to buy

unknown_product_ids[]
→ basket product IDs that no longer exist / are stale
```

A single consistent baseline must be used for `savings`:

```txt
baseline = most expensive complete single-store basket
savings  = baseline - option.total
```

`total` and `savings` are `null` when that strategy cannot fulfil every known basket item (empty `breakdown`, `stores: 0`, `description: ""`). If no complete single-store basket exists, `savings` is `null` on every option. If the request has items but every `product_id` is unknown, `options` is `[]`.

`image_url` is `offer image → product image → null`.

---

### 4.5 Meta (implemented, not in the original page plan)

#### `GET /health`

No original page contract.

##### Current return (live API)

```json
{
  "status": "ok",
  "build_id": "...",
  "built_at": "2026-09-03T00:00:00Z",
  "product_count": 50000,
  "offer_count": 80000,
  "retailers": ["aldi", "coles", "harrisfarm", "woolworths"]
}
```

#### `GET /products/{id}/price-history`

Listed in §5.2 as a Price Insights extension. Implemented today.

```http
GET /products/{id}/price-history?days=30
```

##### Planned response

Not specified in §4.

##### Current return (live API)

404 if the product id does not exist.

```json
[
  {
    "product_id": "full-cream-milk-2l",
    "retailer": "coles",
    "points": [
      {
        "price": 3.10,
        "was_price": 4.20,
        "is_special": true,
        "recorded_at": "2026-09-01"
      }
    ]
  }
]
```

---

## 5. API & Product Extensions

### 5.1 Implemented `GET /products` Extension Parameters

The current document lists these additional parameters outside the core page flow:

```txt
q
tag
special
retailer
multi_retailer
```

Their live query-string behaviour is implemented (`backend/routes/products.py`). List-body JSON is the **Current return** under §4.2, not the planned `offers[]` example.

### 5.2 Full-App Extensions

These are outside the current core page flow but still build on the canonical `product_id` architecture.

- **Meals:** `GET /meals`, `GET /meals/{meal_id}`
- **Saved Lists:** list CRUD APIs
- **Receipt Import:** `POST /receipts/scan`
- **Price Insights:** `GET /products/{product_id}/price-history?days=30`, `GET /products/{product_id}/price-insights`
- **Authentication:** Supabase Auth is documented as the intended auth layer.

The detailed schemas for these extensions should live in their own contract once they become active frontend work.

---

## 6. Runtime & Deployment Reference

**IMPLEMENTED.** The API is live and this contract is enforced by tests.

- **Live API:** [https://basket.taskglass.work](https://basket.taskglass.work)
- **Swagger:** [https://basket.taskglass.work/docs](https://basket.taskglass.work/docs)
- **TypeScript types:**

```bash
npx openapi-typescript https://basket.taskglass.work/openapi.json -o src/api/schema.d.ts
```

### Current implementation notes

1. Harris Farm Markets was added as a fourth retailer. The `retailer` enum is now `"coles" | "woolworths" | "aldi" | "harrisfarm"`.
2. `Product` gained `min_price` and `retailer_count` so a product card can show `"from $x at N stores"` without a second request.
3. `CompareResponse` is `options[]` of three strategies (`recommended-split`, `cheapest-single-store`, `lowest-possible-price`) plus `unknown_product_ids`. `total` and `savings` are `number | null`. Until hpsrv is redeployed, production `basket.taskglass.work` still serves the old `stores[]` + `recommendation` shape.
4. `size_value` / `size_unit` are normalized to `g` / `ml` / `pk` / `ea`, so `1kg` and `1000g` compare equal. Display with `formatSize()` in `frontend/src/api/client.ts`.
5. The data source is a nightly-built read-only SQLite artifact (Schema B: `products` / `offers` / `price_history` plus `categories` / `subcategories` / `meta` / FTS), not live Supabase.
6. `GET /products` also supports the implemented query parameters `retailer` and `multi_retailer`.

---

## Appendix A. Retailer Taxonomy Mapping

> This appendix is for **scraping/backend normalization**.
>
> The frontend does **not** use `CATEGORY_MAP` or `SUBCATEGORY_MAP` directly.
>
> Frontend mapping is:
>
> ```txt
> canonical ID → display label
> ```
>
> and is returned by `GET /categories`.
>
> Example:
>
> ```txt
> Backend/internal:
> category    = dairy-eggs-fridge
> subcategory = milk
>
> GET /categories returns:
> Dairy, Eggs & Fridge
> └── Milk
>
> React displays the names but sends the IDs in API requests.
> ```
>
> Therefore there are two different mappings:
>
> 1. **Retailer → canonical mapping** below, used during scraping.
> 2. **Canonical ID → frontend label**, defined by `GET /categories`.


> Scraper/normalisation reference. You do not need to memorise this section to implement the core MVP API.

### A.1 Top-level Category Mapping

Retailer promotional/merchandising collections map to `None`. Preserve their source values but do not use them as `products.category`.

```python
CATEGORY_MAP = {
    "woolworths": {
        "Fruit & Veg": "fruit-vegetables",
        "Poultry, Meat & Seafood": "meat-seafood",
        "Deli": "deli-chilled",
        "Dairy, Eggs & Fridge": "dairy-eggs-fridge",
        "Bakery": "bakery",
        "Freezer": "frozen",
        "Snacks & Confectionery": "snacks-confectionery",
        "Pantry": "pantry",
        "Drinks": "drinks",
        "Beer, Wine & Spirits": "liquor",
        "Beauty": "health-beauty",
        "Personal Care": "health-beauty",
        "Health & Wellness": "health-beauty",
        "Cleaning & Maintenance": "cleaning-household",
        "Baby": "baby",
        "Pet": "pet",
        "Electronics": "electronics",
        "Home & Lifestyle": "home-garden",

        "International Foods": None,
        "Dinner": None,
        "Lunch Box": None,
        "Front of Store": None,
        "New": None,
        "Specials": None,
        "Everyday Market": None,
        "Healthylife": None,
        "Back to School": None,
    },
    "coles": {
        "Meat & Seafood": "meat-seafood",
        "Fruit & Vegetables": "fruit-vegetables",
        "Dairy, Eggs & Fridge": "dairy-eggs-fridge",
        "Bakery": "bakery",
        "Deli": "deli-chilled",
        "Pantry": "pantry",
        "Chips, Chocolates & Snacks": "snacks-confectionery",
        "Drinks": "drinks",
        "Liquorland": "liquor",
        "Frozen": "frozen",
        "Cleaning & Laundry": "cleaning-household",
        "Health & Beauty": "health-beauty",
        "Baby": "baby",
        "Pet": "pet",
        "Home & Garden": "home-garden",
        "Tobacco": "tobacco",

        "Dietary & World Foods": None,
        "Lunchbox": None,
        "Specials": None,
        "Big Pack Value": None,
        "Deliver More Range": None,
        "Down Down": None,
        "Fresh Specials": None,
    },
    "aldi": {
        "Fruit & Vegetable": "fruit-vegetables",
        "Fruits & Vegetables": "fruit-vegetables",
        "Meat & Seafood": "meat-seafood",
        "Deli": "deli-chilled",
        "Deli & Chilled Meats": "deli-chilled",
        "Dairy, Eggs & Fridge": "dairy-eggs-fridge",
        "Pantry": "pantry",
        "Bakery": "bakery",
        "Freezer": "frozen",
        "Drinks": "drinks",
        "Health & Beauty": "health-beauty",
        "Baby": "baby",
        "Cleaning & Household": "cleaning-household",
        "Pets": "pet",
        "Liquor": "liquor",
        "Snacks & Confectionery": "snacks-confectionery",

        "Higher Protein Food and Drink": None,
        "Front of Store": None,
        "Lower Prices": None,
        "Super Savers": None,
        "Limited Time Only": None,
        "The People's Picks": None,
        "People's Picks": None,
    },
}


def normalize_category(retailer: str, source_category: str | None) -> str | None:
    if source_category is None:
        return None
    return CATEGORY_MAP.get(retailer.lower().strip(), {}).get(source_category)
```

---

### A.2 Canonical Subcategories

Do not block scraping trying to map every subcategory perfectly.

```txt
scrape source values
↓
preserve source_category + source_subcategory
↓
apply known mapping
↓
known   → canonical subcategory
unknown → canonical subcategory = NULL
↓
add mapping later
```

```python
CANONICAL_SUBCATEGORIES = {
    "fruit-vegetables": [
        "fruit", "vegetables", "herbs", "salads", "prepared-vegetables",
    ],
    "meat-seafood": [
        "beef", "poultry", "lamb", "pork", "mince",
        "sausages-burgers", "seafood", "ham",
    ],
    "deli-chilled": [
        "deli-meat", "dips-antipasto", "chilled-meals",
    ],
    "dairy-eggs-fridge": [
        "milk", "long-life-milk", "eggs", "yoghurt", "cheese",
        "butter-margarine", "cream-custard",
    ],
    "bakery": [
        "bread", "wraps-flatbread", "cakes-desserts", "pastries",
    ],
    "pantry": [
        "breakfast", "pasta-rice-grains", "canned-food", "sauces",
        "condiments-dressings", "oils-vinegars", "spreads",
        "baking", "herbs-spices",
    ],
    "snacks-confectionery": [
        "chips", "chocolate", "lollies", "biscuits", "crackers", "nuts-dried-fruit",
    ],
    "frozen": [
        "frozen-vegetables", "frozen-fruit", "frozen-meals",
        "frozen-pizza", "frozen-meat", "frozen-seafood", "ice-cream",
    ],
    "drinks": [
        "water", "soft-drinks", "juice-cordial", "sports-energy",
        "iced-tea-kombucha", "tea-coffee", "flavoured-milk",
    ],
    "cleaning-household": [
        "laundry", "household-cleaning", "dishwashing",
        "bathroom-cleaning", "kitchen-cleaning", "paper-products",
        "food-storage", "air-fresheners", "pest-control",
    ],
    "health-beauty": [
        "personal-care", "skincare", "hair-care", "oral-care", "health", "beauty",
    ],
    "baby": ["baby-food", "baby-formula", "nappies-wipes", "baby-care"],
    "pet": ["dog", "cat", "pet-food", "pet-care"],
    "liquor": ["beer", "wine", "spirits", "cider-rtd"],
}
```

---

### A.3 Retailer Subcategory + Tag Mappings

Add exact source strings as they are discovered by the scrapers. Always preserve `source_subcategory` even if no canonical mapping exists yet.


#### Starter retailer → canonical tag mapping

Only map a retailer label to a tag when the label clearly represents an attribute rather than a product type.

```python
TAG_MAP = {
    "woolworths": {
        "Organic Meat & Poultry": ["organic"],
    },

    "coles": {
        "Halal": ["halal"],
        "Kosher Meat & Seafood": ["kosher"],
        "Organic Meat": ["organic"],
        "Gluten Free Range": ["gluten-free"],
        "Vegan Range": ["vegan"],
        "Vegetarian & Vegan": ["vegetarian", "vegan"],
        "Health Foods Sports Nutrition & Diet": [],
    },

    "aldi": {
        "Vegetarian & Vegan": ["vegetarian", "vegan"],
        "Higher Protein Food and Drink": ["high-protein"],
    },
}
```

Do **not** infer a tag blindly when a retailer collection may contain mixed products. Preserve the source string and verify against product-level data where possible.


```python
SUBCATEGORY_MAP = {
    "woolworths": {
        # Fruit & Veg
        "Fruit": "fruit",
        "Vegetables": "vegetables",
        "Salad": "salads",
        "Prepared Vegetables": "prepared-vegetables",

        # Poultry, Meat & Seafood
        "Poultry": "poultry",
        "Seafood": "seafood",
        "Mince": "mince",
        "BBQ Meat": "bbq-meat",
        "Roasts & Slow Cooked": "roasts-slow-cooked",

        # Deli
        "Deli Meats": "deli-meats",
        "Ham, Bacon & Smallgoods": "ham-bacon-smallgoods",
        "Sausages & Frankfurts": "sausages-frankfurts",
        "Deli Specialties": "deli-specialties",

        # Dairy, Eggs & Fridge
        "Milk": "milk",
        "Cheese": "cheese",
        "Yoghurt": "yoghurt",
        "Eggs": "eggs",
        "Cream, Custard & Desserts": "cream-custard-desserts",
        "Dips & Pate": "dips-pate",

        # Pantry
        "Breakfast & Spreads": "breakfast-spreads",
        "Muesli Bars & Snack Bars": "snack-bars",
        "Tea & Coffee": "tea-coffee",
        "Long Life Milk": "long-life-milk",
        "Baking": "baking",
        "Herbs & Spices": "herbs-spices",
        "Pasta, Rice & Grains": "pasta-rice-grains",
        "Cooking Sauces & Recipe Bases": "cooking-sauces",
        "Oil & Vinegar": "oils-vinegars",

        # Frozen
        "Frozen Seafood": "frozen-seafood",
        "Frozen Meat": "frozen-meat",
        "Frozen Pizzas": "frozen-pizza",
        "Frozen Vegetables": "frozen-vegetables",
        "Frozen Fruit": "frozen-fruit",
        "Ice Cream": "ice-cream",
        "Frozen Desserts": "frozen-desserts",

        # Drinks
        "Chilled Drinks": "chilled-drinks",
        "Soft Drinks": "soft-drinks",
        "Cordials, Juices & Iced Teas": "juice-cordial-iced-tea",
        "Water": "water",
        "Sports & Energy Drinks": "sports-energy",
        "Tea": "tea",
        "Coffee": "coffee",

        # Health & Wellness
        "Health Foods": "health-foods",
        "Vitamins": "vitamins-supplements",
        "Diet & Sports Nutrition": "sports-nutrition",
        "First Aid & Medicinal": "first-aid-medicinal",

        # Pet
        "Cat & Kitten": "cat",
        "Dog & Puppy": "dog",
        "Birds, Fish & Small Pets": "other-pets",
    },
    "coles": {
        "Fruit": "fruit",
        "Vegetables": "vegetables",
        "Herbs, Chillies & Sprouts": "herbs",
        "Packaged Salad": "salads",
        "Prepared Vegetable": "prepared-vegetables",
        "Beef & Veal": "beef",
        "Poultry": "poultry",
        "Bbq, Sausages & Burgers": "sausages-burgers",
        "Lamb": "lamb",
        "Pork": "pork",
        "Ham": "ham",
        "Mince": "mince",
        "Seafood": "seafood",
        "Milk": "milk",
        "Yoghurt": "yoghurt",
        "Cheese": "cheese",
        "Eggs": "eggs",
        "Butter & Margarine": "butter-margarine",
        "Long Life-Milk": "long-life-milk",
        "Cream & Custard": "cream-custard",
        "Breakfast": "breakfast",
        "Jams, Honey & Spreads": "spreads",
        "Oils & Vinegars": "oils-vinegars",
        "Sauces": "sauces",
        "Canned Food, Soups & Noodles": "canned-food",
        "Pasta, Rice, Legumes & Grains": "pasta-rice-grains",
        "Baking": "baking",
        "Herbs & Spices": "herbs-spices",
        "Ice Cream": "ice-cream",
        "Frozen Chicken, Beef & Pork": "frozen-meat",
        "Frozen Fish & Seafood": "frozen-seafood",
        "Frozen Fruit": "frozen-fruit",
        "Frozen Meals": "frozen-meals",
        "Frozen Pizza & Bases": "frozen-pizza",
        "Frozen Vegetables": "frozen-vegetables",
        "Laundry": "laundry",
        "Household Cleaning": "household-cleaning",
        "Dishwashing": "dishwashing",
        "Food Storage": "food-storage",
        "Air Fresheners & Home Fragrance": "air-fresheners",
        "Bathroom": "bathroom-cleaning",
        "Pest Control": "pest-control",
        "Toilet Paper, Tissues & Paper Towels": "paper-products",
    },
    "aldi": {
        "Fresh Fruits": "fruit",
        "Fresh Vegetables": "vegetables",
        "Fresh Herbs": "herbs",
        "Prepared Vegetables": "prepared-vegetables",
        "Salads": "salads",
        "Beef": "beef",
        "Lamb": "lamb",
        "Pork": "pork",
        "Poultry": "poultry",
        "Sausage": "sausages-burgers",
        "Seafood": "seafood",
        "Milk": "milk",
        "Long Life Milk": "long-life-milk",
        "Eggs": "eggs",
        "Cheese": "cheese",
        "Yogurt": "yoghurt",
        "Creams & Custards": "cream-custard",
        "Butter & Margarine": "butter-margarine",
        "Baking": "baking",
        "Canned Food": "canned-food",
        "Cereals & Muesli": "breakfast",
        "Condiments & Dressings": "condiments-dressings",
        "Crackers & Crisp Breads": "crackers",
        "Dried Fruits, Nuts & Jerky": "nuts-dried-fruit",
        "Herbs & Spices": "herbs-spices",
        "Jams & Spreads": "spreads",
        "Iced Tea & Kombucha": "iced-tea-kombucha",
        "Juices & Cordials": "juice-cordial",
        "Soft Drinks": "soft-drinks",
        "Sports & Energy": "sports-energy",
        "Tea, Coffee & Hot Chocolate": "tea-coffee",
        "Water": "water",
        "Air Fresheners & Fragrances": "air-fresheners",
        "Bathroom": "bathroom-cleaning",
        "Cleaning Home Essentials": "household-cleaning",
        "Kitchen": "kitchen-cleaning",
        "Laundry": "laundry",
        "Pest Control": "pest-control",
        "Toilet Paper, Tissues & Paper Towels": "paper-products",
        "Baby Food": "baby-food",
        "Baby Formula": "baby-formula",
        "Baby Nappies & Wipes": "nappies-wipes",
    },
}


def normalize_subcategory(retailer: str, source_subcategory: str | None) -> str | None:
    if source_subcategory is None:
        return None
    return SUBCATEGORY_MAP.get(retailer.lower().strip(), {}).get(source_subcategory)
```
