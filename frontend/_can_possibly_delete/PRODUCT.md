# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Everyday Australian household shoppers doing their regular weekly grocery shop, trying to spend less without a lot of manual effort (no power-user or business/bulk-buyer audience confirmed).

## Product Purpose

BasketWise helps Australian shoppers find the cheapest way to buy their groceries by comparing prices across major supermarket chains, so a weekly shop costs less than picking one store out of habit.

## Positioning

Grocery price comparison across multiple Australian retailers, built around the shopper's own basket (not a single "cheapest item" list) and framed as independent of retailer influence — no retailer commissions or placement fees, so a cheaper option elsewhere is never hidden. Specific figures currently shown in the UI (product counts, match-rate percentages, postcode coverage) are placeholder copy, not confirmed claims — do not treat as evidence.

## Operating Context

Shopper compares prices, builds a basket, and decides whether to shop at one store or split the basket across stores. Intended feature directions reflected in current UI content — price comparison, receipt scanning, and turning saved meals into a basket — are the product's intended shape, but unconfirmed in detail beyond that; no specific accuracy/coverage numbers are confirmed.

## Capabilities and Constraints

- Frontend is a standalone React 19 + Vite + Tailwind v4 app (`frontend/`) with no API backend wired to it — it reads only mock data from `src/data/*`.
- `backend/interfaces/types.py` is a draft/notes-only sketch of domain types (Franchise, Store, Item, StockRecord, Category) — not a running service. `backend/contracts.py` and `backend/README.md` are empty placeholders.
- `scraper/` is a real, working Python data pipeline (not a reference/sample) that scrapes Woolworths and Coles and imports real product/price data into Supabase (`stores`, `store_products`, `price_history` tables — see `scraper/README.md`). It has been run for real: Supabase holds actual Woolworths/Coles product and price data today. **The frontend does not consume this data yet** — the scraper/Supabase pipeline and the frontend are still two disconnected pieces; wiring them together is future work.
- **ALDI scraping is planned but not yet built.** `scraper/` only has `woolworths.py` and `coles.py`; there is no `aldi.py` or equivalent. This is a confirmed gap against the Browse MVP's three-retailer commitment (see below), not an oversight to silently fill in.
- **Confirmed retailers for the Browse MVP: Woolworths, Coles, and ALDI** (per `browsing_page_guide.md`, the Browse page's backend contract). IGA is no longer part of the confirmed retailer set for this scope — it was previously listed as unconfirmed and has been superseded by this contract; revisit if IGA support is wanted later.
- **Confirmed category taxonomy**: the 17-category/subcategory structure defined in `browsing_page_guide.md` §3 (e.g. "Fruit & Vegetables", "Meat & Seafood", "Dairy, Eggs & Fridge" …) is the approved BasketWise taxonomy, intended to be served by a future `GET /categories` endpoint. The frontend currently mocks this endpoint (`frontend/src/data/browseApi.js`) with the exact same shape so the swap to a real backend is mechanical.
- **Browse MVP scope**: categories, subcategories, product cards with per-retailer prices, add-to-basket, pagination ("Load more"), retailer-only filtering, and sorting are all in scope and implemented (`RetailerFilter`, `SortMenu`). This is a deliberate expansion beyond `browsing_page_guide.md`'s original narrower cut, made once the core browse-and-compare flow was working. Search, tags/dietary filters, and specials filtering remain out of scope — do not reintroduce those without checking that contract first.

## Evidence on Hand

Real Woolworths and Coles product/price data exists in Supabase via `scraper/`, but is not yet connected to or reflected in the frontend — every number and product currently visible in the app is still placeholder/mock data from `frontend/src/data/*`. No ALDI data exists (no scraper built yet). No testimonials, benchmarks, or usage evidence exist. All current numbers/stats in UI copy (product counts, match rates, postcode coverage) are filler and must not be reused as fact in future work.

## Product Principles

1. Compare across multiple retailers, not just one — the value is in seeing the whole market at once.
2. Optimize for the shopper's actual basket, not isolated per-item deals.
3. Stay independent of retailer influence — no commissions or placement bias in what's shown as cheapest.
4. Reduce shopper effort — the tool should do the comparison work, not demand manual price-checking.
