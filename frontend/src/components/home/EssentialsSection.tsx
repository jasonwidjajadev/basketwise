import { useEffect, useState } from 'react'

import { getEssentials, type Product } from '@/api/client'
import ProductCard from '@/components/home/ProductCard'
import { useCart } from '@/context/useCart'

function SkeletonCard() {
  return (
    <div className="flex animate-pulse flex-col border border-bw-line bg-bw-surface">
      <div className="aspect-square bg-bw-panel" />
      <div className="space-y-2 p-3">
        <div className="h-6 rounded bg-bw-panel" />
        <div className="h-3 w-2/3 rounded bg-bw-panel" />
        <div className="h-10 rounded bg-bw-panel" />
      </div>
    </div>
  )
}

export default function EssentialsSection() {
  const { addedIds, savedIds, add, toggleSaved } = useCart()
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    const controller = new AbortController()
    getEssentials(controller.signal)
      .then(setProducts)
      .catch(() => {})
    return () => controller.abort()
  }, [])

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
          Prices across Coles, Woolworths & ALDI · updated daily
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        {products.length === 0
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                added={Boolean(addedIds[product.id])}
                saved={Boolean(savedIds[product.id])}
                onAdd={() => add(product, 1)}
                onToggleSave={() => toggleSaved(product.id)}
              />
            ))}
      </div>
    </section>
  )
}
