import { useRef, useState } from 'react'
import { MdAdd, MdCheck, MdClose, MdOutlineImage } from 'react-icons/md'

import aldiColor from '@/assets/logos/ALDI.png'
import aldiGreyscale from '@/assets/logos/ALDI_greyscale.png'
import colesColor from '@/assets/logos/Coles.png'
import colesGreyscale from '@/assets/logos/Coles_greyscale.png'
import woolworthsColor from '@/assets/logos/Woolworths.png'
import woolworthsGreyscale from '@/assets/logos/Woolworths_greyscale.png'
import { cn } from '@/lib/utils'

const POP_DURATION_MS = 420

const RETAILER_LABELS = {
  aldi: 'ALDI',
  coles: 'Coles',
  woolworths: 'Woolworths',
}

const RETAILER_LOGOS = {
  aldi: { color: aldiColor, greyscale: aldiGreyscale },
  coles: { color: colesColor, greyscale: colesGreyscale },
  woolworths: { color: woolworthsColor, greyscale: woolworthsGreyscale },
}

const RETAILER_ORDER = ['woolworths', 'coles', 'aldi']

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
        <div className="relative flex aspect-square items-center justify-center rounded-xl border border-dashed border-bw-line-strong bg-bw-panel">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <MdOutlineImage
              aria-hidden="true"
              className="h-8 w-8 text-bw-subtle"
            />
            <span className="font-mono text-[11px] leading-snug text-bw-subtle">
              product shot
              <br />
              or <span className="underline">browse files</span>
            </span>
          </div>

          {showSaving && (
            <span
              className="absolute bottom-2 left-2 rounded-full bg-bw-green px-3 py-1.5 font-archivo text-xs font-semibold text-white shadow-md"
              title="Shown when this saving is at least 10% of the cheapest price and at least $0.20"
            >
              Save {fmt(saving)}
            </span>
          )}
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

        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-1 items-center justify-between">
            {rows.map((offer) => {
              const isCheapest =
                offer.price != null && offer.price === cheapestPrice
              const logos = RETAILER_LOGOS[offer.retailer]
              const label = RETAILER_LABELS[offer.retailer] ?? offer.retailer
              return (
                <div
                  key={offer.retailer}
                  className="flex flex-col items-center gap-1.5"
                >
                  {logos && (
                    <img
                      src={isCheapest ? logos.color : logos.greyscale}
                      alt={label}
                      className="h-8 w-8 rounded-md object-contain"
                    />
                  )}
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

          <div className="flex h-8 w-9 shrink-0 items-center justify-center">
            <button
              type="button"
              onClick={handleToggle}

              aria-label={added ? 'Remove from basket' : 'Add to basket'}
              title={added ? 'Remove from basket' : 'Add to basket'}
              className={cn(
                'curso group flex h-9 w-9 items-center justify-center rounded-full bg-bw-panel text-bw-ink shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-bw-green focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:animate-none',
                added && 'bg-bw-green text-white',
                justAdded && 'animate-[bw-pop_420ms_ease]',
              )}
            >
              {added ? (
                <>
                  <MdCheck className="h-5 w-5 group-hover:hidden group-focus-visible:hidden" />
                  <MdClose className="hidden h-5 w-5 group-hover:block group-focus-visible:block" />
                </>
              ) : (
                <MdAdd className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
