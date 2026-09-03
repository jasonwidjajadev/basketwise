"""BasketWise API -- read-only, public, no auth.

Serves an immutable SQLite artifact built on another machine. Does no scraping and
no post-processing: every expensive transform happened at build time, which is why
this process holds a flat ~250 MB regardless of catalogue size.

  uv run uvicorn main:app --reload        # docs at http://127.0.0.1:8000/docs
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

import db
from models import Health
from routes import categories, compare, products

# Public read-only data, rebuilt daily. Let Cloudflare's edge serve the GETs so the
# origin effectively only handles POST /compare.
CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=86400"

DESCRIPTION = """
Compare an Australian grocery basket across **Coles, Woolworths, ALDI and Harris Farm**.

### The three routes you need
1. `GET /categories` — build the browse nav. Ids for requests, names for display.
2. `GET /products` — list, filter, paginate, search.
3. `POST /compare` — send the basket, get three buying strategies.

### Rules that keep us consistent
* The basket stores the canonical `product_id` **only** — never a retailer's SKU.
* The frontend never totals a basket itself; `POST /compare` owns that arithmetic.
* Category labels come from `GET /categories`, never from a local map.

### Generating a TypeScript client
```bash
npx openapi-typescript https://basket.taskglass.work/openapi.json -o src/api/schema.d.ts
```

No authentication. Data is rebuilt daily; `GET /health` reports the current `build_id`.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.startup()
    yield
    db.shutdown()


app = FastAPI(
    title="BasketWise API",
    version="1.0.0",
    description=DESCRIPTION,
    lifespan=lifespan,
    contact={"name": "BasketWise", "url": "https://basket.taskglass.work/docs"},
    license_info={"name": "Internal use"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("BASKETWISE_CORS", "*").split(","),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    max_age=86400,
)


@app.middleware("http")
async def cache_headers(request: Request, call_next):
    """Edge-cache GETs and serve 304s to repeat clients.

    The ETag is the build id, so every response changes exactly when the nightly
    artifact does -- and not once in between.
    """
    etag = f'W/"{db.build_id()}"'
    if request.method == "GET" and request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag, "Cache-Control": CACHE_CONTROL})
    response = await call_next(request)
    if request.method == "GET" and response.status_code == 200:
        response.headers.setdefault("Cache-Control", CACHE_CONTROL)
        response.headers.setdefault("ETag", etag)
    return response


app.include_router(categories.router)
app.include_router(products.router)
app.include_router(compare.router)


@app.get("/health", response_model=Health, tags=["meta"], summary="Liveness and data freshness")
def health() -> Health:
    return Health(
        status="ok",
        build_id=db.meta("build_id"),
        built_at=db.meta("built_at"),
        product_count=int(db.meta("product_count", "0")),
        offer_count=int(db.meta("offer_count", "0")),
        retailers=db.retailers(),
    )


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse("/docs")
