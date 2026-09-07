# BasketWise frontend

React (Vite) app. Most product flows call the live API through
`src/api/client.ts` (`VITE_API_BASE` or `https://basket.taskglass.work`).

`src/api/browseApi.js` wraps that client and applies **client-side sort**. It
does not read mock JSON.

Still local: Home meals (`src/mocks/home/meals.json`), the receipt dropzone,
Account copy, and the sign-in modal. Other files under `src/mocks/` are unused.
`src/data/` does not exist.

```
frontend/
├── public/
│   └── favicon_io/
├── src/
│   ├── api/
│   │   ├── browseApi.js
│   │   ├── client.ts
│   │   └── schema.d.ts
│   ├── assets/
│   ├── components/
│   │   ├── browse/
│   │   ├── checkout/
│   │   ├── compare/
│   │   ├── header/
│   │   ├── home/
│   │   ├── product/
│   │   ├── search/
│   │   ├── ProductCard.tsx
│   │   ├── RetailerFilter.tsx
│   │   └── Footer.tsx
│   ├── context/
│   │   ├── cart-context.js
│   │   ├── CartContext.tsx
│   │   ├── SignInModalContext.tsx
│   │   └── useCart.js
│   ├── layouts/
│   │   ├── BrowseLayout.tsx
│   │   └── MainLayout.tsx
│   ├── lib/
│   │   ├── imageThumbnail.ts
│   │   └── utils.js
│   ├── mocks/
│   │   └── home/
│   │       └── meals.json          # the only mock still imported
│   ├── pages/
│   │   ├── AccountPage.tsx
│   │   ├── BrowsePage.tsx
│   │   ├── ComparePage.tsx
│   │   ├── HomePage.tsx
│   │   ├── NotFoundPage.tsx
│   │   ├── ProductPage.tsx
│   │   ├── SearchResultsPage.tsx
│   │   └── SignInPage.tsx          # modal body, not a route
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── package.json
├── pnpm-lock.yaml
└── vite.config.ts
```

Tailwind v4 tokens live in `src/index.css`. `@/*` maps to `src/*`.

```
pages
  -> src/api/client.ts          (essentials, search, product, compare, cart resolve)
  -> src/api/browseApi.js       (browse categories + products + client sort)
  -> src/mocks/home/meals.json  (Home meals only)
```

## Routes

| Path | Page |
| --- | --- |
| `/` | Home |
| `/browse` | Browse (`category` / `subcategory` / `retailer` / `sort` query params, under `BrowseLayout`) |
| `/search` | Search results (`q`, optional `retailer` / `sort`) |
| `/product/:productId` | Product detail |
| `/compare` | Compare (`POST /compare`) |
| `/account` | Account placeholder |
| `*` | 404 |

There is no `/categories` or `/signin` route. Sign-in is a modal.
`CartProvider` wraps `<App />`. Cart key: `basketwise:cart`.

## Run it

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

Package manager is **pnpm**. No test runner in `package.json`. Live API contract:
[Source-of-truth.md](../Source-of-truth.md). Backend runbook: [backend/README.md](../backend/README.md).
