import { useCart } from '@/context/useCart'
import ProductCard from '@/components/ProductCard'
import essentials from '@/mocks/home/essentials.json'

export default function EssentialsSection() {
  const { addedIds, add, remove } = useCart()

  return (
    <section
      id="essentials"
      className="w-full pt-9.5 pb-2.5"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-bold tracking-[.2em] text-bw-ink uppercase">
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
            onAdd={() => add(product.id, 1)}
            onRemove={() => remove(product.id)}
          />
        ))}
      </div>
    </section>
  )
}