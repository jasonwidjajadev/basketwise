import { useState } from 'react'
import { MdExpandMore } from 'react-icons/md'

import { cn } from '@/lib/utils'

function CategoryAccordionList({ categories, category, subcategory, expandedCategory, onHeaderClick, onSelectSub }) {
  return (
    <div>
      {categories.map((cat) => {
        const isExpanded = cat.id === expandedCategory
        const isActive = cat.id === category

        return (
          <div
            key={cat.id}
            className="border-b border-bw-line last:border-b-0"
          >
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-current={isActive && !subcategory ? 'true' : undefined}
              onClick={() => onHeaderClick(cat.id, isExpanded)}
              className={cn(
                'flex w-full items-center justify-between gap-2.5 px-3.5 py-2.75 text-left font-archivo text-[13px] text-bw-ink transition-colors hover:bg-bw-panel focus-visible:ring-2 focus-visible:ring-bw-green focus-visible:outline-none',
                isActive && !subcategory && 'bg-bw-panel font-semibold',
              )}
            >
              <span className="truncate">{cat.name}</span>
              <MdExpandMore
                className={cn(
                  'h-4 w-4 shrink-0 text-bw-subtle transition-transform motion-reduce:transition-none',
                  isExpanded && 'rotate-180',
                )}
              />
            </button>

            <div
              aria-hidden={!isExpanded}
              className={cn(
                'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
                isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col px-2 pb-2.5">
                  {cat.subcategories.map((sub) => {
                    const isSubActive = subcategory === sub.id && category === cat.id
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        tabIndex={isExpanded ? 0 : -1}
                        aria-current={isSubActive ? 'true' : undefined}
                        onClick={() => onSelectSub(cat.id, isSubActive ? null : sub.id)}
                        className={cn(
                          'px-5 py-2 text-left font-archivo text-[12.5px] text-bw-body transition-colors hover:bg-bw-panel hover:text-bw-ink focus-visible:ring-2 focus-visible:ring-bw-green focus-visible:outline-none',
                          isSubActive && 'bg-bw-panel font-semibold text-bw-ink',
                        )}
                      >
                        {sub.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function CategorySidebar({ categories, loading, category, subcategory, onSelect }) {
  const [expandedCategory, setExpandedCategory] = useState(category)

  function handleHeaderClick(catId, isExpanded) {
    const switchingCategory = catId !== category
    setExpandedCategory(isExpanded ? null : catId)
    if (switchingCategory) {
      onSelect(catId, null)
    }
  }

  const listProps = {
    categories,
    category,
    subcategory,
    expandedCategory,
    onHeaderClick: handleHeaderClick,
    onSelectSub: onSelect,
  }

  const body = loading ? (
    <p className="px-3.5 py-4 font-archivo text-[12.5px] text-bw-muted">Loading categories…</p>
  ) : (
    <CategoryAccordionList {...listProps} />
  )

  return (
    <>
      {/* Desktop: permanent sidebar column */}
      <aside className="hidden w-64 shrink-0 border border-bw-line bg-bw-surface lg:block">
        <div className="border-b border-bw-line px-3.5 py-3.5 font-archivo text-[11px] font-bold tracking-[.12em] text-bw-ink uppercase">
          Categories
        </div>
        {body}
      </aside>

      {/* Mobile/tablet: same permanent accordion, stacked above the product grid */}
      <div className="border border-bw-line bg-bw-surface lg:hidden">
        <div className="border-b border-bw-line px-3.5 py-3.5 font-archivo text-[11px] font-bold tracking-[.12em] text-bw-ink uppercase">
          Categories
        </div>
        {body}
      </div>
    </>
  )
}
