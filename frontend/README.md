# BasketWise frontend

React (Vite) app. Pages still use mock data. Browse goes through
`src/api/browseApi.js` (categories/products JSON). Other pages still import
`src/data/`. The typed client in `src/api/client.ts` exists; no page imports it yet.

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
│   │   ├── fonts/
│   │   ├── icons/
│   │   ├── images/
│   │   │   ├── essentials/
│   │   │   └── hero/
│   │   ├── logos/
│   │   └── mascots/
│   ├── components/
│   │   ├── browse/
│   │   │   ├── CategorySidebar.tsx
│   │   │   ├── RetailerFilter.tsx
│   │   │   └── SortMenu.tsx
│   │   ├── compare/
│   │   │   ├── CompareFooterActions.tsx
│   │   │   ├── ConvergeBlock.tsx
│   │   │   ├── EmptyCompareState.tsx
│   │   │   ├── LedgerBreakdown.tsx
│   │   │   ├── OptionCard.tsx
│   │   │   ├── SavingsBadge.tsx
│   │   │   ├── UnavailableBanner.tsx
│   │   │   └── WhyButton.tsx
│   │   ├── home/
│   │   │   ├── CategoryGrid.tsx
│   │   │   ├── EssentialsSection.tsx
│   │   │   ├── FaqRow.tsx
│   │   │   ├── FaqSection.tsx
│   │   │   ├── Hero.tsx
│   │   │   ├── HowItWorks.tsx
│   │   │   ├── MealCard.tsx
│   │   │   ├── MealsSection.tsx
│   │   │   └── StartAnotherWay.tsx
│   │   ├── CartSidebar.tsx
│   │   ├── Footer.tsx
│   │   ├── Header.tsx
│   │   ├── ProductCard.tsx
│   │   └── SearchBar.tsx
│   ├── context/
│   │   ├── cart-context.js
│   │   ├── CartContext.tsx
│   │   └── useCart.js
│   ├── data/
│   │   ├── browseCategories.js
│   │   ├── browseProducts.js
│   │   ├── cartLineItems.js
│   │   ├── categories.js
│   │   ├── essentials.js
│   │   ├── faqs.js
│   │   ├── meals.js
│   │   ├── milk.json
│   │   └── startAnotherWay.js
│   ├── layouts/
│   │   ├── BrowseLayout.tsx
│   │   └── MainLayout.tsx
│   ├── lib/
│   │   ├── browseSort.js
│   │   ├── compareBasket.js
│   │   ├── format.js
│   │   └── utils.js
│   ├── mocks/
│   │   ├── browse/
│   │   ├── compare/
│   │   ├── home/
│   │   └── product/
│   ├── pages/
│   │   ├── AccountPage.tsx
│   │   ├── BrowsePage.tsx
│   │   ├── ComparePage.tsx
│   │   ├── HomePage.tsx
│   │   ├── NotFoundPage.tsx
│   │   └── SignInPage.tsx
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── eslint.config.js
├── index.html
├── package.json
├── pnpm-lock.yaml
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

`src/data/` holds leftover Home/Compare mock catalogues. Browse uses
`src/api/browseApi.js` → `src/mocks/browse/`. Tailwind v4 tokens live in
`src/index.css`. `@/*` maps to `src/*`.

```
pages
  -> src/api/browseApi.js  (Browse)
  -> src/data/             (Home / cart leftovers)
  (not https://basket.taskglass.work/)
```

## Routes

| Path       | Page                                                                           |
| ---------- | ------------------------------------------------------------------------------ |
| `/`        | Home                                                                           |
| `/browse`  | Browse (sidebar + `category` / `subcategory` URL params, under `BrowseLayout`) |
| `/compare` | Compare                                                                        |
| `/account` | Account                                                                        |
| `/signin`  | Sign in                                                                        |
| `*`        | 404                                                                            |

There is no `/categories` route. `CartProvider` wraps `<App />`.

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
