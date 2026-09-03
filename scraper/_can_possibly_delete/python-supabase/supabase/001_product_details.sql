-- Richer per-product fields collected by hyperscrape's detail phase.
-- Complements the existing store_products / price_history tables.
create table if not exists product_details (
  store_product_id bigint primary key references store_products(id) on delete cascade,
  barcode text,
  was_price numeric,
  save_amount numeric,
  unit_price numeric,
  unit_measure text,
  unit_price_str text,
  retail_limit int,
  promo_limit int,
  in_stock boolean,
  ingredients text,
  allergens text,
  allergens_may text,
  dietary text,
  nutrition jsonb,
  images jsonb,
  country_of_origin text,
  health_star real,
  rating_avg real,
  rating_count int,
  long_description text,
  url text,
  deprecated boolean default false,
  updated_at timestamptz default now()
);
create index if not exists idx_product_details_barcode on product_details (barcode);
