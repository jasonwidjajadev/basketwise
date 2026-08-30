import { useRef, useState } from 'react'
import { MdCheck } from 'react-icons/md'

import { cn } from '@/lib/utils'

const POP_DURATION_MS = 420

const RETAILER_LABELS = {
  aldi: 'ALDI',
  woolworths: 'Woolworths',
  coles: 'Coles',
}

function fmt(n) {
  return `$${n.toFixed(2)}`
}

export default function BrowseProductCard({ product, added, onAdd }) {
  const offers = [...product.offers].sort((a, b) => a.price - b.price)
  const cheapestPrice = offers[0]?.price
  const priciestPrice = offers[offers.length - 1]?.price
  const saving = offers.length > 1 ? priciestPrice - cheapestPrice : 0

  const [justAdded, setJustAdded] = useState(false)
  const popTimeout = useRef(undefined)

  function handleAdd() {
    onAdd()
    setJustAdded(true)
    clearTimeout(popTimeout.current)
    popTimeout.current = setTimeout(() => setJustAdded(false), POP_DURATION_MS)
  }

  return (
    <div className="flex flex-col border border-bw-line bg-bw-surface">
      <div
        className="relative flex aspect-square items-center justify-center p-3"
        style={{
          backgroundImage: 'repeating-linear-gradient(135deg,#F3F1EA 0 8px,#EDEBE2 8px 16px)',
        }}
      >
        <span className="text-center font-mono text-[9.5px] leading-snug text-[#9B9A8F]">
          {product.name}
        </span>
      </div>

      <div className="px-3 pt-3">
        <p className="mb-1.5 min-h-8.5 text-[12.5px] leading-snug font-semibold text-bw-ink">
          {product.name}
        </p>
        <p className="text-[11px] text-bw-muted">
          {product.size_value}
          {product.size_unit}
        </p>

        <div className="mt-2.5 flex flex-col gap-1 border-t border-bw-line pt-2.5">
          {offers.map((offer) => {
            const isCheapest = offer.price === cheapestPrice && offers.length > 1
            return (
              <div
                key={offer.retailer}
                className={cn(
                  'flex items-center justify-between gap-2 px-1 py-0.5',
                  isCheapest && 'bg-bw-green-tint',
                )}
              >
                <span className="flex items-center gap-1 font-archivo text-[11px] text-bw-body">
                  {isCheapest && <MdCheck className="h-3 w-3 text-bw-green" />}
                  <span className={cn(isCheapest && 'font-semibold text-bw-green')}>
                    {RETAILER_LABELS[offer.retailer] ?? offer.retailer}
                  </span>
                </span>
                <span
                  className={cn(
                    'font-newsreader text-base leading-none text-bw-ink',
                    isCheapest && 'text-bw-green',
                  )}
                >
                  {fmt(offer.price)}
                </span>
              </div>
            )
          })}
        </div>

        {saving > 0 && (
          <span className="mt-2 inline-block bg-bw-yellow px-1.5 py-0.75 font-archivo text-[10px] font-bold text-bw-yellow-ink">
            Save {fmt(saving)}
          </span>
        )}
      </div>

      <div className="mt-auto px-3 pt-2.5 pb-3">
        <button
          type="button"
          onClick={handleAdd}
          className={cn(
            'w-full rounded-sm px-2.5 py-2.25 font-archivo text-xs font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:ring-bw-green focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:animate-none',
            added ? 'bg-bw-ink-inverse-bg' : 'bg-bw-green hover:bg-bw-green-hover',
            justAdded && 'animate-[bw-pop_420ms_ease]',
          )}
        >
          {added ? 'In basket ✓' : 'Add'}
        </button>
      </div>
    </div>
  )
}
