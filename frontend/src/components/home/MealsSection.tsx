import { useCart } from '@/context/useCart'
import { meals } from '@/data/meals'
import MealCard from '@/components/home/MealCard'

const INGREDIENTS_PER_MEAL = 8

export default function MealsSection() {
  const { addedIds, add } = useCart()

  return (
    <section id="meals" className="mx-auto max-w-[1160px] px-6 pt-14 lg:px-10">
      <div className="border border-bw-line bg-bw-panel px-6 pt-10 pb-9 sm:px-10">
        <p className="mb-3.5 font-archivo text-[10.5px] tracking-[.22em] text-bw-subtle uppercase">
          Cook it, shop it
        </p>

        <h2 className="max-w-[22ch] font-newsreader text-[32px] leading-[1.14] font-normal tracking-[-.02em] text-bw-ink sm:text-[38px]">
          Pick a meal, and every ingredient lands in your basket.
        </h2>

        <p className="mt-3.5 mb-7 max-w-[56ch] text-sm leading-relaxed text-bw-body">
          Pick tonight&rsquo;s dinner and BasketWise adds the full ingredient
          list at the best price we can find.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              added={Boolean(addedIds[meal.id])}
              onAdd={() => add(meal.id, INGREDIENTS_PER_MEAL)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
