# CLAUDE.md

BasketWise: grocery price comparison (Coles, Woolworths, ALDI, Harris Farm).

## Folders

| Folder | What it is |
|--------|------------|
| `frontend/` | React (Vite) app. Browse uses `src/api/browseApi.js` + `src/mocks/`. Other pages still use `src/data/`. |
| `backend/` | FastAPI. This is https://basket.taskglass.work/ (`/docs` = Swagger). |
| `scraper/` | One Go crawler (`hyperscrape`) → SQLite → copied to the API host. |

API contract: [`Source-of-truth.md`](Source-of-truth.md) (repo root).

Leftovers are not deleted. Each of those three folders has `_can_possibly_delete/`
for old scripts, mock catalogues, and unused sketches. Inspect those inward.

## Rules

- Do not assume the React app talks to the live API. Pages still use mocks.
- Do not restart hpsrv unless you intend to deploy.

## Commands

Frontend (mocks). Package manager is **pnpm**. No test runner in `package.json`.

```bash
cd frontend
pnpm install
pnpm dev
pnpm build
pnpm preview
pnpm lint
pnpm format
pnpm format:check
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

## Frontend architecture To Be Reviewed As currently its incomplete(will change)

- Routing
  - `src/main.tsx` mounts `<BrowserRouter>` around `<App />`
  - Routes in `src/App.tsx` (`react-router` v8), nested under `MainLayout`
  - Browse is `/browse` under `BrowseLayout` (sidebar + `category`/`subcategory` URL params)
  - There is no `CategoriesPage` / `/categories` route
- Cart
  - `context/cart-context.js`, `context/CartContext.tsx`, `context/useCart.js`
  - `CartProvider` wraps `<App />`
- Pages
  - `src/pages/`
  - Components in `src/components/` (`browse/`, `home/`, `compare/`)
- Styling
  - Tailwind v4 from `src/index.css`
- React Compiler
  - `@rolldown/plugin-babel` + `reactCompilerPreset()` in `vite.config.ts`
- Imports
  - `@/*` → `src/*`
- Files
  - `.tsx` is JSX with editor support (`allowJs: true`, `checkJs: false`)
  - Mock data modules are `.js` under `src/data/` and `src/mocks/`
