# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BasketWise: a grocery price comparison tool (Woolworths vs Coles) — browse products/categories, build a
basket, and compare prices across stores. Currently frontend-only; the backend and scraping layer are
still in early design.

## Repo layout

- `frontend/` — the only actively developed app. React 19 + Vite + Tailwind v4, plain JS (`.jsx`), path
  alias `@` → `frontend/src`.
- `backend/interfaces/types.py` — draft/notes-only sketch of backend domain types (Franchise, Store,
  Item, StockRecord, Category). Not a running service; no framework, tests, or entrypoint exist yet.
- `sample/coles/`, `sample/woolworths/` — reference Go scraper code imported from the external
  `github.com/tjhowse/aus_grocery_price_database` project (see its package imports), kept here as a
  design reference for the future scraping layer. There is no `go.mod` in this repo, so these files are
  **not buildable/runnable as-is** — don't try to `go build`/`go test` them without first vendoring the
  module.
- `sample/*/data/` — captured sample API/HTML responses from each retailer, useful for understanding
  their data shapes.

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

## Frontend architecture

- **Routing**: `src/main.jsx` mounts `<BrowserRouter>` around `<App />`. `src/App.jsx` defines all
  routes with `react-router` (v8, imports from `'react-router'` not `'react-router-dom'`). Routes nest
  under `MainLayout` (Header/Footer chrome via `<Outlet />`), and the `browse` route additionally nests
  under `BrowseLayout` (adds the left sidebar).
- **Cart state**: split across three files by convention — `context/cart-context.js` (the `createContext`
  call, kept separate so Fast Refresh doesn't invalidate on provider changes), `context/CartContext.jsx`
  (the `CartProvider` component/logic), and `context/useCart.js` (the consumer hook). `CartProvider`
  wraps the whole `<App />` tree. Cart items are tracked as add-only id maps (`addedIds`/`savedIds`) with
  a `count` and a transient `pulse` flag for UI feedback — there's no remove/quantity-edit logic yet.
- **Pages** (`src/pages/`) are route-level components; **components** (`src/components/`, with a
  `home/` subfolder for homepage-only sections) are shared/presentational pieces.
- **Static content as data modules**: homepage content (categories, essentials, meals, FAQs, "start
  another way") lives in plain JS modules under `src/data/*.js`/`.json` rather than being fetched — this
  is placeholder data standing in for a future backend API.
- **Styling**: Tailwind v4 via the `@tailwindcss/vite` plugin (no `tailwind.config.js` — v4 is
  CSS-config-driven from `src/index.css`). `clsx` + `tailwind-merge` are available for conditional
  classes. Prettier auto-sorts Tailwind classes (`prettier-plugin-tailwindcss`) — run `pnpm format`
  after editing className strings.
- **React Compiler**: enabled via `@rolldown/plugin-babel` + `reactCompilerPreset()` in
  `vite.config.ts` — avoid manual `useMemo`/`useCallback` micro-optimizations where the compiler already
  handles it; the existing manual memoization in `CartContext.jsx` predates/coexists with this.
- Imports use the `@/*` → `src/*` alias (configured in both `tsconfig.app.json` and via
  `resolve.tsconfigPaths` in `vite.config.ts`) — prefer it over relative `../../` paths.
- Despite `.jsx` file extensions and no real type-checking gate, TypeScript tooling is present
  (`tsconfig*.json`, `@types/*`) for editor support only; `allowJs`/`checkJs: false`.
