import {
  RETAILER_LABEL,
  discountPercent,
  formatSize,
  formatUnitPrice,
  type Product,
} from '@/api/client'
import { cn } from '@/lib/utils'

export default function ProductCard({
  product,
  added,
  saved,
  onAdd,
  onToggleSave,
}: {
  product: Product
  added: boolean
  saved: boolean
  onAdd: () => void
  onToggleSave: () => void
}) {
  const discount = discountPercent(product)
  const unitPrice = formatUnitPrice(product)
  const size = formatSize(product)

  return (
    <div className="flex flex-col border border-bw-line bg-bw-surface">
      <div
        className="relative flex aspect-square items-center justify-center p-3"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg,#F3F1EA 0 8px,#EDEBE2 8px 16px)',
        }}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-center font-mono text-[9.5px] leading-snug text-[#9B9A8F]">
            {size || product.name.toLowerCase()}
          </span>
        )}

        {discount !== null && (
          <span className="absolute top-2 left-2 rounded-full bg-bw-green px-1.75 py-1 font-archivo text-[10px] font-bold tracking-[.04em] text-white">
            {discount}% off
          </span>
        )}
      </div>

      <div className="px-3 pt-3">
        {product.was_price !== null && product.min_price !== null && (
          <span className="mb-2 inline-block bg-bw-yellow px-1.5 py-0.75 font-archivo text-[10px] font-bold text-bw-yellow-ink">
            SAVE ${(product.was_price - product.min_price).toFixed(2)}
          </span>
        )}

        <p className="font-newsreader text-[26px] leading-none text-bw-ink">
          {product.min_price !== null ? `$${product.min_price.toFixed(2)}` : '—'}
        </p>
        <p className="mt-1 mb-0.5 text-[11px] text-bw-subtle">{unitPrice}</p>
        <p className="mb-2 text-[11px] font-semibold text-bw-red">
          {product.was_price !== null ? `was $${product.was_price.toFixed(2)}` : ''}
        </p>
        <p className="mb-1.5 min-h-13 text-[12.5px] leading-snug text-bw-ink">
          {product.name}
        </p>
        {product.rating_avg !== null ? (
          <p className="mb-3 text-[11px] text-bw-subtle">
            ★ {product.rating_avg?.toFixed(1)}{' '}
            <span className="underline">({product.rating_count})</span>
          </p>
        ) : (
          <p className="mb-3 text-[11px] text-bw-subtle">
            {product.cheapest_retailer
              ? `from ${RETAILER_LABEL[product.cheapest_retailer as keyof typeof RETAILER_LABEL]}`
              : ''}
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-1.5 px-3 pb-3">
        <button
          type="button"
          onClick={onAdd}
          className={cn(
            'w-full rounded-sm px-2.5 py-2.25 font-archivo text-xs font-semibold text-white transition-colors',
            added ? 'bg-bw-ink-inverse-bg' : 'bg-bw-green',
          )}
        >
          {added ? 'In basket ✓' : 'Add to basket'}
        </button>

        <button
          type="button"
          onClick={onToggleSave}
          className={cn(
            'w-full rounded-sm border px-2.5 py-2.25 font-archivo text-xs font-semibold transition-colors',
            saved
              ? 'border-bw-ink bg-bw-panel text-bw-ink'
              : 'border-bw-line-strong bg-bw-surface text-bw-ink',
          )}
        >
          {saved ? 'Saved' : 'Save to list'}
        </button>
      </div>
    </div>
  )
}
