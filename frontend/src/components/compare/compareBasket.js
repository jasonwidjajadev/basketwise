import { compare } from '@/api/client'

export const RETAILER_LABEL = {
  woolworths: 'Woolworths',
  coles: 'Coles',
  aldi: 'ALDI',
  harrisfarm: 'Harris Farm',
}

// null means this strategy can't fulfil the whole basket -- the backend prices
// a strategy all-or-nothing, it never drops one item and shows the rest.
function toUiOption(option) {
  if (!option || option.total == null) return null

  const groups = option.breakdown.map((group) => ({
    retailer: group.retailer,
    label: RETAILER_LABEL[group.retailer] ?? group.retailer,
    subtotal: group.subtotal,
    lines: group.items.map((item) => ({
      product: { id: item.product_id, name: item.product_name },
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
    })),
  }))

  return {
    total: option.total,
    savings: option.savings,
    retailer: groups.length === 1 ? groups[0].retailer : undefined,
    groups,
  }
}

// Connects the basket to POST /compare and reshapes the response into what
// ComparePage renders.
export async function computeCompareOptions(cartItems, signal) {
  if (!cartItems.length) return null

  const response = await compare(
    cartItems.map((entry) => ({
      product_id: entry.product_id,
      quantity: entry.quantity,
    })),
    signal,
  )

  const byId = Object.fromEntries(response.options.map((o) => [o.id, o]))
  const recommended = toUiOption(byId['recommended-split'])
  const cheapestSingle = toUiOption(byId['cheapest-single-store'])
  const lowestTotal = toUiOption(byId['lowest-possible-price'])

  const totals = [recommended, cheapestSingle, lowestTotal]
    .filter(Boolean)
    .map((o) => o.total)
  const converge =
    totals.length === 3 && new Set(totals.map((t) => t.toFixed(2))).size === 1

  return {
    itemCount: cartItems.length,
    isSingleItem: cartItems.length === 1,
    unavailableCount: response.unknown_product_ids.length,
    hasSingleStoreOption: cheapestSingle != null,
    converge,
    recommended,
    cheapestSingle,
    lowestTotal,
  }
}
