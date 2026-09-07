# CLAUDE.md

BasketWise: grocery price comparison (Coles, Woolworths, ALDI, Harris Farm).

## Folders

| Folder | What it is |
|--------|------------|
| `frontend/` | React (Vite) app. Most pages call the live API via `src/api/client.ts`. |
| `backend/` | FastAPI. This is https://basket.taskglass.work/ (`/docs` = Swagger). |
| `scraper/` | One Go crawler (`hyperscrape`) → SQLite → copied to the API host. |

API contract: [`Source-of-truth.md`](Source-of-truth.md) (repo root).

Leftovers are not deleted. Each of those three folders has `_can_possibly_delete/`
for old scripts, mock catalogues, and unused sketches. Inspect those inward.

## Rules

- Do not assume every page is mocked. Browse, Search, Product, Compare, Home essentials, and cart line-resolve hit the live API by default (`VITE_API_BASE` or `https://basket.taskglass.work`).
- Still local: Home meals (`src/mocks/home/meals.json`), receipt dropzone, Account copy, sign-in modal.
- Do not restart hpsrv unless you intend to deploy.

## Commands

Frontend. Package manager is **pnpm**. No test runner in `package.json`.

```bash
cd frontend
pnpm install
pnpm dev
pnpm build
pnpm preview
pnpm format # Formats/fixes files automatically.
pnpm lint:fix #only auto-fix ESLint issues that have a safe fixer. Some lint errors still need manual changes.
pnpm format:check # Checks formatting only. It should not modify anything.
pnpm lint #Checks ESLint/code-quality rules. Depending on your script, it may or may not auto-fix.
```

Folder map: [`frontend/README.md`](frontend/README.md).

Backend (needs a `basketwise.db`; defaults to `../scraper/data/basketwise.db`):

```bash
cd backend
uv venv .venv && VIRTUAL_ENV=.venv uv pip install fastapi 'uvicorn[standard]' pytest
.venv/bin/uvicorn main:app --reload      # http://127.0.0.1:8000/docs
```

Local run + hpsrv: [`backend/README.md`](backend/README.md).

Scraper (crawl → merge → slim DB):

```bash
cd scraper
go build -o hyperscrape ./cmd/hyperscrape
./hyperscrape -store coles -phase all    # also: woolworths, aldi, harrisfarm
uv run tui/build_master.py
uv run tui/build_api_db.py
```

Woolworths usually needs cookies first: `uv run tui/harvest_cookies.py --store woolworths`. Full runbook: [`scraper/README.md`](scraper/README.md).

## Frontend architecture

- Routing
  - `src/main.tsx` mounts `<BrowserRouter>` around `<App />`
  - Routes in `src/App.tsx` (`react-router` v8), nested under `MainLayout`
  - Browse is `/browse` under `BrowseLayout` (`category` / `subcategory` / `retailer` / `sort` query params)
  - Search is `/search?q=`
  - Product is `/product/:productId`
  - There is no `CategoriesPage` / `/categories` or `/signin` route (sign-in is a modal)
- Cart
  - `context/cart-context.js`, `context/CartContext.tsx`, `context/useCart.js`
  - `CartProvider` wraps `<App />`
  - localStorage `basketwise:cart`
- Pages
  - `src/pages/`
  - Components in `src/components/` (`browse/`, `home/`, `compare/`, `header/`, `checkout/`, `search/`, `product/`)
- API
  - `src/api/client.ts` — live fetch
  - `src/api/browseApi.js` — wrapper + client-side sort
- Styling
  - Tailwind v4 from `src/index.css`
- React Compiler
  - `@rolldown/plugin-babel` + `reactCompilerPreset()` in `vite.config.ts`
- Imports
  - `@/*` → `src/*`
- Files
  - `.tsx` is JSX with editor support (`allowJs: true`, `checkJs: false`)
  - Active mock: `src/mocks/home/meals.json`. Other files under `src/mocks/` are unused leftovers. `src/data/` does not exist.
