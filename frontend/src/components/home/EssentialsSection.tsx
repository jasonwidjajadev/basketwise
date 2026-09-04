import { useEffect, useRef, useState } from 'react'
import { MdChevronLeft, MdChevronRight } from 'react-icons/md'

import ProductCard from '@/components/ProductCard'
import { useCart } from '@/context/useCart'
import essentials from '@/mocks/home/essentials.json'
import { cn } from '@/lib/utils'

export default function EssentialsSection() {
  const { addedIds, add, remove } = useCart()

  const sliderRef = useRef<HTMLDivElement | null>(null)

  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  function updateScrollState() {
    const slider = sliderRef.current

    if (!slider) return

    const maxScrollLeft = slider.scrollWidth - slider.clientWidth

    setCanScrollLeft(slider.scrollLeft > 2)
    setCanScrollRight(slider.scrollLeft < maxScrollLeft - 2)
  }

  function scroll(direction: 'left' | 'right') {
    const slider = sliderRef.current

    if (!slider) return

    const firstCard = slider.firstElementChild as HTMLElement | null

    if (!firstCard) return

    const styles = window.getComputedStyle(slider)
    const gap = Number.parseFloat(styles.columnGap || '0')

    const amount = firstCard.offsetWidth + gap

    slider.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    })
  }

  useEffect(() => {
    updateScrollState()

    window.addEventListener('resize', updateScrollState)

    return () => {
      window.removeEventListener('resize', updateScrollState)
    }
  }, [])

  return (
    <section
      id="essentials"
      className="w-full scroll-mt-27 py-5"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-bold tracking-[.2em] text-bw-ink uppercase">
          Essentials
        </h2>

        <div className="flex items-center gap-4">
          <span className="hidden text-xs text-bw-subtle sm:block">
            Prices from your nearest four stores · updated 6 min ago
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous essentials"
              disabled={!canScrollLeft}
              onClick={() => scroll('left')}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors',
                canScrollLeft
                  ? 'bg-black/45 hover:bg-black/60'
                  : 'cursor-default bg-black/15',
              )}
            >
              <MdChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              aria-label="Next essentials"
              disabled={!canScrollRight}
              onClick={() => scroll('right')}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors',
                canScrollRight
                  ? 'bg-black/45 hover:bg-black/60'
                  : 'cursor-default bg-black/15',
              )}
            >
              <MdChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={sliderRef}
        onScroll={updateScrollState}
        className="
          grid grid-flow-col grid-rows-2
          auto-cols-[calc((100%_-_0.875rem)/2)]
          gap-x-3.5 gap-y-8
          overflow-x-auto scroll-smooth
          snap-x snap-mandatory
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
          sm:auto-cols-[calc((100%_-_1.75rem)/3)]
          lg:auto-cols-[calc((100%_-_3.5rem)/5)]
        "
      >
        {essentials.map((product) => (
          <div
            key={product.id}
            className="min-w-0 snap-start"
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
    </section>
  )
}