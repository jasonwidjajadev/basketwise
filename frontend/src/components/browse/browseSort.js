export const SORT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'name_asc', label: 'Name: A-Z' },
  { value: 'name_desc', label: 'Name: Z-A' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'biggest_saving', label: 'Biggest Saving' },
  { value: 'smallest_saving', label: 'Smallest Saving' },
]

// Cheapest offer for a product, optionally restricted to one retailer.
// Products with no usable price sort last in both directions.
function cheapestOffer(product, retailer) {
  const all = product.offers ?? []
  const offers = retailer
    ? all.filter((offer) => offer.retailer === retailer)
    : all
  const prices = offers
    .map((offer) => offer.price)
    .filter((price) => Number.isFinite(price))
  if (prices.length > 0) return Math.min(...prices)
  return Number.isFinite(product.min_price) ? product.min_price : Infinity
}

function savingsOf(product) {
  const offers = product.offers ?? []
  if (offers.length < 2) return 0
  const prices = offers.map((offer) => offer.price)
  return Math.max(...prices) - Math.min(...prices)
}

// Sorts the pages already loaded. There is no server-side `sort` yet, so a
// globally correct ordering across the whole filtered set needs backend work.
export function sortProducts(items, sort, retailer = '') {
  if (!sort) return items

  const sorted = [...items]

  if (sort === 'name_asc') {
    sorted.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sort === 'name_desc') {
    sorted.sort((a, b) => b.name.localeCompare(a.name))
  } else if (sort === 'price_asc') {
    sorted.sort(
      (a, b) => cheapestOffer(a, retailer) - cheapestOffer(b, retailer),
    )
  } else if (sort === 'price_desc') {
    sorted.sort((a, b) => {
      const left = cheapestOffer(a, retailer)
      const right = cheapestOffer(b, retailer)
      if (left === Infinity || right === Infinity) return left - right
      return right - left
    })
  } else if (sort === 'biggest_saving') {
    sorted.sort((a, b) => savingsOf(b) - savingsOf(a))
  } else if (sort === 'smallest_saving') {
    sorted.sort((a, b) => savingsOf(a) - savingsOf(b))
  }

  return sorted
}
