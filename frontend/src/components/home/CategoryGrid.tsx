import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { MdChevronLeft, MdChevronRight } from 'react-icons/md'

import pantry from '@/assets/images/categories/pantry.png'
import bakery from '@/assets/images/categories/bakery.png'
import frozen from '@/assets/images/categories/frozen.png'
import meatSeafood from '@/assets/images/categories/meat-seafood.png'
import fruitVegetables from '@/assets/images/categories/fruit-vegetables.png'
import dairyEggs from '@/assets/images/categories/dairy-eggs-fridge.png'
import snacks from '@/assets/images/categories/snacks-confectionery.png'
import drinks from '@/assets/images/categories/drinks.png'
import { cn } from '@/lib/utils'

const categories = [
  {
    name: 'Pantry',
    image: pantry,
    to: '/browse?category=pantry',
  },
  {
    name: 'Bakery',
    image: bakery,
    to: '/browse?category=bakery',
  },
  {
    name: 'Meat & Seafood',
    image: meatSeafood,
    to: '/browse?category=meat-seafood',
  },
  {
    name: 'Dairy, Eggs & Fridge',
    image: dairyEggs,
    to: '/browse?category=dairy-eggs-fridge',
  },
  {
    name: 'Fruit & Vegetables',
    image: fruitVegetables,
    to: '/browse?category=fruit-vegetables',
  },
  {
    name: 'Frozen',
    image: frozen,
    to: '/browse?category=frozen',
  },
  {
    name: 'Snacks & Confectionery',
    image: snacks,
    to: '/browse?category=snacks-confectionery',
  },
  {
    name: 'Drinks',
    image: drinks,
    to: '/browse?category=drinks',
  },
]

export default function CategoryGrid() {
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
    const gap = Number.parseFloat(styles.columnGap || styles.gap || '0')

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
    <section id="browse" className="w-full py-14">
      <div className="mb-5 flex items-center justify-between gap-6">
        <h2 className="text-base font-bold tracking-[.2em] text-bw-ink uppercase">
          Shop by category
        </h2>

        <Link
          to="/browse"
          className="text-xs font-medium tracking-[0.08em] text-bw-muted uppercase transition-colors hover:text-bw-ink"
        >
          View all groceries →
        </Link>
      </div>

      <div className="relative">
        <div
          ref={sliderRef}
          onScroll={updateScrollState}
          className="
            flex snap-x snap-mandatory gap-4
            overflow-x-auto scroll-smooth
            [scrollbar-width:none]
            [&::-webkit-scrollbar]:hidden
          "
        >
          {categories.map((category) => (
            <Link
              key={category.name}
              to={category.to}
              className="
                group relative block
                w-[84%] shrink-0 snap-start
                overflow-hidden rounded-2xl
                sm:w-[68%]
                md:w-[56%]
                lg:w-[46%]
              "
            >
              <div className="aspect-[2.6/1] w-full overflow-hidden">
                <img
                  src={category.image}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035]"
                />
              </div>

              <div className="absolute inset-0 bg-black/15 transition-colors duration-300 group-hover:bg-black/20" />

              <span className="absolute inset-0 flex items-center justify-center px-6 text-center text-xl font-semibold tracking-[0.08em] text-white uppercase sm:text-2xl">
                {category.name}
              </span>
            </Link>
          ))}
        </div>

        <button
          type="button"
          aria-label="Previous category"
          disabled={!canScrollLeft}
          onClick={() => scroll('left')}
          className={cn(
            'absolute top-1/2 left-4 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-white transition-colors',
            canScrollLeft
              ? 'bg-black/45 hover:bg-black/60'
              : 'pointer-events-none bg-black/20 opacity-0',
          )}
        >
          <MdChevronLeft className="h-6 w-6" />
        </button>

        <button
          type="button"
          aria-label="Next category"
          disabled={!canScrollRight}
          onClick={() => scroll('right')}
          className={cn(
            'absolute top-1/2 right-4 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-white transition-colors',
            canScrollRight
              ? 'bg-black/45 hover:bg-black/60'
              : 'pointer-events-none bg-black/20 opacity-0',
          )}
        >
          <MdChevronRight className="h-6 w-6" />
        </button>
      </div>
    </section>
  )
}