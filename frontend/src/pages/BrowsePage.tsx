import { useEffect, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router'

import { getProducts } from '@/api/browseApi'
import ProductCard from '@/components/ProductCard'
import RetailerFilter from '@/components/browse/RetailerFilter'
import SortMenu from '@/components/browse/SortMenu'
import { useCart } from '@/context/useCart'
import { SORT_OPTIONS } from '@/components/browse/browseSort'

const PAGE_SIZE = 24
const RETAILER_VALUES = ['', 'woolworths', 'coles', 'aldi', 'harrisfarm']

export default function BrowsePage() {
  const { categories, category, subcategory } = useOutletContext()
  const { addedIds, add, remove } = useCart()
  const [searchParams, setSearchParams] = useSearchParams()

  const retailerParam = searchParams.get('retailer')
  const retailer = RETAILER_VALUES.includes(retailerParam) ? retailerParam : ''

  const sortParam = searchParams.get('sort')
  const sort = SORT_OPTIONS.some((opt) => opt.value === sortParam)
    ? sortParam
    : ''

  function updateParam(key, value) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (!value) {
          next.delete(key)
        } else {
          next.set(key, value)
        }
        return next
      },
      { replace: true },
    )
  }

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  // Tracks which request `items` actually belong to, so "loading" can be
  // derived instead of set synchronously inside the effect.
  const [loadedFor, setLoadedFor] = useState(null)

  const requestKey = `${category}:${subcategory}:${retailer}:${sort}`
  const loading = loadedFor !== requestKey

  // Fetch page 1 whenever category, subcategory, retailer, or sort changes.
  useEffect(() => {
    let cancelled = false

    getProducts({
      category,
      subcategory,
      retailer,
      sort,
      limit: PAGE_SIZE,
      offset: 0,
    }).then((result) => {
      if (!cancelled) {
        setItems(result.items)
        setTotal(result.total)
        setLoadedFor(requestKey)
      }
    })

    return () => {
      cancelled = true
    }
  }, [category, subcategory, retailer, sort, requestKey])

  function loadMore() {
    setLoadingMore(true)
    getProducts({
      category,
      subcategory,
      retailer,
      sort,
      limit: PAGE_SIZE,
      offset: items.length,
    }).then((result) => {
      setItems((prev) => [...prev, ...result.items])
      setTotal(result.total)
      setLoadingMore(false)
    })
  }

  const activeCategory = categories.find((cat) => cat.id === category)
  const activeSubcategory = activeCategory?.subcategories.find(
    (sub) => sub.id === subcategory,
  )

  const heading = !activeCategory
    ? 'All groceries'
    : activeSubcategory
      ? `${activeCategory.name} — ${activeSubcategory.name}`
      : activeCategory.name

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[28px] font-normal tracking-[-.015em] text-bw-ink">
          {heading}
        </h1>
        <span className="text-xs text-bw-muted">
          {!loading && total > 0
            ? `${total} item${total === 1 ? '' : 's'}`
            : ''}
        </span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-t border-b border-bw-line py-3.5">
        <RetailerFilter
          value={retailer}
          onChange={(value) => updateParam('retailer', value)}
        />
        <SortMenu
          value={sort}
          onChange={(value) => updateParam('sort', value)}
        />
      </div>

      {loading ? (
        <div
          className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6"
          aria-hidden="true"
        >
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col border border-bw-line bg-bw-surface"
            >
              <div className="animate-bw-skeleton aspect-square bg-bw-panel" />
              <div className="flex flex-col gap-2 p-3">
                <div className="animate-bw-skeleton h-3 w-4/5 bg-bw-panel" />
                <div className="animate-bw-skeleton h-2.5 w-1/3 bg-bw-panel" />
                <div className="animate-bw-skeleton mt-2 h-14 w-full bg-bw-panel" />
                <div className="animate-bw-skeleton mt-1 h-8 w-full bg-bw-panel" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="animate-bw-fade-up flex flex-col items-start gap-1.5 border border-bw-line bg-bw-surface px-8 py-12">
          <h2 className="text-xl font-normal text-bw-ink">No products found</h2>
          <p className="max-w-[44ch] text-[13px] text-bw-muted">
            {`We don't have any products loaded for ${heading} yet.`}
          </p>
        </div>
      ) : (
        <>
          <div
            key={requestKey}
            className="grid grid-cols-2 gap-x-3.5 gap-y-12 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6"
          >
            {items.map((product, index) => (
              <div
                key={product.id}
                className="animate-bw-fade-up"
                style={{ animationDelay: `${Math.min(index * 30, 240)}ms` }}
              >
                <ProductCard
                  product={product}
                  added={Boolean(addedIds[product.id])}
                  onAdd={() => add(product.id, 1)}
                  onRemove={() => remove(product.id)}
                />
              </div>
            ))}
          </div>

          {items.length < total && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-full border border-bw-ink px-5 py-2.75 text-xs font-semibold text-bw-ink transition-colors hover:bg-bw-panel focus-visible:ring-2 focus-visible:ring-bw-green focus-visible:outline-none disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
