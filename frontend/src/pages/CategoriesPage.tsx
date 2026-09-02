import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { getCategories } from '@/data/browseApi'

const SKELETON_COUNT = 10

export default function CategoriesPage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    getCategories().then((result) => {
      if (!cancelled) {
        setCategories(result)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-[1160px] px-6 pt-9.5 pb-16 lg:px-10">
      <div className="mb-5">
        <h1 className="mb-2 font-newsreader text-[34px] font-normal tracking-[-.015em] text-bw-ink">
          Browse all groceries
        </h1>
        <p className="max-w-[52ch] text-sm text-bw-muted">
          Pick a department to see it compared across Woolworths, Coles and
          ALDI.
        </p>
      </div>

      {loading ? (
        <div
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5"
          aria-hidden="true"
        >
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col items-center rounded-xl bg-bw-panel p-4"
            >
              <div className="animate-bw-skeleton aspect-square w-full rounded-lg bg-bw-line" />
              <div className="animate-bw-skeleton mt-3 h-3 w-3/5 rounded-sm bg-bw-line" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/browse?category=${category.id}`}
              className="flex flex-col items-center rounded-xl bg-bw-panel p-4 text-bw-ink transition-colors hover:bg-bw-line focus-visible:ring-2 focus-visible:ring-bw-green focus-visible:outline-none"
            >
              <div
                className="relative flex aspect-square w-full items-center justify-center rounded-lg border border-bw-line-strong"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(135deg,#F3F1EA 0 8px,#EDEBE2 8px 16px)',
                }}
              >
                <span
                  aria-hidden="true"
                  className="text-center font-mono text-[11px] leading-snug text-[#9B9A8F]"
                >
                  category image
                </span>
              </div>

              <span className="mt-3 text-center text-[13.5px] font-semibold">
                {category.name}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
