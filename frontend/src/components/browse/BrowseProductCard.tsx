import { useRef, useState } from 'react'
import { MdAdd, MdCheck } from 'react-icons/md'

import { cn } from '@/lib/utils'

const POP_DURATION_MS = 420

const RETAILER_LABELS = {
  aldi: 'ALDI',
  coles: 'Coles',
  woolworths: 'Woolworths',
}

const RETAILER_ORDER = ['aldi', 'coles', 'woolworths']

function fmt(n) {
  return `$${n.toFixed(2)}`
}

export default function BrowseProductCard({ product, added, onAdd, onRemove }) {
  const offersByRetailer = new Map(
    product.offers.map((offer) => [offer.retailer, offer]),
  )
  const rows = RETAILER_ORDER.map(
    (retailer) => offersByRetailer.get(retailer) ?? { retailer },
  )
  const prices = product.offers.map((offer) => offer.price)
  const cheapestPrice = prices.length > 0 ? Math.min(...prices) : undefined
  const priciestPrice = prices.length > 0 ? Math.max(...prices) : undefined
  const saving = product.offers.length > 1 ? priciestPrice - cheapestPrice : 0
  const showSaving = saving >= 0.2 && saving >= cheapestPrice * 0.1

  const [justAdded, setJustAdded] = useState(false)
  const popTimeout = useRef(undefined)

  function handleToggle() {
    if (added) {
      onRemove()
      return
    }
    onAdd()
    setJustAdded(true)
    clearTimeout(popTimeout.current)
    popTimeout.current = setTimeout(() => setJustAdded(false), POP_DURATION_MS)
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-bw-line bg-bw-surface shadow-sm">
      <div className="p-3 pb-0">
        <div
          className="relative flex aspect-square items-center justify-center rounded-xl"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg,#F3F1EA 0 8px,#EDEBE2 8px 16px)',
          }}
        >
          <span className="text-center font-mono text-[9.5px] leading-snug text-[#9B9A8F]">
            product shot
          </span>

          {showSaving && (
            <span className="absolute bottom-2 left-2 rounded-full bg-bw-green px-3 py-1.5 font-archivo text-xs font-semibold text-white shadow-md">
              Save {fmt(saving)}
            </span>
          )}

          <button
            type="button"
            onClick={handleToggle}
            aria-label={added ? 'Remove from basket' : 'Add to basket'}
            className={cn(
              'absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-full bg-bw-surface text-bw-ink shadow-md transition-colors focus-visible:ring-2 focus-visible:ring-bw-green focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:animate-none',
              added && 'bg-bw-green text-white',
              justAdded && 'animate-[bw-pop_420ms_ease]',
            )}
          >
            {added ? (
              <MdCheck className="h-5 w-5" />
            ) : (
              <MdAdd className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      <div className="px-4 pt-3.5 pb-4">
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          <p className="text-[15px] leading-snug font-semibold text-bw-ink">
            {product.name}
          </p>
          <p className="shrink-0 text-[12px] text-bw-muted">
            {product.size_value}
            {product.size_unit}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          {rows.map((offer) => {
            const isCheapest = offer.price === cheapestPrice
            return (
              <div
                key={offer.retailer}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg px-2.5 py-2',
                  isCheapest && 'bg-bw-green-tint',
                )}
              >
                <span className="font-archivo text-[13px] text-bw-body">
                  <span
                    className={cn(isCheapest && 'font-semibold text-bw-green')}
                  >
                    {RETAILER_LABELS[offer.retailer] ?? offer.retailer}
                  </span>
                </span>
                <span
                  className={cn(
                    'font-newsreader text-base leading-none text-bw-muted',
                    isCheapest && 'text-xl font-bold text-bw-green',
                  )}
                >
                  {offer.price != null ? fmt(offer.price) : 'N/A'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
