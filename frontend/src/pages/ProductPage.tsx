import { useEffect, useMemo, useState } from 'react'

import { useParams } from 'react-router'

import { formatSize, getProduct, RETAILER_LABEL } from '@/api/client'

import type { Offer, ProductDetail, Retailer } from '@/api/client'

import productDefault from '@/assets/product_card/product_default.png'

import OptionCard from '@/components/compare/OptionCard'
import PriceHistoryPanel from '@/components/PriceHistoryPanel'
import OfferImageLink from '@/components/product/OfferImageLink'
import PriceTrendChart from '@/components/product/PriceTrendChart'

import { useCart } from '@/context/useCart'

function uiOption(offer: Offer, highestPrice: number) {
  return {
    total: offer.price,

    savings: Math.max(0, highestPrice - offer.price),
  }
}

export default function ProductPage() {
  const { productId = '' } = useParams()

  // The basket keys on the canonical product id, not on a retailer -- the whole
  // point of /compare is that the backend picks the store afterwards -- so this
  // adds the product once, whichever offer the shopper is looking at.
  const { addedIds, add, remove } = useCart()

  const [product, setProduct] = useState<ProductDetail | null>(null)

  const [loading, setLoading] = useState(true)

  const [notFound, setNotFound] = useState(false)

  const [activeRetailer, setActiveRetailer] = useState<Retailer | null>(null)

  // Retailer CDNs do 404 on us. Remember which images died so the swap falls
  // back to the placeholder instead of showing a broken image.
  const [failedImageUrls, setFailedImageUrls] = useState<string[]>([])

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    setNotFound(false)

    getProduct(productId, controller.signal)
      .then((result) => {
        setProduct(result)

        setActiveRetailer(
          (result.offers[0]?.retailer as Retailer | undefined) ?? null,
        )
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error('Product lookup failed', error)

          setNotFound(true)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [productId])

  // The browse card lists every retailer that has a price for this item, so the
  // product page must show exactly the same set. Filtering out is_available=0
  // offers here made a store (usually ALDI) appear on the card and then vanish
  // on click. Unavailable offers stay in the comparison and are flagged instead.
  const availableOffers = useMemo(() => product?.offers ?? [], [product])

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
        <div className="animate-bw-skeleton h-64 rounded-xl bg-bw-panel" />
      </main>
    )
  }

  if (!product || notFound) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
        <h1 className="text-2xl text-bw-ink">Product not found</h1>
      </main>
    )
  }

  const highestPrice =
    availableOffers.length > 0
      ? Math.max(...availableOffers.map((offer) => offer.price))
      : 0

  const lowestPrice =
    availableOffers.length > 0
      ? Math.min(...availableOffers.map((offer) => offer.price))
      : null

  const activeOffer =
    availableOffers.find((offer) => offer.retailer === activeRetailer) ??
    availableOffers[0]

  // Each retailer photographs the same item its own way, so show the pack shot
  // that belongs to the price the shopper just clicked.
  const offerImage = activeOffer?.image_url ?? product.image_url ?? null

  const image =
    offerImage && !failedImageUrls.includes(offerImage)
      ? offerImage
      : productDefault

  const imageAlt = activeOffer
    ? `${RETAILER_LABEL[activeOffer.retailer]} — ${product.name}`
    : product.name

  const size = formatSize(product)

  const inCart = Boolean(addedIds[product.id])

  return (
    <main className="w-full px-6 py-9 lg:px-8 xl:px-12 2xl:px-16">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-8 md:grid-cols-[280px_1fr]">
          {/* Product image */}
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-bw-line bg-white p-5">
            <img
              src={image}
              alt={imageAlt}
              onError={() => {
                if (offerImage) {
                  setFailedImageUrls((urls) =>
                    urls.includes(offerImage) ? urls : [...urls, offerImage],
                  )
                }
              }}
              className="h-full w-full object-contain"
            />
          </div>

          {/* Product information */}
          <div>
            <p className="text-[10.5px] font-bold tracking-[.14em] text-bw-green uppercase">
              Compare this item
            </p>

            <h1 className="mt-1 text-[32px] leading-tight text-bw-ink">
              {product.name}
            </h1>

            <p className="mt-2 text-sm text-bw-muted">
              {[product.brand, size].filter(Boolean).join(' · ')}
            </p>

            {/* No offers available */}
            {availableOffers.length === 0 ? (
              <p className="mt-6 text-sm text-bw-muted">
                No retailer prices are currently available for this item.
              </p>
            ) : (
              <>
                {/* Retailer comparison cards */}
                <div className="mt-6 grid grid-cols-1 gap-px bg-bw-line sm:grid-cols-2 lg:grid-cols-4">
                  {availableOffers.map((offer, index) => {
                    const label = RETAILER_LABEL[offer.retailer]

                    return (
                      <OptionCard
                        key={offer.id}
                        label={label}
                        tag={
                          offer.price === lowestPrice
                            ? 'Cheapest'
                            : offer.is_available === false
                              ? 'Check stock'
                              : undefined
                        }
                        option={uiOption(offer, highestPrice)}
                        stores={[label]}
                        active={offer.retailer === activeOffer?.retailer}
                        onSelect={() => setActiveRetailer(offer.retailer)}
                        isBest={offer.price === lowestPrice}

                        /*
                         * The linked items can be
                         * named differently at each
                         * store, so name the exact
                         * item this price is for and
                         * link out to it.
                         */
                        storeItemName={offer.retailer_product_name}

                        /*
                         * These props are required
                         * by Jason's OptionCard.
                         *
                         * We are not using the
                         * "Why" feature here.
                         */
                        note=""
                        onToggleWhy={() => {}}

                        animationDelay={`${index * 50}ms`}
                      />
                    )
                  })}
                </div>

                {/* Add to basket */}
                <div className="mt-5 flex items-center gap-3">
                  {inCart ? (
                    <button
                      type="button"
                      onClick={() => remove(product.id)}
                      className="rounded-full border border-bw-line px-5 py-2.5 text-sm font-semibold text-bw-ink transition hover:border-bw-green hover:text-bw-green focus-visible:ring-2 focus-visible:ring-bw-green focus-visible:outline-none"
                    >
                      Remove from basket
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => add(product.id, 1)}
                      className="rounded-full bg-bw-green px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-bw-green focus-visible:outline-none"
                    >
                      Add to basket
                    </button>
                  )}

                  {lowestPrice != null && (
                    <span className="text-sm text-bw-muted">
                      from ${lowestPrice.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Each retailer's own photo of the item, linking to its page */}
                <div className="mt-6">
                  <h2 className="text-[10.5px] font-bold tracking-[.14em] text-bw-muted uppercase">
                    At each store
                  </h2>

                  <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {availableOffers.map((offer) => (
                      <OfferImageLink key={offer.id} offer={offer} />
                    ))}
                  </div>
                </div>

                {/*
                 * What this item has cost, rather than a second copy of the
                 * price already on the cards above. The marker on the range
                 * bar follows whichever retailer is selected.
                 */}
                <PriceHistoryPanel
                  productId={product.id}
                  activeOffer={activeOffer}
                  offers={availableOffers}
                />
              </>
            )}
          </div>
        </div>

        {/* Only appears once the backend has prices on more than one day */}
        <PriceTrendChart productId={product.id} />
      </div>
    </main>
  )
}
