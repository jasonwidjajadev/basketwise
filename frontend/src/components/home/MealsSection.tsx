import { useEffect, useRef, useState } from 'react'
import { MdChevronLeft, MdChevronRight } from 'react-icons/md'

import MealCard from '@/components/home/MealCard'
import meals from '@/mocks/home/meals.json'
import { cn } from '@/lib/utils'

import beefTacos from '@/assets/images/meal/beef-tacos.png'
import chickenCurryRice from '@/assets/images/meal/chicken-curry-rice.png'
import chickenStirFryRice from '@/assets/images/meal/chicken-stir-fry-rice.png'
import chickenTrayBake from '@/assets/images/meal/chicken-tray-bake.png'
import spaghettiBolognese from '@/assets/images/meal/spaghetti-bolognese.png'
import vegetableChickpeaCurry from '@/assets/images/meal/vegetable-chickpea-curry.png'

const MEAL_IMAGES = {
  'spaghetti-bolognese': spaghettiBolognese,
  'chicken-stir-fry-rice': chickenStirFryRice,
  'beef-tacos': beefTacos,
  'chicken-curry-rice': chickenCurryRice,
  'chicken-tray-bake': chickenTrayBake,
  'vegetable-chickpea-curry': vegetableChickpeaCurry,
}

export default function MealsSection() {
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
    const gap = Number.parseFloat(
      styles.columnGap || styles.gap || '0',
    )

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

  function handleDemoAdd() {
    // Demo only.
    // Meal ingredients are not connected to canonical product IDs yet.
  }

  return (
    <section id="meals" className="w-full py-14">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <h2 className="text-base font-bold tracking-[.2em] text-bw-ink uppercase">
            Cook it, shop it
          </h2>

          <p className="mt-2 text-sm text-bw-muted">
            Pick a meal. Add everything, or choose only what you need.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Previous meals"
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
            aria-label="Next meals"
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
        {meals.map((meal) => (
          <div
            key={meal.id}
            className="w-56 shrink-0 snap-start sm:w-64 lg:w-72"
          >
            <MealCard
              meal={meal}
              image={MEAL_IMAGES[meal.id]}
              added={false}
              onAddAll={handleDemoAdd}
              onAddSelected={handleDemoAdd}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

// fake
// import meals from '@/mocks/home/meals.json'
// import MealCard from '@/components/home/MealCard'

// import beefTacos from '@/assets/images/meal/beef-tacos.png'
// import chickenCurryRice from '@/assets/images/meal/chicken-curry-rice.png'
// import chickenStirFryRice from '@/assets/images/meal/chicken-stir-fry-rice.png'
// import chickenTrayBake from '@/assets/images/meal/chicken-tray-bake.png'
// import spaghettiBolognese from '@/assets/images/meal/spaghetti-bolognese.png'
// import vegetableChickpeaCurry from '@/assets/images/meal/vegetable-chickpea-curry.png'

// const MEAL_IMAGES = {
//   'spaghetti-bolognese': spaghettiBolognese,
//   'chicken-stir-fry-rice': chickenStirFryRice,
//   'beef-tacos': beefTacos,
//   'chicken-curry-rice': chickenCurryRice,
//   'chicken-tray-bake': chickenTrayBake,
//   'vegetable-chickpea-curry': vegetableChickpeaCurry,
// }

// export default function MealsSection() {
//   function handleDemoAdd() {
//     // Demo only.
//     // Meal ingredients are not connected to canonical product IDs yet,
//     // so nothing is added to the basket.
//   }

//   return (
//     <section id="meals" className="w-full py-14">
//       <h2 className="mb-4 text-base font-bold tracking-[.2em] text-bw-ink uppercase">
//         Cook it, shop it
//       </h2>

//       <div className="border border-bw-line bg-bw-panel px-6 pt-10 pb-9 sm:px-10">
//         <h3 className="text-base font-bold tracking-[.2em] text-bw-ink uppercase">
//           Pick a meal, and every ingredient lands in your basket.
//         </h3>

//         <p className="mt-3.5 mb-7 max-w-[56ch] text-sm leading-relaxed text-bw-body">
//           Add the whole ingredient list in one click, or choose only what you
//           still need.
//         </p>

//         <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
//           {meals.map((meal) => (
//             <MealCard
//               key={meal.id}
//               meal={meal}
//               image={MEAL_IMAGES[meal.id]}
//               added={false}
//               onAddAll={handleDemoAdd}
//               onAddSelected={handleDemoAdd}
//             />
//           ))}
//         </div>
//       </div>
//     </section>
//   )
// }


















// working

// import { useCart } from '@/context/useCart'
// import meals from '@/mocks/home/meals.json'
// import MealCard from '@/components/home/MealCard'

// import beefTacos from '@/assets/images/meal/beef-tacos.png'
// import chickenCurryRice from '@/assets/images/meal/chicken-curry-rice.png'
// import chickenStirFryRice from '@/assets/images/meal/chicken-stir-fry-rice.png'
// import chickenTrayBake from '@/assets/images/meal/chicken-tray-bake.png'
// import spaghettiBolognese from '@/assets/images/meal/spaghetti-bolognese.png'
// import vegetableChickpeaCurry from '@/assets/images/meal/vegetable-chickpea-curry.png'

// const MEAL_IMAGES = {
//   'spaghetti-bolognese': spaghettiBolognese,
//   'chicken-stir-fry-rice': chickenStirFryRice,
//   'beef-tacos': beefTacos,
//   'chicken-curry-rice': chickenCurryRice,
//   'chicken-tray-bake': chickenTrayBake,
//   'vegetable-chickpea-curry': vegetableChickpeaCurry,
// }

// export default function MealsSection() {
//   const { addedIds, add } = useCart()

//   function addIngredients(ingredients) {
//     ingredients.forEach((ingredient) => {
//       add(ingredient.product_id, ingredient.quantity ?? 1)
//     })
//   }

//   return (
//     <section id="meals" className="w-full py-14">
//       <h2 className="mb-4 text-base font-bold tracking-[.2em] text-bw-ink uppercase">
//         Cook it, shop it
//       </h2>

//       <div className="border border-bw-line bg-bw-panel px-6 pt-10 pb-9 sm:px-10">
//         <h3 className="text-2xl font-medium tracking-[-0.02em] text-bw-ink">
//           Pick a meal, and every ingredient lands in your basket.
//         </h3>

//         <p className="mt-3 mb-7 max-w-[58ch] text-sm leading-relaxed text-bw-body">
//           Add the whole ingredient list in one click, or choose only what you
//           still need.
//         </p>

//         <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
//           {meals.map((meal) => (
//             <MealCard
//               key={meal.id}
//               meal={meal}
//               image={MEAL_IMAGES[meal.id]}
//               added={meal.ingredients.every(
//                 (ingredient) => addedIds[ingredient.product_id],
//               )}
//               onAddAll={() => addIngredients(meal.ingredients)}
//               onAddSelected={addIngredients}
//             />
//           ))}
//         </div>
//       </div>
//     </section>
//   )
// }