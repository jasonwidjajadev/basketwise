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

- Frontend-only today: React 19 + Vite + Tailwind v4 app (`frontend/`). No running backend.
- `backend/interfaces/types.py` is a draft/notes-only sketch of domain types (Franchise, Store, Item, StockRecord, Category) — not a running service.
- `sample/coles/`, `sample/woolworths/` contain external reference Go scraper code (from `github.com/tjhowse/aus_grocery_price_database`), kept only as design reference. Not buildable as-is (no `go.mod`). Whether/how a scraping layer gets built is undecided.
- All product data currently shown (categories, essentials, meals, FAQs, prices) is placeholder/mock data in `src/data/*`, standing in for a future backend API — not real retailer data.
- **Confirmed retailers for the Browse MVP: Woolworths, Coles, and ALDI** (per `browsing_page_guide.md`, the Browse page's backend contract). IGA is no longer part of the confirmed retailer set for this scope — it was previously listed as unconfirmed and has been superseded by this contract; revisit if IGA support is wanted later.
- **Confirmed category taxonomy**: the 17-category/subcategory structure defined in `browsing_page_guide.md` §3 (e.g. "Fruit & Vegetables", "Meat & Seafood", "Dairy, Eggs & Fridge" …) is the approved BasketWise taxonomy, intended to be served by a future `GET /categories` endpoint. The frontend currently mocks this endpoint (`frontend/src/data/browseApi.js`) with the exact same shape so the swap to a real backend is mechanical.
- **Browse MVP scope is deliberately narrow**: categories, subcategories, product cards with per-retailer prices, add-to-basket, and pagination ("Load more") only. Search, retailer-only filtering, price/savings/recommended sorting, tags/dietary filters, and specials filtering are explicitly out of scope until the core flow is working (per `browsing_page_guide.md`) — do not reintroduce them without checking that contract first.

## Evidence on Hand

No real retailer data, testimonials, benchmarks, or usage evidence exists yet. All current numbers/stats in UI copy (product counts, match rates, postcode coverage) are filler and must not be reused as fact in future work.

## Product Principles

1. Compare across multiple retailers, not just one — the value is in seeing the whole market at once.
2. Optimize for the shopper's actual basket, not isolated per-item deals.
3. Stay independent of retailer influence — no commissions or placement bias in what's shown as cheapest.
4. Reduce shopper effort — the tool should do the comparison work, not demand manual price-checking.
