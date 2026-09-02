import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { getCategories, type Category } from '@/api/client'
import { cn } from '@/lib/utils'

export default function BrowsePageSidebar() {
  const [categories, setCategories] = useState<Category[]>([])
  const [searchParams] = useSearchParams()
  const activeCategory = searchParams.get('category')

  useEffect(() => {
    const controller = new AbortController()
    getCategories(controller.signal).then(setCategories).catch(() => {})
    return () => controller.abort()
  }, [])

  return (
    <aside className="hidden w-56 shrink-0 border-r border-bw-line lg:block">
      <nav className="sticky top-16 max-h-[calc(100svh-4rem)] overflow-y-auto py-6 pr-4">
        <p className="mb-3 px-3 font-archivo text-[10.5px] font-bold tracking-[.18em] text-bw-subtle uppercase">
          Categories
        </p>

        <Link
          to="/browse"
          className={cn(
            'block rounded px-3 py-1.5 text-[13px] transition-colors',
            !activeCategory ? 'bg-bw-panel font-semibold text-bw-ink' : 'text-bw-muted hover:text-bw-ink',
          )}
        >
          All products
        </Link>

        {categories.map((cat) => (
          <Link
            key={cat.id}
            to={`/browse?category=${cat.id}`}
            className={cn(
              'block rounded px-3 py-1.5 text-[13px] transition-colors',
              activeCategory === cat.id
                ? 'bg-bw-panel font-semibold text-bw-ink'
                : 'text-bw-muted hover:text-bw-ink',
            )}
          >
            {cat.name}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
