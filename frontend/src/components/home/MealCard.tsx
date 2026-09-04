import { useEffect, useId, useState } from 'react'
import { MdCheck, MdClose } from 'react-icons/md'

import { cn } from '@/lib/utils'

export default function MealCard({
  meal,
  image,
  added,
  onAddAll,
  onAddSelected,
}) {
  const [isOpen, setIsOpen] = useState(false)

  const [selectedIds, setSelectedIds] = useState(
    meal.ingredients.map((ingredient) => ingredient.product_id),
  )

  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  function openIngredients() {
    setSelectedIds(
      meal.ingredients.map((ingredient) => ingredient.product_id),
    )

    setIsOpen(true)
  }

  function toggleIngredient(productId) {
    setSelectedIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    )
  }

  function handleAddSelected() {
    const selectedIngredients = meal.ingredients.filter((ingredient) =>
      selectedIds.includes(ingredient.product_id),
    )

    onAddSelected(selectedIngredients)
    setIsOpen(false)
  }

  return (
    <>
      <article className="overflow-hidden rounded-2xl border border-bw-line bg-bw-surface">
        {/* Meal image */}
        <div className="group relative overflow-hidden bg-bw-panel">
          <img
            src={image}
            alt={meal.name}
            className="aspect-square w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035]"
          />

          {added && (
            <span className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-bw-green text-white">
              <MdCheck className="h-4 w-4" />
            </span>
          )}
        </div>

        {/* Meal details */}
        <div className="px-4 py-4">
          <p className="text-[15px] font-semibold text-bw-ink">
            {meal.name}
          </p>

          <p className="mt-1 text-[11.5px] text-bw-subtle">
            {meal.meta}
          </p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onAddAll}
              className={cn(
                'rounded-full px-4 py-2.5 text-xs font-semibold transition-colors',
                added
                  ? 'bg-bw-ink-inverse-bg text-white'
                  : 'bg-bw-green text-white hover:bg-bw-green-hover',
              )}
            >
              {added ? 'Added ✓' : 'Add all to basket'}
            </button>

            <button
              type="button"
              onClick={openIngredients}
              className="text-xs font-medium text-bw-ink underline underline-offset-3"
            >
              View ingredients
            </button>
          </div>
        </div>
      </article>

      {/* Ingredients modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 py-6"
          role="presentation"
          onMouseDown={() => setIsOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="relative w-full max-w-[34rem] rounded-sm bg-white px-7 pt-14 pb-10 text-bw-ink shadow-[0_24px_80px_rgba(0,0,0,0.42)] sm:px-12 sm:pt-16 sm:pb-12"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close ingredients"
              onClick={() => setIsOpen(false)}
              className="absolute top-5 right-5 inline-flex h-10 w-10 items-center justify-center text-bw-muted transition-colors hover:text-bw-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bw-ink"
            >
              <MdClose className="h-7 w-7" />
            </button>

            <p className="mb-4 text-xs font-semibold tracking-[0.14em] text-bw-subtle uppercase">
              Build your basket
            </p>

            <h2
              id={titleId}
              className="text-2xl leading-[1.15] font-semibold tracking-[-0.025em] text-bw-ink"
            >
              {meal.name}
            </h2>

            <p
              id={descriptionId}
              className="mt-3 text-sm leading-6 text-bw-muted"
            >
              Everything is selected. Untick anything you already have.
            </p>

            <div className="mt-7 border-t border-bw-line">
              {meal.ingredients.map((ingredient) => {
                const selected = selectedIds.includes(
                  ingredient.product_id,
                )

                return (
                  <label
                    key={ingredient.product_id}
                    className="flex cursor-pointer items-center gap-3 border-b border-bw-line py-3.5"
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() =>
                        toggleIngredient(ingredient.product_id)
                      }
                      className="h-4 w-4 shrink-0 accent-bw-green"
                    />

                    <span className="text-sm text-bw-ink">
                      {ingredient.name}
                    </span>
                  </label>
                )
              })}
            </div>

            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleAddSelected}
              className="mt-7 flex h-12 w-full items-center justify-center rounded-sm bg-bw-green px-5 text-sm font-semibold text-white transition-colors hover:bg-bw-green-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bw-green disabled:cursor-default disabled:opacity-40"
            >
              ADD {selectedIds.length}{' '}
              {selectedIds.length === 1 ? 'ITEM' : 'ITEMS'}
            </button>
          </section>
        </div>
      )}
    </>
  )
}
// import { useEffect, useId, useState } from 'react'
// import { MdCheck, MdClose } from 'react-icons/md'

// import { cn } from '@/lib/utils'

// export default function MealCard({
//   meal,
//   image,
//   added,
//   onAddAll,
//   onAddSelected,
// }) {
//   const [isOpen, setIsOpen] = useState(false)

//   const [selectedIds, setSelectedIds] = useState(
//     meal.ingredients.map((ingredient) => ingredient.product_id),
//   )

//   const titleId = useId()
//   const descriptionId = useId()

//   useEffect(() => {
//     if (!isOpen) {
//       return
//     }

//     const previousOverflow = document.body.style.overflow

//     function handleKeyDown(event) {
//       if (event.key === 'Escape') {
//         setIsOpen(false)
//       }
//     }

//     document.body.style.overflow = 'hidden'
//     document.addEventListener('keydown', handleKeyDown)

//     return () => {
//       document.body.style.overflow = previousOverflow
//       document.removeEventListener('keydown', handleKeyDown)
//     }
//   }, [isOpen])

//   function openIngredients() {
//     setSelectedIds(
//       meal.ingredients.map((ingredient) => ingredient.product_id),
//     )

//     setIsOpen(true)
//   }

//   function toggleIngredient(productId) {
//     setSelectedIds((current) =>
//       current.includes(productId)
//         ? current.filter((id) => id !== productId)
//         : [...current, productId],
//     )
//   }

//   function handleAddSelected() {
//     const selectedIngredients = meal.ingredients.filter((ingredient) =>
//       selectedIds.includes(ingredient.product_id),
//     )

//     onAddSelected(selectedIngredients)
//     setIsOpen(false)
//   }

//   return (
//     <>
//       <article className="overflow-hidden border border-bw-line bg-bw-surface">
//         {/* Meal image */}
//         <div className="group relative aspect-[4/3] overflow-hidden bg-bw-panel">
//           <img
//             src={image}
//             alt={meal.name}
//             className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035]"
//           />

//           {added && (
//             <span className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-bw-green text-white">
//               <MdCheck className="h-4 w-4" />
//             </span>
//           )}
//         </div>

//         {/* Meal details */}
//         <div className="px-4 py-4">
//           <p className="text-[15px] font-semibold text-bw-ink">
//             {meal.name}
//           </p>

//           <p className="mt-1 text-[11.5px] text-bw-subtle">
//             {meal.meta}
//           </p>

//           <div className="mt-4 flex items-center justify-between gap-3">
//             <button
//               type="button"
//               onClick={onAddAll}
//               className={cn(
//                 'rounded-full px-4 py-2.5 text-xs font-semibold transition-colors',
//                 added
//                   ? 'bg-bw-ink-inverse-bg text-white'
//                   : 'bg-bw-green text-white hover:bg-bw-green-hover',
//               )}
//             >
//               {added ? 'Added ✓' : 'Add all to basket'}
//             </button>

//             <button
//               type="button"
//               onClick={openIngredients}
//               className="text-xs font-medium text-bw-ink underline underline-offset-3"
//             >
//               View ingredients
//             </button>
//           </div>
//         </div>
//       </article>

//       {/* Ingredients modal */}
//       {isOpen && (
//         <div
//           className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 py-6"
//           role="presentation"
//           onMouseDown={() => setIsOpen(false)}
//         >
//           <section
//             role="dialog"
//             aria-modal="true"
//             aria-labelledby={titleId}
//             aria-describedby={descriptionId}
//             className="relative w-full max-w-[34rem] rounded-sm bg-white px-7 pt-14 pb-10 text-bw-ink shadow-[0_24px_80px_rgba(0,0,0,0.42)] sm:px-12 sm:pt-16 sm:pb-12"
//             onMouseDown={(event) => event.stopPropagation()}
//           >
//             {/* Close */}
//             <button
//               type="button"
//               aria-label="Close ingredients"
//               onClick={() => setIsOpen(false)}
//               className="absolute top-5 right-5 inline-flex h-10 w-10 items-center justify-center text-bw-muted transition-colors hover:text-bw-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bw-ink"
//             >
//               <MdClose className="h-7 w-7" />
//             </button>

//             {/* Header */}
//             <p className="mb-4 text-xs font-semibold tracking-[0.14em] text-bw-subtle uppercase">
//               Build your basket
//             </p>

//             <h2
//               id={titleId}
//               className="text-2xl leading-[1.15] font-semibold tracking-[-0.025em] text-bw-ink"
//             >
//               {meal.name}
//             </h2>

//             <p
//               id={descriptionId}
//               className="mt-3 text-sm leading-6 text-bw-muted"
//             >
//               Everything is selected. Untick anything you already have.
//             </p>

//             {/* Ingredients */}
//             <div className="mt-7 border-t border-bw-line">
//               {meal.ingredients.map((ingredient) => {
//                 const selected = selectedIds.includes(
//                   ingredient.product_id,
//                 )

//                 return (
//                   <label
//                     key={ingredient.product_id}
//                     className="flex cursor-pointer items-center gap-3 border-b border-bw-line py-3.5"
//                   >
//                     <input
//                       type="checkbox"
//                       checked={selected}
//                       onChange={() =>
//                         toggleIngredient(ingredient.product_id)
//                       }
//                       className="h-4 w-4 shrink-0 accent-bw-green"
//                     />

//                     <span className="text-sm text-bw-ink">
//                       {ingredient.name}
//                     </span>
//                   </label>
//                 )
//               })}
//             </div>

//             {/* Primary action */}
//             <button
//               type="button"
//               disabled={selectedIds.length === 0}
//               onClick={handleAddSelected}
//               className="mt-7 flex h-12 w-full items-center justify-center rounded-sm bg-bw-green px-5 text-sm font-semibold text-white transition-colors hover:bg-bw-green-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bw-green disabled:cursor-default disabled:opacity-40"
//             >
//               ADD {selectedIds.length}{' '}
//               {selectedIds.length === 1 ? 'ITEM' : 'ITEMS'}
//             </button>
//           </section>
//         </div>
//       )}
//     </>
//   )
// }