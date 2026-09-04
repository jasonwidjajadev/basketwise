import { useRef, useState } from 'react'
import { MdAdd, MdCheck } from 'react-icons/md'

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
const PRODUCT_NAME_MAX_LENGTH = 24

const RETAILER_LABELS = {
  woolworths: 'Woolworths',
  coles: 'Coles',
  aldi: 'ALDI',
  harrisfarm: 'Harris Farm',
} as const

const RETAILER_LOGOS = {
  woolworths: {
    color: woolworthsColor,
    greyscale: woolworthsGreyscale,
  },
  coles: {
    color: colesColor,
    greyscale: colesGreyscale,
  },
  aldi: {
    color: aldiColor,
    greyscale: aldiGreyscale,
  },
  harrisfarm: {
    color: harrisColor,
    greyscale: harrisGreyscale,
  },
} as const

const RETAILER_ORDER = ['woolworths', 'coles', 'aldi', 'harrisfarm'] as const

type Retailer = (typeof RETAILER_ORDER)[number]

type ProductOffer = {
  retailer: Retailer
  price: number
}

type ProductCardProduct = {
  id: string
  name: string
  brand?: string | null
  size_value?: number | null
  size_unit?: string | null
  image_url?: string | null
  unit_price?: number | null
  unit_measure?: string | null
  was_price?: number | null
  has_special?: boolean
  cheapest_retailer?: Retailer | null
  offers: ProductOffer[]
}

type ProductCardProps = {
  product: ProductCardProduct
  added: boolean
  onAdd: () => void
  onRemove: () => void
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`
}

function truncateText(text: string, maxLength = PRODUCT_NAME_MAX_LENGTH) {
  if (text.length <= maxLength) return text

  return `${text.slice(0, maxLength).trim()}...`
}

export default function ProductCard({
  product,
  added,
  onAdd,
  onRemove,
}: ProductCardProps) {
  const offersByRetailer = new Map(
    product.offers.map((offer) => [offer.retailer, offer]),
  )

  const [justAdded, setJustAdded] = useState(false)
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)

  const popTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  const imageSrc =
    product.image_url && failedImageUrl !== product.image_url
      ? product.image_url
      : productDefault

  const brand = product.brand?.trim() || 'No brand'
  const size = formatSize(product)

  const unitPrice =
    product.unit_price != null && product.unit_measure
      ? `${fmt(product.unit_price)} / ${product.unit_measure}`
      : null

  const availableOffers = product.offers.filter((offer) =>
    Number.isFinite(offer.price),
  )

  const cheapestPrice =
    availableOffers.length > 0
      ? Math.min(...availableOffers.map((offer) => offer.price))
      : null

  const cheapestRetailer =
    product.cheapest_retailer &&
    offersByRetailer.get(product.cheapest_retailer)?.price === cheapestPrice
      ? product.cheapest_retailer
      : (RETAILER_ORDER.find(
          (retailer) => offersByRetailer.get(retailer)?.price === cheapestPrice,
        ) ?? null)

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
    <div className="flex w-full flex-col bg-white">
      <div className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-dashed border-bw-line-strong bg-white">
        {product.has_special && (
          <div className="absolute top-2 left-2 z-10 flex flex-col items-center gap-1">
            <span className="rounded-full bg-bw-yellow px-2 py-1 text-[10px] font-semibold text-bw-yellow-ink">
              Special
            </span>

            {product.was_price != null && (
              <span className="text-[10px] text-bw-muted">
                was{' '}
                <span className="line-through">{fmt(product.was_price)}</span>
              </span>
            )}
          </div>
        )}

        <img
          src={imageSrc}
          alt={product.name}
          onError={() => {
            if (product.image_url) {
              setFailedImageUrl(product.image_url)
            }
          }}
          className="h-[148px] w-[160px] object-contain transition-transform duration-300 ease-out group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />

        <button
          type="button"
          onClick={handleToggle}
          aria-label={added ? 'Remove from basket' : 'Add to basket'}
          title={added ? 'Remove from basket' : 'Add to basket'}
          className={cn(
            'absolute right-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-full border border-bw-line bg-white text-bw-ink transition-colors',
            'hover:border-bw-green hover:bg-bw-green hover:text-white',
            'focus-visible:ring-2 focus-visible:ring-bw-green focus-visible:outline-none',
            added && 'border-bw-green bg-bw-green text-white',
            justAdded && 'animate-[bw-pop_420ms_ease]',
          )}
        >
          {added ? (
            <MdCheck className="h-4 w-4" />
          ) : (
            <MdAdd className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="pt-3">
        <p className="mb-1 text-[11px] leading-none text-bw-muted">{brand}</p>

        <p
          title={product.name}
          className="min-h-[18px] cursor-default text-[13px] leading-[1.3] font-medium text-bw-ink"
        >
          {truncateText(product.name)}
        </p>

        {(size || unitPrice) && (
          <p className="mt-1 text-[11px] text-bw-muted">
            {size}

            {size && unitPrice ? ' · ' : ''}

            {unitPrice}
          </p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1">
        {RETAILER_ORDER.map((retailer) => {
          const offer = offersByRetailer.get(retailer)
          const logos = RETAILER_LOGOS[retailer]
          const label = RETAILER_LABELS[retailer]
          const isCheapest = retailer === cheapestRetailer

          return (
            <div key={retailer} className="flex min-w-0 flex-col items-center">
              <img
                src={isCheapest ? logos.color : logos.greyscale}
                alt={label}
                className="h-6 w-6 object-contain"
              />

              <span
                className={cn(
                  'mt-1 text-[12px] leading-none font-medium',
                  offer ? 'text-taupe-two' : 'text-bw-subtle',
                )}
              >
                {offer ? fmt(offer.price) : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
