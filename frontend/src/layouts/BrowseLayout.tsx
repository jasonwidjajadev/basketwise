import { useEffect, useState } from 'react'
import { Outlet, useSearchParams } from 'react-router'

import { getCategories } from '@/api/browseApi'
import CategorySidebar from '@/components/browse/CategorySidebar'

const DEFAULT_CATEGORY = 'fruit-vegetables'

export default function BrowseLayout() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)

  const category = searchParams.get('category') || DEFAULT_CATEGORY
  const subcategory = searchParams.get('subcategory')

  useEffect(() => {
    let cancelled = false

    getCategories().then((result) => {
      if (!cancelled) {
        setCategories(result)
        setCategoriesLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

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
