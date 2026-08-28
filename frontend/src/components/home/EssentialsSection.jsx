import { useCart } from '@/context/useCart'
import { essentials } from '@/data/essentials'
import ProductCard from '@/components/home/ProductCard'

export default function EssentialsSection() {
  const { addedIds, savedIds, add, toggleSaved } = useCart()

  return (
    <section
      id="essentials"
      className="mx-auto max-w-[1160px] px-6 pt-9.5 pb-2.5 lg:px-10"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-archivo text-[13px] font-bold tracking-[.2em] text-bw-ink uppercase">
          Essentials
        </h2>
        <span className="text-xs text-bw-subtle">
          Prices from your nearest four stores · updated 6 min ago
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        {essentials.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            added={Boolean(addedIds[product.id])}
            saved={Boolean(savedIds[product.id])}
            onAdd={() => add(product.id, 1)}
            onToggleSave={() => toggleSaved(product.id)}
          />
        ))}
      </div>
    </section>
  )
}
