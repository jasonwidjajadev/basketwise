// Mock implementation of the Browse page's backend contract
// (see /basketwise/browsing_page_guide.md). Same function signatures and
// response shapes the real `GET /categories` / `GET /products` endpoints
// will return — swapping these bodies for real `fetch()` calls later is a
// one-line change per function, nothing above this layer needs to know.
//
// `retailer`, `q`, and `sort` are listed in the guide as post-MVP extensions
// (§Extensions 1-3), but the core category → subcategory → product → basket
// flow already works, so they're wired up now using the exact param names
// and semantics the guide itself specifies for when they land for real.
import BROWSE_CATEGORIES from '@/mocks/browse/categories.json'
import BROWSE_PRODUCTS from '@/mocks/browse/products.json'

const MOCK_LATENCY_MS = 200

function delay(value) {
  return new Promise((resolve) =>
    setTimeout(() => resolve(value), MOCK_LATENCY_MS),
  )
}

function cheapestOffer(product, retailer) {
  const offers = retailer
    ? product.offers.filter((offer) => offer.retailer === retailer)
    : product.offers
  return offers.reduce((min, offer) => Math.min(min, offer.price), Infinity)
}

function savingsOf(product) {
  if (product.offers.length < 2) return 0
  const prices = product.offers.map((offer) => offer.price)
  return Math.max(...prices) - Math.min(...prices)
}

// GET /categories
export function getCategories() {
  return delay(BROWSE_CATEGORIES)
}

// GET /products?category=&subcategory=&retailer=&q=&sort=&limit=&offset=
export function getProducts({
  category,
  subcategory,
  retailer,
  q,
  sort,
  limit = 24,
  offset = 0,
} = {}) {
  let items = BROWSE_PRODUCTS

  if (category) {
    items = items.filter((product) => product.category === category)
  }
  if (subcategory) {
    items = items.filter((product) => product.subcategory === subcategory)
  }
  if (retailer) {
    items = items.filter((product) =>
      product.offers.some((offer) => offer.retailer === retailer),
    )
  }
  if (q) {
    const query = q.trim().toLowerCase()
    items = items.filter((product) =>
      product.name.toLowerCase().includes(query),
    )
  }

  if (sort === 'name_asc') {
    items = [...items].sort((a, b) => a.name.localeCompare(b.name))
  } else if (sort === 'name_desc') {
    items = [...items].sort((a, b) => b.name.localeCompare(a.name))
  } else if (sort === 'price_asc') {
    items = [...items].sort(
      (a, b) => cheapestOffer(a, retailer) - cheapestOffer(b, retailer),
    )
  } else if (sort === 'price_desc') {
    items = [...items].sort(
      (a, b) => cheapestOffer(b, retailer) - cheapestOffer(a, retailer),
    )
  } else if (sort === 'biggest_saving') {
    items = [...items].sort((a, b) => savingsOf(b) - savingsOf(a))
  } else if (sort === 'smallest_saving') {
    items = [...items].sort((a, b) => savingsOf(a) - savingsOf(b))
  }

  const total = items.length
  const page = items.slice(offset, offset + limit)

  return delay({ items: page, total })
}
