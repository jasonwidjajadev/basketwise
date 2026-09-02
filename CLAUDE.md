# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BasketWise: a grocery price comparison tool (Woolworths vs Coles vs ALDI) — browse products/categories, build a
basket, and compare prices across stores.

The repo currently has three independent, unwired pieces: the frontend (mock data only), a real data-scraping
pipeline (`scraper/`, writes to Supabase), and backend API notes (`backend/`, not implemented). See
"How the pieces connect" below before assuming any of them talk to each other.

## Repo layout

- `frontend/` — the only actively developed app. React 19 + Vite + Tailwind v4, path alias `@` → `frontend/src`.
- `scraper/` — real, runnable Python scrapers for Woolworths and Coles (`woolworths.py`, `coles.py`) that write
  products and prices into a Supabase project via `database.py`/`import_products.py`. See `scraper/README.md` for
  the full data flow, Supabase table shapes (`stores`, `store_products`, `price_history`), and setup/run
  instructions. Requires a `.env` with `SUPABASE_URL`/`SUPABASE_KEY` (not committed).
- `backend/` — draft/notes only. `backend/interfaces/types.py` is a scratch file of domain-type sketches and
  planning notes (Franchise, Store, Item, StockRecord, Category), not real type definitions. `backend/contracts.py`
  and `backend/README.md` are currently empty placeholders. No running service, no framework, no entrypoint.
- `PRODUCT.md` / `DESIGN.md` — durable product context and the visual design system (colors, type, spacing,
  component rules), maintained via the Impeccable Claude Code skill. Treat `DESIGN.md` as the source of truth for
  any UI styling decision — it documents named rules (e.g. "Two-Color Rule": only pantry green + market mustard
  carry saturation) and the system's few deliberate, component-scoped exceptions (radius/shadow on
  `BrowseProductCard`, radius on the `/categories` hub tiles). Check it before introducing new colors, radii, or
  shadows.
- `browsing_page_guide.md` — the Browse page's backend contract (category taxonomy source of truth, confirmed
  retailer set, MVP scope). `frontend/src/data/browseCategories.js`/`browseApi.js` mirror this contract exactly so
  a future real backend swap is mechanical.
- `BasketWise Frontend Task - Home + Browse.md` — the original task brief the Home/Browse pages were built against.

## How the pieces connect (and don't)

```
scraper/  →  Supabase (real, live)          — completely separate from the frontend today
frontend/ →  mock data in src/data/*.js     — no Supabase client, no API calls anywhere in frontend/
backend/  →  notes only, nothing runs
```

`frontend/src/data/browseApi.js` mocks the future `GET /categories` / `GET /products` endpoints with the exact
shape `browsing_page_guide.md` specifies, so wiring a real backend later should mean swapping this one file's
implementation, not restructuring callers.

## Commands (frontend)

All commands run from `frontend/`. Package manager is **pnpm** (see `packageManager` in package.json).

```
pnpm install       # install deps
pnpm dev           # start Vite dev server
pnpm build         # production build
pnpm preview       # preview a production build
pnpm lint          # eslint .
pnpm format        # prettier . --write
pnpm format:check  # prettier . --check
```

There is no test runner configured yet (no vitest/jest in package.json) — don't assume `pnpm test` works.

## Commands (scraper)

All commands run from `scraper/`, with a `.env` present (see `scraper/README.md` for required vars).

```
pip install requests python-dotenv supabase httpx
python coles.py             # test only the Coles scraper (accepts scrape_coles(max_pages_per_category=N) for a quick run)
python import_products.py   # full run: scrape Woolworths + Coles, save products/prices to Supabase
```

## Frontend architecture

- **Routing**: `src/main.tsx` mounts `<BrowserRouter>` around `<App />`. `src/App.tsx` defines all routes with
  `react-router` (v8, imports from `'react-router'` not `'react-router-dom'`). Routes nest under `MainLayout`
  (Header/Footer chrome via `<Outlet />`). The Browse flow is two routes: `/categories` (a standalone category-grid
  hub, `CategoriesPage`, reached from the header's "Browse" nav link) → `/browse?category=<id>` (the filtered
  product grid, nested under `BrowseLayout`, which adds the left `CategorySidebar` and reads/writes
  `category`/`subcategory` to the URL so links into it land pre-filtered).
- **Cart state**: split across three files by convention — `context/cart-context.js` (the `createContext`
  call, kept separate so Fast Refresh doesn't invalidate on provider changes), `context/CartContext.tsx`
  (the `CartProvider` component/logic), and `context/useCart.js` (the consumer hook). `CartProvider`
  wraps the whole `<App />` tree. Cart items are tracked as add-only id maps (`addedIds`/`savedIds`) with
  a `count` and a transient `pulse` flag for UI feedback — there's no remove/quantity-edit logic yet.
- **Pages** (`src/pages/`) are route-level components; **components** (`src/components/`, with `browse/` and
  `home/` subfolders for page-specific pieces) are shared/presentational.
- **Static content as data modules**: homepage content (categories, essentials, meals, FAQs, "start
  another way") and the Browse category taxonomy/mock product API live in plain JS modules under
  `src/data/*.js`/`.json` rather than being fetched — placeholder data standing in for a future backend API
  (see "How the pieces connect" above).
- **Styling**: Tailwind v4 via the `@tailwindcss/vite` plugin (no `tailwind.config.js` — v4 is
  CSS-config-driven from `src/index.css`). `clsx` + `tailwind-merge` are available for conditional
  classes. Prettier auto-sorts Tailwind classes (`prettier-plugin-tailwindcss`) — run `pnpm format`
  after editing className strings. Consult `DESIGN.md` before adding new colors/radii/shadows.
- **React Compiler**: enabled via `@rolldown/plugin-babel` + `reactCompilerPreset()` in
  `vite.config.ts` — avoid manual `useMemo`/`useCallback` micro-optimizations where the compiler already
  handles it; the existing manual memoization in `CartContext.tsx` predates/coexists with this.
- Imports use the `@/*` → `src/*` alias (configured in both `tsconfig.app.json` and via
  `resolve.tsconfigPaths` in `vite.config.ts`) — prefer it over relative `../../` paths.
- Most components/pages use `.tsx` extensions and TypeScript tooling is present (`tsconfig*.json`,
  `@types/*`), but there's no real type-checking gate (`allowJs: true`, `checkJs: false`) and existing
  components don't declare prop types — treat `.tsx` here as "JSX with editor support," not as
  type-checked code. Plain data modules (`src/data/*`) stay `.js`.
