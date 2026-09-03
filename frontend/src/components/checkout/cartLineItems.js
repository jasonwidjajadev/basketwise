// Normalizes a cart entry's `product_id` (which may point into any of the
// three heterogeneous mock catalogs — browse products, home essentials, or
// meals) into one shape the basket sidebar can render without caring where
// the id came from.
import BROWSE_PRODUCTS from '@/mocks/browse/products.json'
import HOME_ESSENTIALS from '@/mocks/home/essentials.json'
import meals from '@/mocks/home/meals.json'

function cheapestPrice(product) {
  const prices = product.offers.map((offer) => offer.price)
  return prices.length > 0 ? Math.min(...prices) : 0
}

export function getCartLineItem(productId) {
  const browseProduct = BROWSE_PRODUCTS.find((p) => p.id === productId)
  if (browseProduct) {
    return {
      kind: 'product',
      name: browseProduct.name,
      shotCaption: browseProduct.name.toLowerCase(),
      unitPrice: cheapestPrice(browseProduct),
    }
  }

  const homeEssential = HOME_ESSENTIALS.find((p) => p.id === productId)
  if (homeEssential) {
    return {
      kind: 'product',
      name: homeEssential.name,
      shotCaption: homeEssential.name.toLowerCase(),
      unitPrice: cheapestPrice(homeEssential),
    }
  }

  const meal = meals.find((m) => m.id === productId)
  if (meal) {
    const priceMatch = meal.meta.match(/\$([\d.]+)/)
    return {
      kind: 'meal',
      name: meal.name,
      shotCaption: meal.shot,
      meta: meal.meta.replace(/\s*·\s*\$[\d.]+\s*$/, ''),
      totalPrice: priceMatch ? parseFloat(priceMatch[1]) : 0,
    }
  }

  return null
}
