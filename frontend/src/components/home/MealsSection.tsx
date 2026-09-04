import meals from '@/mocks/home/meals.json'
import MealCard from '@/components/home/MealCard'

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
  function handleDemoAdd() {
    // Demo only.
    // Meal ingredients are not connected to canonical product IDs yet,
    // so nothing is added to the basket.
  }

  return (
    <section id="meals" className="w-full py-14">
      <h2 className="mb-4 text-base font-bold tracking-[.2em] text-bw-ink uppercase">
        Cook it, shop it
      </h2>

      <div className="border border-bw-line bg-bw-panel px-6 pt-10 pb-9 sm:px-10">
        <h3 className="text-base font-bold tracking-[.2em] text-bw-ink uppercase">
          Pick a meal, and every ingredient lands in your basket.
        </h3>

        <p className="mt-3.5 mb-7 max-w-[56ch] text-sm leading-relaxed text-bw-body">
          Add the whole ingredient list in one click, or choose only what you
          still need.
        </p>

        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              image={MEAL_IMAGES[meal.id]}
              added={false}
              onAddAll={handleDemoAdd}
              onAddSelected={handleDemoAdd}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

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