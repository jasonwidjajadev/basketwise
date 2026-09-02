import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { RETAILER_LABEL, compare, type CompareResponse } from '@/api/client'
import { useCart } from '@/context/useCart'

export default function ComparePage() {
  const { basketItems, entries } = useCart()
  const [result, setResult] = useState<CompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (basketItems.length === 0) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    compare(basketItems, controller.signal)
      .then((r) => { setResult(r); setLoading(false) })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') {
          setError('Failed to compare basket. Please try again.')
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [basketItems])

  if (entries.length === 0) {
    return (
      <div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center gap-4 px-6">
        <p className="text-center text-bw-muted">Your basket is empty.</p>
        <Link
          to="/"
          className="rounded-sm bg-bw-green px-5 py-2.5 text-sm font-semibold text-white"
        >
          Browse products
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-8">
      <h1 className="mb-8 font-newsreader text-[34px] font-normal text-bw-ink">
        Basket comparison
      </h1>

      <div className="mb-10 border border-bw-line">
        <div className="border-b border-bw-line bg-bw-panel px-5 py-3">
          <p className="font-archivo text-[11px] font-bold tracking-[.18em] text-bw-subtle uppercase">
            Your basket · {entries.length} item{entries.length !== 1 ? 's' : ''}
          </p>
        </div>
        <ul className="divide-y divide-bw-line">
          {entries.map(({ product, quantity }) => (
            <li key={product.id} className="flex items-center justify-between px-5 py-3 text-sm text-bw-ink">
              <span>{product.name}</span>
              <span className="text-bw-subtle">× {quantity}</span>
            </li>
          ))}
        </ul>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded border border-bw-line bg-bw-panel" />
          ))}
        </div>
      )}

      {error && (
        <p className="rounded border border-bw-red/30 bg-bw-red/5 px-5 py-4 text-sm text-bw-red">
          {error}
        </p>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {result.recommendation && (
            <div className="rounded border border-bw-green/40 bg-bw-green/5 px-5 py-4">
              <p className="text-sm font-semibold text-bw-green">
                Cheapest at {RETAILER_LABEL[result.recommendation as keyof typeof RETAILER_LABEL]}
              </p>
            </div>
          )}

          {result.stores.map((store) => (
            <div key={store.retailer} className="border border-bw-line">
              <div className="flex items-center justify-between border-b border-bw-line bg-bw-panel px-5 py-3">
                <p className="font-semibold text-bw-ink">
                  {RETAILER_LABEL[store.retailer as keyof typeof RETAILER_LABEL]}
                </p>
                <p className="font-newsreader text-2xl text-bw-ink">
                  ${store.total.toFixed(2)}
                </p>
              </div>

              {store.missing_product_ids.length > 0 && (
                <p className="px-5 py-2 text-xs text-bw-subtle">
                  {store.missing_product_ids.length} item{store.missing_product_ids.length !== 1 ? 's' : ''} not available at this store
                </p>
              )}
            </div>
          ))}

          {result.unknown_product_ids.length > 0 && (
            <p className="text-xs text-bw-subtle">
              {result.unknown_product_ids.length} product{result.unknown_product_ids.length !== 1 ? 's' : ''} not recognised by the API.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
