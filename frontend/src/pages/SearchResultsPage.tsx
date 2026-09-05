import { useEffect, useState } from 'react'
import {
  useNavigate,
  useSearchParams,
} from 'react-router'

import { getProductsPage } from '@/api/client'
import type { Product } from '@/api/client'

import SearchResultItem from '@/components/search/SearchResultItem'

const PAGE_SIZE = 24

export default function SearchResultsPage() {
  const navigate = useNavigate()

  const [searchParams] = useSearchParams()

  const query =
    searchParams.get('q')?.trim() ?? ''

  const [items, setItems] = useState<Product[]>(
    [],
  )

  const [total, setTotal] = useState(0)

  const [loading, setLoading] =
    useState(true)

  const [loadingMore, setLoadingMore] =
    useState(false)

  const [error, setError] =
    useState(false)

  useEffect(() => {
    if (!query) {
      setItems([])
      setTotal(0)
      setLoading(false)
      return
    }

    const controller =
      new AbortController()

    setLoading(true)
    setError(false)

    getProductsPage(
      {
        q: query,
        limit: PAGE_SIZE,
        offset: 0,
      },
      controller.signal,
    )
      .then(
        ({
          data,
          total: resultTotal,
        }) => {
          setItems(data)

          setTotal(
            resultTotal ?? data.length,
          )
        },
      )
      .catch((fetchError) => {
        if (!controller.signal.aborted) {
          console.error(
            'Search results failed',
            fetchError,
          )

          setError(true)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [query])

  async function loadMore() {
    setLoadingMore(true)
    setError(false)

    try {
      const {
        data,
        total: resultTotal,
      } = await getProductsPage({
        q: query,
        limit: PAGE_SIZE,
        offset: items.length,
      })

      setItems((current) => [
        ...current,
        ...data,
      ])

      setTotal(
        resultTotal ??
          items.length + data.length,
      )
    } catch (fetchError) {
      console.error(
        'Loading more search results failed',
        fetchError,
      )

      setError(true)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <main className="w-full px-6 py-9 lg:px-8 xl:px-12 2xl:px-16">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2 border-b border-bw-line pb-4">
          <div>
            <p className="text-[10.5px] font-bold tracking-[.14em] text-bw-green uppercase">
              Search
            </p>

            <h1 className="mt-1 text-[30px] text-bw-ink">
              {query
                ? `Results for “${query}”`
                : 'Search groceries'}
            </h1>
          </div>

          {!loading && query && (
            <span className="text-xs text-bw-muted">
              {total} result
              {total === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {loading ? (
          <div
            className="space-y-2"
            aria-hidden="true"
          >
            {Array.from({
              length: 6,
            }).map((_, index) => (
              <div
                key={index}
                className="animate-bw-skeleton h-[118px] rounded-xl bg-bw-panel"
              />
            ))}
          </div>
        ) : !query ? (
          <p className="text-sm text-bw-muted">
            Enter a grocery name in the
            search bar above.
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-bw-muted">
            No groceries matched “{query}”.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {items.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() =>
                    navigate(
                      `/product/${encodeURIComponent(
                        product.id,
                      )}`,
                    )
                  }
                  className="rounded-xl border border-bw-line bg-bw-surface p-3 text-left transition-colors hover:bg-bw-panel focus-visible:ring-2 focus-visible:ring-bw-green focus-visible:outline-none"
                >
                  <SearchResultItem
                    product={product}
                  />
                </button>
              ))}
            </div>

            {items.length < total && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={loadMore}
                  className="rounded-full border border-bw-ink px-5 py-2.5 text-xs font-semibold text-bw-ink hover:bg-bw-panel disabled:opacity-50"
                >
                  {loadingMore
                    ? 'Loading…'
                    : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}

        {error && (
          <p className="mt-4 text-xs text-red-700">
            Something went wrong while
            loading results. Please try
            again.
          </p>
        )}
      </div>
    </main>
  )
}