import { categories } from '@/data/categories'

export default function CategoryGrid() {
  return (
    <section
      id="browse"
      className="mx-auto max-w-[1160px] px-6 pt-14 lg:px-10"
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className="mb-2 font-newsreader text-[34px] font-normal tracking-[-.015em] text-bw-ink">
            Browse all groceries
          </h2>
          <p className="max-w-[52ch] text-sm text-bw-muted">
            Categories for people who don't know exactly what to search for.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border border-bw-line bg-bw-line sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((category, i) => (
          <a
            key={category.name}
            href="#browse"
            className="flex flex-col gap-1.5 bg-bw-surface px-4 pt-4.5 pb-5 text-bw-ink transition-colors hover:bg-bw-panel"
          >
            <span className="font-newsreader text-[15px] text-bw-line-strong">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-[13.5px] font-semibold">
              {category.name}
            </span>
            <span className="text-[11.5px] text-bw-subtle">
              {category.count}
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}
