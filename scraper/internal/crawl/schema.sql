PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA temp_store=MEMORY;
PRAGMA cache_size=-65536;

CREATE TABLE IF NOT EXISTS products (
  store TEXT NOT NULL,
  product_id TEXT NOT NULL,
  name TEXT, brand TEXT, size TEXT, description TEXT, long_description TEXT,
  price_cents INTEGER, was_price_cents INTEGER, save_cents INTEGER,
  unit_price_cents INTEGER, unit_measure TEXT, unit_price_str TEXT,
  in_stock INTEGER, available INTEGER, is_weighted INTEGER, is_market INTEGER,
  retail_limit INTEGER, promo_limit INTEGER,
  barcode TEXT, dept TEXT, category TEXT, aisle TEXT, category_path TEXT,
  image_urls TEXT,
  ingredients TEXT, allergens TEXT, allergens_may TEXT, dietary TEXT, nutrition TEXT,
  country_of_origin TEXT, health_star REAL, rating_avg REAL, rating_count INTEGER,
  url TEXT,
  listing_json BLOB, detail_json BLOB, content_hash INTEGER,
  first_seen TEXT, last_seen TEXT, detail_fetched_at TEXT,
  deprecated INTEGER DEFAULT 0,
  PRIMARY KEY (store, product_id)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_detail ON products(store, detail_fetched_at);

CREATE TABLE IF NOT EXISTS price_history (
  store TEXT NOT NULL, product_id TEXT NOT NULL, ts TEXT NOT NULL,
  price_cents INTEGER, was_price_cents INTEGER,
  PRIMARY KEY (store, product_id, ts)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS categories (
  store TEXT NOT NULL, node_id TEXT NOT NULL, path TEXT, name TEXT,
  total INTEGER, pages INTEGER, done INTEGER DEFAULT 0, updated TEXT,
  PRIMARY KEY (store, node_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS crawl_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store TEXT, phase TEXT, started TEXT, finished TEXT,
  listed INTEGER, detailed INTEGER, dupes INTEGER, unchanged INTEGER,
  errors INTEGER, backoffs INTEGER, peak_rate REAL, bytes INTEGER
);
