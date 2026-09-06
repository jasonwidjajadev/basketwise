// Browse page's backend contract, backed by the real BasketWise API
// (GET /categories, GET /products). Same {items, total} / Category[] shapes
// the mock version returned, so nothing above this layer needs to change.
import {
  getCategories as apiGetCategories,
  getProductsPage,
} from '@/api/client'

function cheapestOffer(product, retailer) {
  const all = product.offers ?? []
  const offers = retailer
    ? all.filter((offer) => offer.retailer === retailer)
    : all
  if (offers.length === 0) return Infinity
  return offers.reduce((min, offer) => Math.min(min, offer.price), Infinity)
}

function savingsOf(product) {
  const offers = product.offers ?? []
  if (offers.length < 2) return 0
  const prices = offers.map((offer) => offer.price)
  return Math.max(...prices) - Math.min(...prices)
}

// GET /categories
export function getCategories() {
  return apiGetCategories()
}

// GET /products?category=&subcategory=&retailer=&q=&limit=&offset=
//
// `sort` has no server-side equivalent yet, so it's applied to the page the
// API just returned, same as `loadMore` already appends pages one at a time --
// a sort that's globally correct across the whole filtered set (not just the
// loaded pages) would need backend support.
export async function getProducts({
  category,
  subcategory,
  retailer,
  q,
  sort,
  limit = 24,
  offset = 0,
} = {}) {
  const { data, total } = await getProductsPage({
    category,
    subcategory,
    retailer,
    q,
    limit,
    offset,
  })

  let items = data

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

  return { items, total: total ?? items.length }
}
