import { useRef, useState } from 'react'
import { MdAdd, MdCheck, MdClose } from 'react-icons/md'

import { formatSize } from '@/api/client'
import aldiColor from '@/assets/product_card/aldi_color.webp'
import aldiGreyscale from '@/assets/product_card/aldi_grey.webp'
import colesColor from '@/assets/product_card/coles_color.webp'
import colesGreyscale from '@/assets/product_card/coles_grey.webp'
import harrisColor from '@/assets/product_card/harris_color.webp'
import harrisGreyscale from '@/assets/product_card/harris_grey.webp'
import productDefault from '@/assets/product_card/product_default.png'
import woolworthsColor from '@/assets/product_card/woolies_color.webp'
import woolworthsGreyscale from '@/assets/product_card/woolies_grey.webp'
import { cn } from '@/lib/utils'

const POP_DURATION_MS = 420

const RETAILER_LABELS = {
  woolworths: 'Woolworths',
  coles: 'Coles',
  aldi: 'ALDI',
  harrisfarm: 'Harris Farm',
} as const

const RETAILER_LOGOS = {
  woolworths: { color: woolworthsColor, greyscale: woolworthsGreyscale },
  coles: { color: colesColor, greyscale: colesGreyscale },
  aldi: { color: aldiColor, greyscale: aldiGreyscale },
  harrisfarm: { color: harrisColor, greyscale: harrisGreyscale },
} as const

const RETAILER_ORDER = ['woolworths', 'coles', 'aldi', 'harrisfarm'] as const

function fmt(n: number) {
  return `$${n.toFixed(2)}`
}

type ProductOffer = {
  retailer: string
  price: number
}

type ProductCardProduct = {
  id: string
  name: string
  brand?: string | null
  size_value?: number | null
  size_unit?: string | null
  image_url?: string | null
  offers: ProductOffer[]
}

type ProductCardProps = {
  product: ProductCardProduct
  added: boolean
  onAdd: () => void
  onRemove: () => void
}

export default function ProductCard({
  product,
  added,
  onAdd,
  onRemove,
}: ProductCardProps) {
  const offers = product.offers ?? []
  const offersByRetailer = new Map(
    offers.map((offer) => [offer.retailer, offer]),
  )
  const prices = offers.map((offer) => offer.price)
  const cheapestPrice = prices.length > 0 ? Math.min(...prices) : undefined
  const priciestPrice = prices.length > 0 ? Math.max(...prices) : undefined
  const saving =
    offers.length > 1 && cheapestPrice != null && priciestPrice != null
      ? priciestPrice - cheapestPrice
      : 0
  const showSaving =
    cheapestPrice != null && saving >= 0.2 && saving >= cheapestPrice * 0.1

  const [justAdded, setJustAdded] = useState(false)
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const popTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const imageSrc =
    product.image_url && failedImageUrl !== product.image_url
      ? product.image_url
      : productDefault
  const brand = product.brand?.trim()
  const size = formatSize(product)

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
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-dashed border-bw-line-strong bg-bw-panel">
          <img
            src={imageSrc}
            alt=""
            onError={() => {
              if (product.image_url) {
                setFailedImageUrl(product.image_url)
              }
            }}
            className="h-full w-full object-contain p-2"
          />

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
        <div className="mb-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[15px] leading-snug font-semibold text-bw-ink">
              {product.name}
            </p>
            {size ? (
              <p className="shrink-0 text-[12px] text-bw-muted">{size}</p>
            ) : null}
          </div>
          {brand ? (
            <p className="mt-0.5 text-[12px] text-bw-muted">{brand}</p>
          ) : null}
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-1 items-center justify-between">
            {RETAILER_ORDER.map((retailer) => {
              const offer = offersByRetailer.get(retailer)
              const isCheapest =
                offer?.price != null && offer.price === cheapestPrice
              const logos = RETAILER_LOGOS[retailer]
              const label = RETAILER_LABELS[retailer]
              return (
                <div
                  key={retailer}
                  className="flex flex-col items-center gap-1.5"
                >
                  <img
                    src={isCheapest ? logos.color : logos.greyscale}
                    alt={label}
                    className="h-8 w-8 rounded-md object-contain"
                  />
                  <span
                    className={cn(
                      'font-newsreader text-base leading-none text-bw-muted',
                      isCheapest && 'text-xl font-bold text-bw-green',
                    )}
                  >
                    {offer?.price != null ? fmt(offer.price) : 'N/A'}
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
