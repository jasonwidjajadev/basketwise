import { BROWSE_PRODUCTS } from '@/data/browseProducts'

export const RETAILERS = ['woolworths', 'coles', 'aldi']

export const RETAILER_LABEL = {
  woolworths: 'Woolworths',
  coles: 'Coles',
  aldi: 'ALDI',
}

// Mock "in delivery area" set standing in for real address/geo data (none
// exists in this app yet — see PRODUCT.md). Coles is treated as out of
// range, matching the product lead's own example ("only woolies + aldi
// because coles is too far, unless they're online shopping").
const NEARBY_RETAILERS = ['woolworths', 'aldi']

const productsById = Object.fromEntries(BROWSE_PRODUCTS.map((p) => [p.id, p]))

function buildGroups(assignments) {
  const byRetailer = new Map()
  for (const a of assignments) {
    if (!byRetailer.has(a.retailer)) byRetailer.set(a.retailer, [])
    byRetailer.get(a.retailer).push(a)
  }
  return [...byRetailer.entries()].map(([retailer, lines]) => ({
    retailer,
    label: RETAILER_LABEL[retailer],
    lines,
    subtotal: lines.reduce((sum, l) => sum + l.lineTotal, 0),
  }))
}

const sum = (assignments) => assignments.reduce((t, a) => t + a.lineTotal, 0)

export function computeCompareOptions(cartItems) {
  const lineItems = cartItems
    .map((item) => ({
      product: productsById[item.product_id],
      quantity: item.quantity,
    }))
    .filter((l) => l.product)

  if (lineItems.length === 0) return null

  const available = lineItems.filter((l) => l.product.offers.length > 0)
  const unavailable = lineItems
    .filter((l) => l.product.offers.length === 0)
    .map((l) => l.product)

  if (available.length === 0) return null

  // Cheapest single store only exists if a retailer covers every available item.
  const singleStoreTotals = RETAILERS.map((retailer) => {
    let total = 0
    let covered = 0
    for (const { product, quantity } of available) {
      const offer = product.offers.find((o) => o.retailer === retailer)
      if (offer) {
        total += offer.price * quantity
        covered += 1
      }
    }
    return { retailer, total, fullCoverage: covered === available.length }
  })
  const fullyCovering = singleStoreTotals.filter((s) => s.fullCoverage)
  const hasSingleStoreOption = fullyCovering.length > 0
  const bestSingle = hasSingleStoreOption
    ? fullyCovering.slice().sort((a, b) => a.total - b.total)[0]
    : null

  // Baseline for savings badges: worst-case per item, always defined.
  const naiveTotal = available.reduce(
    (t, { product, quantity }) =>
      t + Math.max(...product.offers.map((o) => o.price)) * quantity,
    0,
  )

  // Lowest total price: cheapest offer for each item, any store.
  const lowestTotalAssignments = available.map(({ product, quantity }) => {
    const best = product.offers.reduce(
      (min, o) => (o.price < min.price ? o : min),
      product.offers[0],
    )
    return {
      product,
      quantity,
      retailer: best.retailer,
      unitPrice: best.price,
      lineTotal: best.price * quantity,
    }
  })

  // Recommended split: cheapest offer within the delivery area — a hard
  // exclusion, not a fallback. An item sold only outside the area is
  // dropped from this split entirely rather than reached for anyway.
  const recommendedAssignments = []
  const recommendedExcluded = []
  for (const { product, quantity } of available) {
    const nearbyOffers = product.offers.filter((o) =>
      NEARBY_RETAILERS.includes(o.retailer),
    )
    if (!nearbyOffers.length) {
      recommendedExcluded.push(product)
      continue
    }
    const best = nearbyOffers.reduce(
      (min, o) => (o.price < min.price ? o : min),
      nearbyOffers[0],
    )
    recommendedAssignments.push({
      product,
      quantity,
      retailer: best.retailer,
      unitPrice: best.price,
      lineTotal: best.price * quantity,
    })
  }
  // Savings badge compares against the worst-case price for only the items
  // Recommended actually covers, since excluded items aren't priced by it.
  const recommendedNaive = recommendedAssignments.reduce(
    (t, a) =>
      t + Math.max(...a.product.offers.map((o) => o.price)) * a.quantity,
    0,
  )

  const cheapestSingleAssignments = hasSingleStoreOption
    ? available.map(({ product, quantity }) => {
        const offer = product.offers.find(
          (o) => o.retailer === bestSingle.retailer,
        )
        return {
          product,
          quantity,
          retailer: bestSingle.retailer,
          unitPrice: offer.price,
          lineTotal: offer.price * quantity,
        }
      })
    : []

  const recommended = {
    total: sum(recommendedAssignments),
    savings: recommendedNaive - sum(recommendedAssignments),
    groups: buildGroups(recommendedAssignments),
    excludedItems: recommendedExcluded,
  }
  const lowestTotal = {
    total: sum(lowestTotalAssignments),
    savings: naiveTotal - sum(lowestTotalAssignments),
    groups: buildGroups(lowestTotalAssignments),
  }
  const cheapestSingle = hasSingleStoreOption
    ? {
        total: bestSingle.total,
        savings: naiveTotal - bestSingle.total,
        retailer: bestSingle.retailer,
        groups: buildGroups(cheapestSingleAssignments),
      }
    : null

  // Require all three strategies to actually exist before calling it a
  // convergence — otherwise a basket with no full-coverage store would
  // false-trigger this just because Recommended happens to equal Lowest
  // Total, hiding the fact that Cheapest Single Store doesn't exist here.
  const converge =
    hasSingleStoreOption &&
    new Set(
      [recommended.total, lowestTotal.total, cheapestSingle.total].map((t) =>
        t.toFixed(2),
      ),
    ).size === 1

  return {
    itemCount: available.reduce((n, l) => n + l.quantity, 0),
    isSingleItem: available.length === 1,
    unavailable,
    hasSingleStoreOption,
    converge,
    recommended,
    lowestTotal,
    cheapestSingle,
  }
}
