import COMPARE from '@/mocks/compare/compare.json'

export const RETAILER_LABEL = {
  woolworths: 'Woolworths',
  coles: 'Coles',
  aldi: 'ALDI',
  harrisfarm: 'Harris Farm',
}

function toUiOption(option) {
  if (!option) return null

  const groups = option.breakdown.map((group) => ({
    retailer: group.retailer,
    label: RETAILER_LABEL[group.retailer],
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
    excludedItems: [],
  }
}

function uniqueProductIds(option) {
  return new Set(
    option.breakdown.flatMap((group) =>
      group.items.map((item) => item.product_id),
    ),
  )
}

export function computeCompareOptions(cartItems) {
  if (!cartItems.length) return null

  const byId = Object.fromEntries(
    COMPARE.options.map((option) => [option.id, option]),
  )
  const recommended = toUiOption(byId['recommended-split'])
  const cheapestSingle = toUiOption(byId['cheapest-single-store'])
  const lowestTotal = toUiOption(byId['lowest-possible-price'])

  const productIds = uniqueProductIds(byId['recommended-split'])
  const hasSingleStoreOption = cheapestSingle != null
  const converge =
    hasSingleStoreOption &&
    new Set(
      [recommended.total, lowestTotal.total, cheapestSingle.total].map((t) =>
        t.toFixed(2),
      ),
    ).size === 1

  return {
    itemCount: productIds.size,
    isSingleItem: productIds.size === 1,
    unavailable: [],
    hasSingleStoreOption,
    converge,
    recommended,
    lowestTotal,
    cheapestSingle,
  }
}
