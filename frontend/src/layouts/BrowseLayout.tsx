import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'

import CategorySidebar from '@/components/browse/CategorySidebar'
import { getCategories } from '@/data/browseApi'

export default function BrowseLayout() {
  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [category, setCategory] = useState(null)
  const [subcategory, setSubcategory] = useState(null)

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

  function selectCategory(nextCategory, nextSubcategory = null) {
    setCategory(nextCategory)
    setSubcategory(nextSubcategory)
  }

  return (
    <div className="flex w-full flex-col gap-4 px-6 py-6 lg:min-h-[calc(100svh-4rem)] lg:flex-row lg:items-start lg:gap-7 lg:px-8 xl:px-12">
      <CategorySidebar
        categories={categories}
        loading={categoriesLoading}
        category={category}
        subcategory={subcategory}
        onSelect={selectCategory}
      />

      <main className="min-w-0 flex-1">
        <Outlet context={{ categories, category, subcategory, selectCategory }} />
      </main>
    </div>
  )
}
