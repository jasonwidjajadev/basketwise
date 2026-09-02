import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import { getProductsPage, type Product } from '@/api/client'
import ProductCard from '@/components/home/ProductCard'
import { useCart } from '@/context/useCart'

const PAGE_SIZE = 24

function SkeletonCard() {
  return (
    <div className="flex animate-pulse flex-col border border-bw-line bg-bw-surface">
      <div className="aspect-square bg-bw-panel" />
      <div className="space-y-2 p-3">
        <div className="h-6 rounded bg-bw-panel" />
        <div className="h-3 w-2/3 rounded bg-bw-panel" />
        <div className="h-10 rounded bg-bw-panel" />
      </div>
    </div>
  )
}

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? ''
  const page = Number(searchParams.get('page') ?? '1')
  const offset = (page - 1) * PAGE_SIZE

  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const { addedIds, savedIds, add, toggleSaved } = useCart()

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    getProductsPage({ q: q || undefined, category: category || undefined, limit: PAGE_SIZE, offset }, controller.signal)
      .then(({ data, total }) => {
        setProducts(data)
        setTotal(total)
        setLoading(false)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [q, category, offset])

  const totalPages = total != null ? Math.ceil(total / PAGE_SIZE) : null

  function goTo(p: number) {
    const next = new URLSearchParams(searchParams)
    if (p === 1) next.delete('page')
    else next.set('page', String(p))
    setSearchParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="px-6 py-8 lg:px-8">
      <div className="mb-5 flex flex-wrap items-baseline gap-3">
        <h1 className="font-newsreader text-2xl text-bw-ink">
          {q ? `Results for "${q}"` : category ? 'Category' : 'All products'}
        </h1>
        {total != null && (
          <span className="text-sm text-bw-subtle">{total.toLocaleString()} items</span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : products.length === 0 ? (
        <p className="py-24 text-center text-sm text-bw-muted">No products found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              added={Boolean(addedIds[product.id])}
              saved={Boolean(savedIds[product.id])}
              onAdd={() => add(product, 1)}
              onToggleSave={() => toggleSaved(product.id)}
            />
          ))}
        </div>
      )}

      {totalPages != null && totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            className="rounded border border-bw-line px-3 py-1.5 text-sm text-bw-muted disabled:opacity-40 hover:enabled:border-bw-ink hover:enabled:text-bw-ink"
          >
            ← Prev
          </button>
          <span className="text-sm text-bw-subtle">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => goTo(page + 1)}
            disabled={page >= totalPages}
            className="rounded border border-bw-line px-3 py-1.5 text-sm text-bw-muted disabled:opacity-40 hover:enabled:border-bw-ink hover:enabled:text-bw-ink"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
