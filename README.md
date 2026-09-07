# BasketWise

Compare the same grocery basket across **Coles, Woolworths, ALDI, and Harris Farm**.

The basket stores a canonical `product_id` only — never a retailer's SKU. Totals come from `POST /compare`; the frontend does not add prices itself. A Go crawler builds a SQLite catalogue, FastAPI serves it read-only, and the React app talks to that API.

**Live API:** [https://basket.taskglass.work/](https://basket.taskglass.work/) · **Swagger:** [https://basket.taskglass.work/docs](https://basket.taskglass.work/docs)

## How it fits together

```
scraper (Go crawl → SQLite)
    → backend (FastAPI, live at basket.taskglass.work)
        → frontend (Vite/React; default API is the live host)
```

| Folder | Role |
|---|---|
| [`frontend/`](frontend/) | React (Vite). Browse, search, product, and compare hit the live API. |
| [`backend/`](backend/) | FastAPI. Read-only catalogue. |
| [`scraper/`](scraper/) | `hyperscrape` → merge → `basketwise.db`. |

## Quick start

The frontend talks to the live API by default. No local database, crawl, or deploy.

```bash
cd frontend
pnpm install
pnpm dev
```

Still local (not the API): Home meals, the receipt dropzone, Account copy, and the sign-in modal.

### Local API or scraper

- **Backend** needs a `basketwise.db`. See [backend/README.md](backend/README.md).
- **Scraper** crawls, merges, and slims that DB. See [scraper/README.md](scraper/README.md).
- Do not restart `hpsrv` unless you intend to deploy.

## Further reading

- [Source-of-truth.md](Source-of-truth.md) — API and data contract
- [frontend/README.md](frontend/README.md) — routes and `src/` map
- [backend/README.md](backend/README.md) — routes, local run, Docker
- [scraper/README.md](scraper/README.md) — crawl runbook
- [CLAUDE.md](CLAUDE.md) — agent and contributor notes
