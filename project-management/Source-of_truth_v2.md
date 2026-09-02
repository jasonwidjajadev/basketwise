BasketWise Backend + API Architecture
Architecture principle: design the data model so it can support the full BasketWise product, but implement the smallest end-to-end MVP first.

MVP controls build priority, not what useful data we keep. If the scraper already provides useful metadata such as retailer IDs, images, original categories, availability, specials, URLs, or timestamps, keep it.

Supabase
↓
FastAPI
↓
React
↓
Shared Basket
↓
POST /compare
↓
Coles / Woolworths / ALDI totals + recommendation

0. Source of Truth Contract
This document is the contract between frontend, backend, database, and scraping/data work.

Rules
Do not invent new field names, API routes, category IDs, or response shapes independently.
If a required change is discovered, update this contract first, then update the implementation.
API JSON uses the field names defined here.
Frontend mock data must use the same shapes as the real API.
All parts of the app identify a grocery using the canonical product_id.
Retailer-specific IDs never go into the basket.
Categories shown in the frontend come from GET /categories.
Backend owns retailer mapping and price comparison logic.
Frontend owns temporary basket state for the MVP.
Useful scraped metadata should be preserved even if the first demo does not display it.
0.1 MVP Scope Contract
The minimum working user flow is:

Home / Browse
↓
Load canonical products
↓
Add products to shared basket
↓
Edit quantity / remove products
↓
POST /compare
↓
Show Coles / Woolworths / ALDI totals
↓
Show recommended option

Home must support
GET /products?essential=true&limit=20
↓
Render Everyday Essentials
↓
Add product to shared basket

Search can be added after the core flow:

GET /products?q=milk&limit=10
GET /products?tag=gluten-free&limit=24

Browse must support
GET /categories
↓
Render category navigation
↓
GET /products?limit=24&offset=0
↓
Render products
↓
User selects a category
↓
GET /products?category={category_id}&limit=24&offset=0
↓
Render filtered products
↓
Add product to same shared basket

Compare must support
Shared basket
↓
POST /compare
↓
Render retailer totals
↓
Render recommendation

0.2 Canonical Category + Subcategory Contract
The frontend must not know or reproduce Woolworths/Coles/ALDI taxonomy mappings.

Retailer taxonomy mapping happens during scraping/backend normalization:

Woolworths / Coles / ALDI source category
↓
CATEGORY_MAP / SUBCATEGORY_MAP
↓
BasketWise canonical category + subcategory IDs
↓
GET /categories
↓
React displays canonical labels

Each canonical category has:

type Subcategory = {
  id: string
  name: string
}

type Category = {
  id: string
  name: string
  subcategories: Subcategory[]
}

Example:

{
  "id": "dairy-eggs-fridge",
  "name": "Dairy, Eggs & Fridge",
  "subcategories": [
    { "id": "milk", "name": "Milk" },
    { "id": "eggs", "name": "Eggs" },
    { "id": "yoghurt", "name": "Yoghurt" },
    { "id": "cheese", "name": "Cheese" }
  ]
}

Rules:

category.id is the stable internal value stored in products.category.
category.name is what React displays.
subcategory.id is the stable internal value stored in products.subcategory.
subcategory.name is what React displays.
Frontend must not convert "dairy-eggs-fridge" into "Dairy, Eggs & Fridge" itself.
Frontend must not maintain a separate competing category/subcategory label map.
GET /categories is the source of truth for both IDs and display labels.
Scraped retailer categories/subcategories are preserved separately in offers.source_category and offers.source_subcategory.
Unknown retailer subcategories may normalize to null until a canonical mapping is added.
0.2.1 Canonical Tag Contract
Tags use stable internal IDs and are stored directly on products.tags.

type Product = {
  // ...
  tags: string[]
}

Example:

{
  "tags": ["gluten-free", "vegan"]
}

Canonical starting tags:

TAGS = {
    "organic": "Organic",
    "halal": "Halal",
    "kosher": "Kosher",
    "vegan": "Vegan",
    "vegetarian": "Vegetarian",
    "gluten-free": "Gluten Free",
    "high-protein": "High Protein",
    "lactose-free": "Lactose Free",
}

Rules:

Store tag IDs such as gluten-free in products.tags.
Frontend can map the stable tag ID to the human-readable label when it needs to display tags.
A product can have zero, one, or many tags.
Tags describe attributes and do not replace category/subcategory.
special, half-price, and similar promotions belong on offers, not in products.tags.
For the MVP, do not create separate tags or product_tags tables.

0.3 Product Contract
A canonical BasketWise product represents what the user wants to buy, not a specific retailer listing.

API / frontend shape
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
}

Example:

{
  "id": "full-cream-milk-2l",
  "name": "Full Cream Milk",
  "category": "dairy-eggs-fridge",
  "subcategory": "milk",
  "tags": [],
  "size_value": 2,
  "size_unit": "L",
  "image_url": "/images/milk.webp",
  "is_essential": true
}

Rules:

id must be stable.
Home, Browse, Search, Meals, Basket, Compare and future Lists all use this same id.
Frontend mock products must match this shape exactly.
Do not use retailer product IDs as canonical product IDs.
category must use a BasketWise canonical category ID.
subcategory can be null when a reliable canonical mapping does not exist yet.
A product can have zero or more canonical tags.
Tags describe attributes such as dietary/lifestyle claims; they do not replace category/subcategory.
0.4 Offer / Mapping Contract
An offer represents the mapping from one canonical BasketWise product to one real retailer listing.

Example relationship:

products
Full Cream Milk 2L
        ↓
offers
├── Woolworths Full Cream Milk 2L
├── Coles Full Cream Milk 2L
└── ALDI Farmdale Full Cream Milk 2L

Database/data shape
type Offer = {
  id: string
  product_id: string
  retailer: "coles" | "woolworths" | "aldi"
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

Rules:

product_id must reference products.id.
Preserve retailer metadata if the scraper provides it.
price is the current price used by POST /compare.
Specials belong to the retailer offer, not to products.category.
The scraper should use a stable retailer product ID when available so the same offer can be upserted instead of duplicated.
0.5 Price History Contract
Each scraping cycle creates a historical observation for the retailer offer.

type PriceHistory = {
  id: string
  offer_id: string
  price: number
  was_price: number | null
  is_special: boolean | null
  special_type: string | null
  recorded_at: string
}

Rules:

offer_id references offers.id.
Updating offers.price must not replace historical observations.
The scraper updates the current offers row and inserts a new price_history row.
One observation per offer per scraping period/day is enough initially.
0.6 Basket Contract
For the MVP, the basket is shared React state.

Basket item shape
type BasketItem = {
  product_id: string
  quantity: number
}

Example:

{
  "product_id": "full-cream-milk-2l",
  "quantity": 2
}

Rules:

Basket stores canonical product_id only.
Do not store offer_id in the basket.
Do not store Coles/Woolworths/ALDI-specific product IDs in the basket.
Home, Browse, Search and Meals all add into the same basket.
quantity must be greater than 0.
Removing the last unit removes the basket item.
Basket persistence to the backend is not required for the first demo.
Essentials ─┐
Browse ─────┼──→ BasketItem[] ───→ POST /compare
Search ─────┤
Meals ──────┘

0.7 API Contract
GET /categories
Request:

GET /categories

Returns canonical categories and their frontend display labels/subcategories.

Response:

[
  {
    "id": "fruit-vegetables",
    "name": "Fruit & Vegetables",
    "subcategories": [
      { "id": "fruit", "name": "Fruit" },
      { "id": "vegetables", "name": "Vegetables" },
      { "id": "herbs", "name": "Herbs" }
    ]
  },
  {
    "id": "dairy-eggs-fridge",
    "name": "Dairy, Eggs & Fridge",
    "subcategories": [
      { "id": "milk", "name": "Milk" },
      { "id": "eggs", "name": "Eggs" },
      { "id": "yoghurt", "name": "Yoghurt" },
      { "id": "cheese", "name": "Cheese" }
    ]
  }
]

Response type:

type Subcategory = {
  id: string
  name: string
}

type Category = {
  id: string
  name: string
  subcategories: Subcategory[]
}

Frontend usage:

GET /categories
↓
category.id   = dairy-eggs-fridge
category.name = Dairy, Eggs & Fridge

subcategory.id   = milk
subcategory.name = Milk

The frontend uses the IDs in API requests and the names for display.

GET /products
Supported query parameters:

Parameter	Example	Meaning
essential	true	Only Home Essentials
category	fruit-vegetables	Filter using canonical category ID
subcategory	vegetables	Filter using canonical subcategory ID
tag	gluten-free	Optional filter using canonical tag ID
q	milk	Search canonical product names
special	true	Products with at least one relevant special offer
limit	24	Maximum number returned
offset	0	Number of matching products skipped
Examples:

GET /products?essential=true&limit=20
GET /products?limit=24&offset=0
GET /products?category=fruit-vegetables&limit=24&offset=0
GET /products?category=fruit-vegetables&subcategory=vegetables&limit=24&offset=0
GET /products?q=milk&limit=10
GET /products?tag=gluten-free&limit=24

Response type:

Product[]

Example response:

[
  {
    "id": "full-cream-milk-2l",
    "name": "Full Cream Milk",
    "category": "dairy-eggs-fridge",
    "subcategory": "milk",
    "size_value": 2,
    "size_unit": "L",
    "image_url": "/images/milk.webp",
    "is_essential": true
  }
]

Behaviour:

No matching products → return [].
category receives canonical BasketWise category IDs, not retailer category strings.
Default pagination should be bounded. Do not return the entire 20k+ catalogue in one response.
POST /compare
Request type:

type CompareRequest = {
  items: BasketItem[]
}

Request:

{
  "items": [
    {
      "product_id": "full-cream-milk-2l",
      "quantity": 1
    },
    {
      "product_id": "white-bread-700g",
      "quantity": 2
    }
  ]
}

Response type:

type StoreComparison = {
  retailer: "coles" | "woolworths" | "aldi"
  total: number
  missing_product_ids: string[]
}

type CompareResponse = {
  stores: StoreComparison[]
  recommendation: {
    retailer: "coles" | "woolworths" | "aldi"
    total: number
  } | null
}

Example:

{
  "stores": [
    {
      "retailer": "coles",
      "total": 14.20,
      "missing_product_ids": []
    },
    {
      "retailer": "woolworths",
      "total": 14.60,
      "missing_product_ids": []
    },
    {
      "retailer": "aldi",
      "total": 12.80,
      "missing_product_ids": []
    }
  ],
  "recommendation": {
    "retailer": "aldi",
    "total": 12.80
  }
}

Rules:

Backend performs all retailer price lookup and total calculations.
Frontend must not calculate retailer totals independently.
If the basket changes, call this endpoint again.
Missing products must be returned explicitly rather than silently ignored.
Recommendation logic must use the same comparison result returned to the frontend.
0.8 Mock Data Contract
Until real scraped data is ready, every layer develops against a shared fixture that uses the exact production contract.

Recommended fixtures:

mock/
├── categories.json
├── products.json
└── offers.json

Minimum useful fixture:

20-30 canonical products
↓
all canonical category IDs represented
↓
at least 5 canonical products with:
  Coles offer
  Woolworths offer
  ALDI offer
↓
enough data to test POST /compare

Rules:

Do not create one mock product shape for frontend and another for backend.
products.json must match Product, including tags: [] when there are no canonical tags.
offers.json must match Offer.
Mock IDs should be treated as stable IDs and reused when seeding Supabase.
When Supabase is connected, the API should return the same JSON shape the frontend already consumed from mocks.
0.9 Page Behaviour Contract
Home
Done when:

GET /products?essential=true&limit=20
↓
render ProductCards
↓
click Add
↓
canonical product_id enters shared basket
↓
basket count/state updates

Search is the next priority:

search "milk"
↓
GET /products?q=milk&limit=10
GET /products?tag=gluten-free&limit=24
↓
render matching canonical products

Browse
Done when:

GET /categories
↓
render categories
↓
GET /products?limit=24&offset=0
↓
render first products
↓
click Fruit & Vegetables
↓
GET /products?category=fruit-vegetables&limit=24&offset=0
↓
render only matching products
↓
optional: click Vegetables subcategory
↓
GET /products?category=fruit-vegetables&subcategory=vegetables&limit=24&offset=0
↓
render only matching subcategory products
↓
Add
↓
same shared basket updates

Compare
Done when:

shared basket
↓
POST /compare
↓
render Coles total
render Woolworths total
render ALDI total
↓
render recommendation

0.10 Definition of Done Contract
A task is not considered complete because someone has “worked on it”.

Every assigned task must have:

Task
Owner
Deadline
Definition of Done
Reviewer

Example:

Task:
GET /products category filtering

Owner:
<name>

Deadline:
Sunday 6pm

Definition of Done:
- GET /products?category=fruit-vegetables works
- accepts canonical category ID
- only matching products returned
- response matches Product[]
- empty result returns []
- tested through FastAPI /docs

Reviewer:
Brandan

Frontend task definition
A frontend task is done when:

required interaction works
it consumes the contract defined in this document
no duplicate local version of the same contract is introduced
no obvious TypeScript/build errors
PR opened for review
Backend task definition
A backend task is done when:

endpoint works through /docs
request/response matches this contract
data comes from the agreed source
expected empty/error case does not crash
PR opened for review
Data/scraping task definition
A data task is done when:

output uses agreed field names
source taxonomy is preserved
known categories/subcategories are normalized
retailer IDs are preserved when available
rows can be inserted/upserted into the agreed schema
no new schema is invented independently
0.11 Git + Ownership Contract
One task = one branch = one PR.
Do not push feature work directly to main.
One task has one primary owner.
One task has one reviewer.
If two areas need to agree on a shape, this document is the source of truth.
Trainees should not wait for another trainee to answer an architecture question. Ask Jason or Brandan.
If implementation reveals that the contract needs to change, update/agree the contract before multiple people build different versions.
Example branches:

feature/product-card
feature/products-api
feature/category-filter
feature/mock-products

0.12 Contract Change Rule
If someone needs something not defined here:

1. Identify the missing requirement
2. Ask Jason / Brandan
3. Agree the change
4. Update this source-of-truth document
5. Then implement it

Do not solve contract ambiguity by creating a second local convention.

1. Core API
The first working version needs 3 core routes.

GET /categories
Returns BasketWise canonical categories.

Used by:

Browse sidebar
Categories page
Any other category navigation
Example:

[
  { "id": "fruit-vegetables", "name": "Fruit & Vegetables" },
  { "id": "meat-seafood", "name": "Meat & Seafood" },
  { "id": "dairy-eggs-fridge", "name": "Dairy, Eggs & Fridge" }
]

The backend is the single source of truth for category IDs and frontend labels.

GET /products
Returns canonical BasketWise products.

Supported query parameters:

essential
category
subcategory
tag
q
special
limit
offset

Examples:

GET /products?essential=true&limit=20
GET /products?limit=24&offset=0
GET /products?category=fruit-vegetables&limit=24&offset=0
GET /products?category=fruit-vegetables&limit=24&offset=24
GET /products?q=milk&limit=10
GET /products?tag=gluten-free&limit=24
GET /products?special=true&limit=24&offset=0

special is a retailer-offer state, not a canonical category.

POST /compare
Receives the current basket and returns retailer totals + recommendation.

Example request:

{
  "items": [
    { "product_id": "full-cream-milk-2l", "quantity": 1 },
    { "product_id": "spaghetti-500g", "quantity": 1 }
  ]
}

Example response shape:

{
  "stores": [
    {
      "retailer": "coles",
      "total": 14.20,
      "missing_product_ids": []
    },
    {
      "retailer": "woolworths",
      "total": 14.60,
      "missing_product_ids": []
    },
    {
      "retailer": "aldi",
      "total": 12.80,
      "missing_product_ids": []
    }
  ],
  "recommendation": {
    "retailer": "aldi",
    "total": 12.80
  }
}

If the basket changes, React updates the basket and calls POST /compare again.

2. Page-by-page API usage
Home
GET /products?essential=true&limit=20

Load 20 curated Everyday Essentials.
After the core Home flow works:

GET /products?q=milk&limit=10
GET /products?tag=gluten-free&limit=24

Search matching canonical products.
Meals
For the first demo, curated meals can stay in frontend data:

{
  id: "spaghetti-bolognese",
  ingredients: [
    { product_id: "spaghetti-500g", quantity: 1 },
    { product_id: "beef-mince-500g", quantity: 1 },
    { product_id: "tomato-passata-700g", quantity: 1 }
  ]
}

Click Add meal → add all canonical product_ids to the same shared basket.

The full architecture can later move meals to meals + meal_items and expose them through GET /meals.

Browse
GET /categories
GET /products?limit=24&offset=0
GET /products?category=fruit-vegetables&limit=24&offset=0
GET /products?category=fruit-vegetables&limit=24&offset=24
GET /products?q=milk&limit=24&offset=0

Basket
Basket state is client-side for the first implementation.

{
  "product_id": "full-cream-milk-2l",
  "quantity": 1
}

Essentials ─┐
Browse ─────┼→ Shared React Basket → POST /compare
Meals ──────┘

If saved baskets/lists are enabled later, the same item shape can be persisted through list APIs.

Compare
POST /compare

Backend:

receives canonical product_ids + quantities
looks up matching retailer rows in offers
calculates retailer totals
handles unavailable/missing products consistently
returns totals + recommendation
Frontend:

sends current shared basket
renders totals
renders recommended option
3. Core Database Schema
The grocery/pricing architecture uses 3 tables:

products
   ↓ 1-to-many
offers
   ↓ 1-to-many
price_history

Why 3 tables?
products = what the user wants to buy
offers = mapping table from canonical product to exact retailer product + current state
price_history = historical observations for each retailer offer
products.tags = canonical product attributes that do not belong in the category hierarchy
Example:

Full Cream Milk 2L                     products
│
├── Woolworths Full Cream Milk 2L      offers
│   ├── 29 Aug  $3.50                  price_history
│   ├── 30 Aug  $3.50
│   └── 31 Aug  $3.10
│
├── Coles Full Cream Milk 2L           offers
└── ALDI Farmdale Full Cream Milk 2L   offers

3.1 products
Canonical BasketWise groceries.

Supabase/PostgreSQL type for tags:

tags TEXT[] NOT NULL DEFAULT '{}'

Example:

tags = {"gluten-free", "vegan"}

Field	Keep?	Why
id	REQUIRED	Stable canonical ID used by basket, meals, lists and offers
name	REQUIRED	Display + search
category	REQUIRED	Canonical BasketWise category ID
subcategory	KEEP	More precise Browse/search/mapping later
tags	KEEP	PostgreSQL TEXT[]; canonical product attributes such as organic, halal, vegan, gluten-free, high-protein
size_value	REQUIRED	Distinguishes 1L vs 2L etc.
size_unit	REQUIRED	L, kg, g, each, etc.
image_url	REQUIRED	Product cards on Home/Browse/Search
is_essential	REQUIRED	Determines whether product appears in Home Essentials
essential_rank	KEEP	Lets backend control curated ordering if desired
is_active	KEEP	Lets products be hidden without deleting mappings/history
search_terms	OPTIONAL / DERIVED	Useful later for aliases or better search
Example:

id: full-cream-milk-2l
name: Full Cream Milk
category: dairy-eggs-fridge
subcategory: milk
size_value: 2
size_unit: L
image_url: /images/milk.webp
tags: ["lactose-free"]
is_essential: true
essential_rank: 1
is_active: true

3.2 offers
Mapping table: canonical BasketWise product → exact retailer product + current retailer state.

Field	Keep?	Why
id	REQUIRED	Unique retailer offer/mapping row
product_id	REQUIRED	FK → products.id
retailer	REQUIRED	coles, woolworths, aldi
retailer_product_id	KEEP IF SCRAPED	Stable retailer SKU; useful for matching and upserts
retailer_product_name	REQUIRED	Exact retailer listing name
retailer_brand	KEEP IF SCRAPED	Useful for matching and display
source_category	KEEP IF SCRAPED	Original retailer taxonomy for traceability
source_subcategory	KEEP IF SCRAPED	Original retailer taxonomy for traceability
price	REQUIRED	Current price used by Compare
was_price	KEEP IF SCRAPED	Original/non-sale price
is_special	KEEP IF SCRAPED	Allows Specials UI and price analysis
special_type	KEEP IF SCRAPED	Promotion type if provided
special_end_date	KEEP IF SCRAPED	Useful for “buy before” recommendations
size_value	KEEP IF SCRAPED / REQUIRED FOR MATCHING	Retailer pack size
size_unit	KEEP IF SCRAPED / REQUIRED FOR MATCHING	Retailer pack unit
unit_price	KEEP IF SCRAPED	Useful for value comparison across pack sizes
product_url	KEEP IF SCRAPED	Source, debugging, click-through
image_url	KEEP IF SCRAPED	Retailer-specific image and fallback imagery
is_available	KEEP IF SCRAPED	Supports availability-aware comparison
last_updated	REQUIRED	Tracks freshness of current retailer state
Specials
Specials is not a canonical category.

product.category = dairy-eggs-fridge

offer.price = 3.10
offer.was_price = 4.20
offer.is_special = true
offer.special_type = "special"
offer.special_end_date = ...

3.3 price_history
Historical observations for each retailer-specific offer.

Field	Keep?	Why
id	REQUIRED	Unique observation
offer_id	REQUIRED	FK → offers.id
price	REQUIRED	Observed current price
was_price	KEEP IF SCRAPED	Historical promotion analysis
is_special	KEEP IF SCRAPED	Tracks promotion periods
special_type	KEEP IF SCRAPED	Retains promotion type over time
recorded_at	REQUIRED	Observation timestamp
Each scraper run:

1. UPSERT canonical product if appropriate
2. UPSERT retailer offer using retailer + retailer_product_id
3. UPDATE current offer state
4. INSERT price_history observation

This supports later:

current vs historical price
7/30/90-day averages
historical lows
sale frequency
promotion duration
possible “wait a few days” recommendations
4. Category Architecture
BasketWise does not use retailer taxonomy directly.

Woolworths: Fruit & Veg
Coles:      Fruit & Vegetables
ALDI:       Fruit & Vegetable
             ↓
BasketWise: fruit-vegetables
             ↓
Frontend:   Fruit & Vegetables

Keep raw retailer taxonomy:

offers.source_category
offers.source_subcategory

Keep canonical BasketWise taxonomy:

products.category
products.subcategory

The raw retailer taxonomy is never thrown away.

Canonical categories + frontend labels
The backend is the single source of truth:

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

Frontend calls GET /categories, displays name, and uses id for filtering.

5. Full-App Extensions
These build on the same canonical product_id architecture.

Meals
meals
- id
- name
- description
- image_url
- is_featured
- is_active

meal_items
- meal_id
- product_id
- quantity

Possible API:

GET /meals
GET /meals/{meal_id}

Saved Lists
lists
list_items

Possible API:

GET    /lists
POST   /lists
GET    /lists/{list_id}
PUT    /lists/{list_id}
DELETE /lists/{list_id}

Receipt Import
POST /receipts/scan

Flow:

receipt image/PDF
↓
OCR / receipt parsing
↓
retailer line items
↓
match to canonical product_id
↓
frontend confirmation
↓
shared basket

If persisted later:

receipt_imports
receipt_items

Price Insights
Possible APIs:

GET /products/{product_id}/price-history?days=30
GET /products/{product_id}/price-insights

Possible outputs:

current price
historical averages
historical low
promotion frequency
likely upcoming discount
buy-now / wait recommendation
Authentication
Use Supabase Auth.

Application tables such as saved lists can reference the Supabase user ID.

6. Fastest MVP Workflow
The architecture above stays, but implementation happens in this order.

1. [BACKEND / DATABASE]
   Finalise core schema
   - products
   - offers
   - price_history
   - `products.tags` stored as `TEXT[]`
            ↓
2. [BACKEND / DATABASE]
   Create Supabase tables
            ↓
3. [BACKEND / DATA]
   Seed mock data
   - 20-30 canonical products
   - retailer offer mappings/current prices
   - initial price_history observations
            ↓
4. [BACKEND]
   Connect FastAPI → Supabase using SQLAlchemy
            ↓
5. [BACKEND]
   Build + test:
   - GET /categories
   - GET /products
            ↓
6. [FRONTEND]
   React calls:
   - GET /categories
   - GET /products
   Render category navigation + ProductCards
            ↓
7. [BACKEND + FRONTEND]
   Add category filtering:
   GET /products?category=...
            ↓
8. [FRONTEND]
   Shared basket:
   - add/remove/change quantity
   - canonical product_id + quantity
            ↓
9. [BACKEND + FRONTEND]
   Build:
   POST /compare
   Compare page
            ↓
10. [DATA]
    Replace/expand seed data with scraped data
    - scrape
    - preserve raw metadata
    - normalise categories/subcategories
    - map retailer items to canonical products
    - upsert offers
    - insert price_history
            ↓
11. [AFTER CORE FLOW WORKS]
    Add search, meals, specials, saved lists,
    receipt import, price insights, etc.

Minimum demo milestone
Supabase seed data
↓
FastAPI GET /categories + GET /products
↓
React renders categories + products
↓
User adds products to shared basket
↓
POST /compare
↓
Compare page shows retailer totals + recommendation

Do not wait for the scraper to be complete before reaching this milestone.

7. Implementation Priority
Architecture
Keep useful scraped data and design relationships properly for the full product.

MVP implementation
First prove:

Browse / Essentials
↓
Basket
↓
Compare
↓
Recommendation

Then add:

search
specials UI
meals
saved lists
receipt import
historical-price recommendations
without redesigning the core grocery/pricing tables.

Taxonomy Decision Rule: Category vs Subcategory vs Tag vs Offer Metadata
When normalizing scraped retailer taxonomy:

Category
Use for the broad type of product.

meat-seafood
dairy-eggs-fridge
pantry
frozen

Subcategory
Use for what the product actually is.

beef
poultry
milk
eggs
pasta-rice-grains
frozen-vegetables

Tag
Use for product attributes that can overlap multiple categories/subcategories.

organic
halal
kosher
vegan
vegetarian
gluten-free
high-protein

Offer metadata
Use for retailer-specific commercial state.

is_special
special_type
special_end_date
was_price
is_available

Examples:

Coles "Organic Meat"
→ category: meat-seafood
→ subcategory: determined from product itself, e.g. beef/mince
→ tag: organic

Coles "Halal"
→ category: meat-seafood
→ subcategory: determined from product itself
→ tag: halal

ALDI "Vegetarian & Vegan"
→ canonical category/subcategory based on the actual product
→ tag: vegetarian and/or vegan only when the product data supports it

Woolworths "Fruit & Veg Specials & Offers"
→ keep source taxonomy
→ canonical category based on the product
→ offer.is_special = true when the scraped offer indicates a promotion
→ do not create a `specials` category or product tag

Important: retailer taxonomy alone may be too broad to infer the exact subcategory/tag safely. Preserve the source value and leave canonical fields null when uncertain rather than inventing a mapping.

Appendix: Retailer Category + Subcategory Mapping
This appendix is for scraping/backend normalization.

The frontend does not use CATEGORY_MAP or SUBCATEGORY_MAP directly.

Frontend mapping is:

canonical ID → display label

and is returned by GET /categories.

Example:

Backend/internal:
category    = dairy-eggs-fridge
subcategory = milk

GET /categories returns:
Dairy, Eggs & Fridge
└── Milk

React displays the names but sends the IDs in API requests.

Therefore there are two different mappings:

Retailer → canonical mapping below, used during scraping.
Canonical ID → frontend label, defined by GET /categories.
Scraper/normalisation reference. You do not need to memorise this section to implement the core MVP API.

1. Top-level category mapping
Retailer promotional/merchandising collections map to None. Preserve their source values but do not use them as products.category.

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

2. Canonical subcategories
Do not block scraping trying to map every subcategory perfectly.

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

3. Starter subcategory mappings
Add exact source strings as they are discovered by the scrapers. Always preserve source_subcategory even if no canonical mapping exists yet.

Starter retailer → canonical tag mapping
Only map a retailer label to a tag when the label clearly represents an attribute rather than a product type.

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

Do not infer a tag blindly when a retailer collection may contain mixed products. Preserve the source string and verify against product-level data where possible.

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