// Resolves a cart entry's `product_id` into one shape the basket sidebar can
// render without caring where the id came from. Meals are still a local mock
// catalogue (no meal-planning API yet); real products come from the live API.
//
// Backed by a tiny external store (cache + in-flight map) rather than
// component state: many CartRows can ask for the same product id, and this
// makes that a no-op cache hit instead of duplicate requests.
import { useSyncExternalStore } from 'react'

import { getProduct } from '@/api/client'
import meals from '@/mocks/home/meals.json'

const cache = new Map()
const pending = new Set()
const listeners = new Set()

function notify() {
  for (const listener of listeners) listener()
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function cheapestPrice(offers) {
  const prices = (offers ?? []).map((offer) => offer.price)
  return prices.length > 0 ? Math.min(...prices) : 0
}

function mealLineItem(meal) {
  const priceMatch = meal.meta.match(/\$([\d.]+)/)
  return {
    kind: 'meal',
    name: meal.name,
    shotCaption: meal.shot,
    meta: meal.meta.replace(/\s*·\s*\$[\d.]+\s*$/, ''),
    totalPrice: priceMatch ? parseFloat(priceMatch[1]) : 0,
    image_url: null,
  }
}

function productLineItem(product) {
  return {
    kind: 'product',
    name: product.name,
    shotCaption: product.name.toLowerCase(),
    unitPrice: product.min_price ?? cheapestPrice(product.offers),
    image_url: product.image_url ?? null,
  }
}

function resolve(productId) {
  const meal = meals.find((m) => m.id === productId)
  if (meal) return Promise.resolve(mealLineItem(meal))
  return getProduct(productId)
    .then(productLineItem)
    .catch(() => null)
}

function ensureLoaded(productId) {
  if (cache.has(productId) || pending.has(productId)) return
  pending.add(productId)
  resolve(productId).then((item) => {
    cache.set(productId, item)
    pending.delete(productId)
    notify()
  })
}

// undefined = still loading, null = no meal or live product matches this id.
export function useCartLineItem(productId) {
  ensureLoaded(productId)
  return useSyncExternalStore(subscribe, () => cache.get(productId))
}
