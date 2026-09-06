import {
  RETAILER_LABELS,
  RETAILER_LOGOS,
  RETAILER_ORDER,
} from '@/components/storePrices'
import type { Retailer, StoreOffer } from '@/components/storePrices'
import { cn } from '@/lib/utils'

type StorePriceRowProps = {
  offers?: StoreOffer[] | null
  /** The API's own pick; only trusted when it really is the lowest price. */
  cheapestRetailer?: Retailer | string | null
  /** Shown under a logo when that store has no offer. */
  emptyLabel?: string
  className?: string
  logoClassName?: string
  priceClassName?: string
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`
}

export default function StorePriceRow({
  offers,
  cheapestRetailer,
  emptyLabel = '',
  className,
  logoClassName,
  priceClassName,
}: StorePriceRowProps) {
  const offersByRetailer = new Map(
    (offers ?? []).map((offer) => [offer.retailer, offer]),
  )

  const availableOffers = (offers ?? []).filter((offer) =>
    Number.isFinite(offer.price),
  )

  const cheapestPrice =
    availableOffers.length > 0
      ? Math.min(...availableOffers.map((offer) => offer.price))
      : null

  const cheapest =
    cheapestRetailer &&
    offersByRetailer.get(cheapestRetailer as Retailer)?.price === cheapestPrice
      ? (cheapestRetailer as Retailer)
      : (RETAILER_ORDER.find(
          (retailer) => offersByRetailer.get(retailer)?.price === cheapestPrice,
        ) ?? null)

  return (
    <div className={cn('mt-3 grid w-full grid-cols-4', className)}>
      {RETAILER_ORDER.map((retailer) => {
        const offer = offersByRetailer.get(retailer)
        const logos = RETAILER_LOGOS[retailer]
        const label = RETAILER_LABELS[retailer]
        const isCheapest = retailer === cheapest
        return (
          <div key={retailer} className="flex min-w-0 flex-col items-center">
            <img
              src={isCheapest ? logos.color : logos.greyscale}
              alt={label}
              className={cn(
                'aspect-square w-[55%] object-contain',
                logoClassName,
              )}
            />

            <span
              className={cn(
                'mt-1 text-xs leading-none font-medium',
                isCheapest ? 'font-bold text-black' : 'text-taupe-two',
                priceClassName,
              )}
            >
              {offer ? fmt(offer.price) : emptyLabel}
            </span>
          </div>
        )
      })}
    </div>
  )
}
