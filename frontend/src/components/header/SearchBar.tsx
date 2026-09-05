import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { getProducts } from '@/api/client'
import type { Product } from '@/api/client'
import searchIcon from '@/assets/icons/search.svg'
import SearchResultItem from '@/components/search/SearchResultItem'

const DEBOUNCE_MS = 300
const AUTOCOMPLETE_LIMIT = 6
const MIN_QUERY_LENGTH = 2

export default function SearchBar() {
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const requestId = useRef(0)

  useEffect(() => {
    const trimmed = query.trim()

    // Don't search for extremely short queries
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([])
      setLoading(false)
      return
    }

    // Used to cancel an old request if the user keeps typing
    const controller = new AbortController()

    // Used to stop an older request overwriting newer results
    const currentRequest = ++requestId.current

    // Wait 300ms before calling the API
    const timer = window.setTimeout(async () => {
      setLoading(true)

      try {
        const products = await getProducts(
          {
            q: trimmed,
            limit: AUTOCOMPLETE_LIMIT,
          },
          controller.signal,
        )

        if (requestId.current === currentRequest) {
          setResults(products)
          setOpen(true)
        }
      } catch (error) {
        // Ignore requests that we deliberately cancelled
        if (!controller.signal.aborted) {
          console.error('Autocomplete search failed', error)

          if (requestId.current === currentRequest) {
            setResults([])
          }
        }
      } finally {
        if (
          !controller.signal.aborted &&
          requestId.current === currentRequest
        ) {
          setLoading(false)
        }
      }
    }, DEBOUNCE_MS)

    // If user types again before 300ms:
    // cancel the timer and cancel any old request
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  function goToFullSearch() {
    const trimmed = query.trim()

    if (!trimmed) return

    setOpen(false)

    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  function openProduct(productId: string) {
    setOpen(false)

    navigate(`/product/${encodeURIComponent(productId)}`)
  }

  return (
    <form
      role="search"
      className="relative w-full min-w-0"
      onSubmit={(event) => {
        event.preventDefault()
        goToFullSearch()
      }}
      onFocus={() => {
        if (query.trim().length >= MIN_QUERY_LENGTH) {
          setOpen(true)
        }
      }}
      onBlur={(event) => {
        // Only close if focus has completely left the search component
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false)
        }
      }}
    >
      <label htmlFor="header-search" className="sr-only">
        Search groceries
      </label>

      <div className="relative w-full min-w-0">
        {/* Clicking search icon performs full search */}
        <button
          type="submit"
          aria-label="Search groceries"
          className="absolute top-1/2 left-2.5 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          <img
            src={searchIcon}
            alt=""
            className="h-5 w-5 invert opacity-90"
          />
        </button>

        <input
          id="header-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
          autoComplete="off"
          placeholder="Search groceries..."
          className="h-9 w-full min-w-0 rounded-full border-0 bg-white/10 pr-3 pl-9 text-xs text-white outline-none transition-colors placeholder:text-sm placeholder:text-white/40 hover:bg-white/12 focus:bg-white/15"
        />
      </div>

      {/* Autocomplete dropdown */}
      {open && query.trim().length >= MIN_QUERY_LENGTH && (
        <div className="absolute top-[calc(100%+8px)] left-0 z-50 w-full overflow-hidden rounded-xl border border-bw-line bg-bw-surface text-bw-ink shadow-xl">
          {loading ? (
            <p className="px-4 py-4 text-xs text-bw-muted">
              Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-4 text-xs text-bw-muted">
              No matching groceries found.
            </p>
          ) : (
            <ul role="listbox" aria-label="Search suggestions">
              {results.map((product) => (
                <li
                  key={product.id}
                  role="option"
                  aria-selected="false"
                >
                  <button
                    type="button"
                    onClick={() => openProduct(product.id)}
                    className="w-full border-b border-bw-line px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-bw-panel focus:bg-bw-panel focus:outline-none"
                  >
                    <SearchResultItem
                      product={product}
                      compact
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* User can also go to full results screen */}
          <button
            type="submit"
            className="flex w-full items-center justify-between border-t border-bw-line bg-bw-panel px-4 py-2.5 text-left text-xs font-semibold text-bw-ink hover:bg-bw-green-tint focus:outline-none"
          >
            <span>
              See all results for “{query.trim()}”
            </span>

            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </form>
  )
}