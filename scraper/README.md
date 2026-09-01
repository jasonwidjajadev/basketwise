# Basketwise Scraper

This folder contains the web scrapers used to collect grocery product information from Woolworths and Coles and save the results into a Supabase database.

## What the scraper does

The scraper collects product information such as:

* Product name
* Product ID
* Brand
* Description
* Price
* Package size
* Product image
* Category
* Store

The scraped products are then saved into Supabase so they can later be used by the Basketwise application.

---

## Main Files

### woolworths.py

This file contains the Woolworths scraper.

It:
1. Goes through the Woolworths categories.
2. Requests each page of products.
3. Extracts the product information.
4. Removes duplicate products.
5. Sends each completed page of products to `import_products.py`.

Woolworths products are saved to Supabase page by page.

---

### coles.py

This file contains the Coles scraper.

It:
1. Opens the Coles website.
2. Finds the current Next.js build ID used by Coles.
3. Goes through the selected Coles categories.
4. Requests each page of products.
5. Extracts useful product information.
6. Removes duplicate products.
7. Returns one list containing all unique Coles products.

The main function is:
```python
scrape_coles()
```

For testing, a page limit can also be supplied:

```python
scrape_coles(max_pages_per_category=2)
```
This would scrape only two pages from each category.
---

### import_products.py

This file connects the Woolworths and Coles scrapers to Supabase.

It:
1. Runs the Woolworths scraper.
2. Saves Woolworths products and prices to Supabase.
3. Runs the Coles scraper.
4. Splits Coles products into smaller batches.
5. Saves the Coles products and prices to Supabase.
6. Retries some Supabase requests if a temporary connection error occurs.

The overall flow is:

```text
Woolworths / Coles
        ↓
      Scraper
        ↓
import_products.py
        ↓
     Supabase
```

---

## Supabase Tables

### stores

Stores information about each supermarket.
Example:
| id | code       | name       |
| -- | ---------- | ---------- |
| 1  | woolworths | Woolworths |
| 2  | coles      | Coles      |

---

### store_products

Stores the actual grocery products.
Example:
| id  | store_id | external_product_id | name            | package_size |
| --- | -------- | ------------------- | --------------- | ------------ |
| 101 | 1        | 807383              | Full Cream Milk | 2L           |

Each product is connected to a store using store_id.

Products are upserted using:
store_id + external_product_id

This means an existing product is updated instead of creating another duplicate product row.

---

### price_history

Stores product prices.

Example:

| id | store_product_id | price |
| -- | ---------------- | ----- |
| 1  | 101              | 3.90  |

`store_product_id` connects the price to a product inside `store_products`.

This table can later be used to track how product prices change over time.

---

## Product Saving

### Woolworths

Woolworths products are saved after every page is scraped.

```text
Page 1
↓
Save to Supabase

Page 2
↓
Save to Supabase

Page 3
↓
Save to Supabase
```

### Coles

Coles products are first collected and then saved in batches.

For example, with:

```python
BATCH_SIZE = 100
```

the products are saved like:

```text
Products 1–100
↓
Supabase

Products 101–200
↓
Supabase

Products 201–300
↓
Supabase
```
Using batches avoids sending thousands of products to Supabase in one large request.

---

## Retry System

`import_products.py` contains:

```python
execute_with_retry()
```

This is not part of the scraping itself.
It is used when communicating with Supabase.
If a temporary network problem occurs, the request is retried several times instead of immediately stopping the entire program.

For example:
```text
Supabase request fails
        ↓
wait 1 second
        ↓
try again
        ↓
wait 2 seconds
        ↓
try again
```
---

## Setup

Install the required Python packages:

```bash
pip install requests python-dotenv supabase httpx
```
Create a `.env` file containing the required Supabase details and any scraper configuration values.

For example:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```
A fallback Coles build ID can also be stored if required:
```env
COLES_BUILD_ID=your_build_id
```

---

## Running the Scrapers

To test only the Coles scraper:

```bash
python coles.py
```
To run the full import process:

```bash
python import_products.py
```

Running `import_products.py` will:

```text
1. Scrape Woolworths
2. Save Woolworths products
3. Save Woolworths prices
4. Scrape Coles
5. Save Coles products
6. Save Coles prices
```

---