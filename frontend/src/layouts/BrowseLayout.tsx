import { useEffect, useState } from 'react'
import { Outlet, useSearchParams } from 'react-router'

import { getCategories } from '@/api/browseApi'
import CategorySidebar from '@/components/browse/CategorySidebar'

const DEFAULT_CATEGORY = 'fruit-vegetables'

export default function BrowseLayout() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [retryToken, setRetryToken] = useState(0)
  // Only ever set inside the effect's async callbacks below, never
  // synchronously in the effect body -- `categoriesLoading` is derived from
  // whether it matches the in-flight `retryToken`, same pattern as
  // BrowsePage's `loadedFor`.
  const [result, setResult] = useState({
    token: null,
    categories: [],
    failed: false,
  })

  const categoriesLoading = result.token !== retryToken
  const categoriesFailed = !categoriesLoading && result.failed
  const categories = result.categories

  const category = searchParams.get('category') || DEFAULT_CATEGORY
  const subcategory = searchParams.get('subcategory')

  useEffect(() => {
    let cancelled = false

    getCategories()
      .then((data) => {
        if (!cancelled)
          setResult({ token: retryToken, categories: data, failed: false })
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Failed to load categories', error)
        setResult({ token: retryToken, categories: [], failed: true })
      })

    return () => {
      cancelled = true
    }
  }, [retryToken])

  useEffect(() => {
    if (searchParams.get('category')) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('category', DEFAULT_CATEGORY)
        return next
      },
      { replace: true },
    )
  }, [searchParams, setSearchParams])

  function selectCategory(nextCategory, nextSubcategory = null) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (nextCategory) {
          next.set('category', nextCategory)
        } else {
          next.delete('category')
        }
        if (nextSubcategory) {
          next.set('subcategory', nextSubcategory)
        } else {
          next.delete('subcategory')
        }
        return next
      },
      { replace: true },
    )
  }

  return (
    <div className="animate-bw-fade-up flex w-full flex-col gap-4 px-6 py-6 lg:min-h-[calc(100svh-4rem)] lg:flex-row lg:items-start lg:gap-7 lg:px-8 xl:px-12 2xl:px-16">
      <CategorySidebar
        categories={categories}
        loading={categoriesLoading}
        failed={categoriesFailed}
        onRetry={() => setRetryToken((n) => n + 1)}
        category={category}
        subcategory={subcategory}
        onSelect={selectCategory}
      />

      <main className="min-w-0 flex-1">
        <Outlet
          context={{ categories, category, subcategory, selectCategory }}
        />
      </main>
    </div>
  )
}
