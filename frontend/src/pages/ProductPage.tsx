import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useParams } from 'react-router'

import {
  formatSize,
  getProduct,
  offerUrl,
  RETAILER_LABEL,
} from '@/api/client'

import type {
  Offer,
  ProductDetail,
  Retailer,
} from '@/api/client'

import productDefault from '@/assets/product_card/product_default.png'

import LedgerBreakdown from '@/components/compare/LedgerBreakdown'
import OptionCard from '@/components/compare/OptionCard'

import { thumbnailUrl } from '@/lib/imageThumbnail'

function uiOption(
  offer: Offer,
  highestPrice: number,
) {
  return {
    total: offer.price,

    savings: Math.max(
      0,
      highestPrice - offer.price,
    ),
  }
}

export default function ProductPage() {
  const { productId = '' } =
    useParams()

  const [product, setProduct] =
    useState<ProductDetail | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [notFound, setNotFound] =
    useState(false)

  const [
    activeRetailer,
    setActiveRetailer,
  ] = useState<Retailer | null>(null)

  useEffect(() => {
    const controller =
      new AbortController()

    setLoading(true)
    setNotFound(false)

    getProduct(
      productId,
      controller.signal,
    )
      .then((result) => {
        setProduct(result)

        setActiveRetailer(
          (result.offers[0]?.retailer as
            | Retailer
            | undefined) ?? null,
        )
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error(
            'Product lookup failed',
            error,
          )

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

  // ~5% of offers carry is_available=0, and for some products every offer is
  // flagged that way. Hiding all of them left the comparison blank while the
  // product card (which filters on price only) still showed prices for the same
  // item. Prefer available offers, but never render an empty comparison when we
  // do have prices.
  const availableOffers = useMemo(() => {
    const offers = product?.offers ?? []
    const inStock = offers.filter((offer) => offer.is_available !== false)
    return inStock.length > 0 ? inStock : offers
  }, [product])

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
        <h1 className="text-2xl text-bw-ink">
          Product not found
        </h1>
      </main>
    )
  }

  const highestPrice =
    availableOffers.length > 0
      ? Math.max(
          ...availableOffers.map(
            (offer) => offer.price,
          ),
        )
      : 0

  const lowestPrice =
    availableOffers.length > 0
      ? Math.min(
          ...availableOffers.map(
            (offer) => offer.price,
          ),
        )
      : null

  const activeOffer =
    availableOffers.find(
      (offer) =>
        offer.retailer ===
        activeRetailer,
    ) ?? availableOffers[0]

  const image =
    thumbnailUrl(
      product.image_url,
      100,
    ) ?? productDefault

  const size = formatSize(product)

  return (
    <main className="w-full px-6 py-9 lg:px-8 xl:px-12 2xl:px-16">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-8 md:grid-cols-[280px_1fr]">

          {/* Product image */}
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-bw-line bg-white p-5">
            <img
              src={image}
              alt={product.name}
              width={100}
              height={100}
              className="h-[100px] w-[100px] object-contain"
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
              {[product.brand, size]
                .filter(Boolean)
                .join(' · ')}
            </p>

            {/* No offers available */}
            {availableOffers.length ===
            0 ? (
              <p className="mt-6 text-sm text-bw-muted">
                No retailer prices are
                currently available for
                this item.
              </p>
            ) : (
              <>
                {/* Retailer comparison cards */}
                <div className="mt-6 grid grid-cols-1 gap-px bg-bw-line sm:grid-cols-2 lg:grid-cols-4">
                  {availableOffers.map(
                    (offer, index) => {
                      const label =
                        RETAILER_LABEL[
                          offer.retailer
                        ]

                      return (
                        <OptionCard
                          key={offer.id}
                          label={label}
                          tag={
                            offer.price ===
                            lowestPrice
                              ? 'Cheapest'
                              : undefined
                          }
                          option={uiOption(
                            offer,
                            highestPrice,
                          )}
                          stores={[
                            label,
                          ]}
                          active={
                            offer.retailer ===
                            activeOffer
                              ?.retailer
                          }
                          onSelect={() =>
                            setActiveRetailer(
                              offer.retailer,
                            )
                          }
                          isBest={
                            offer.price ===
                            lowestPrice
                          }

                          /*
                           * The linked items can be
                           * named differently at each
                           * store, so name the exact
                           * item this price is for and
                           * link out to it.
                           */
                          storeItemName={
                            offer.retailer_product_name
                          }
                          storeUrl={
                            offerUrl(offer) ??
                            undefined
                          }

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
                    },
                  )}
                </div>

                {/* Price breakdown for selected retailer */}
                {activeOffer && (
                  <div className="mt-5">
                    <LedgerBreakdown
                      groups={[
                        {
                          retailer:
                            activeOffer.retailer,

                          label:
                            RETAILER_LABEL[
                              activeOffer
                                .retailer
                            ],

                          subtotal:
                            activeOffer.price,

                          lines: [
                            {
                              product: {
                                id: product.id,
                                name: product.name,
                              },

                              quantity: 1,

                              unitPrice:
                                activeOffer.price,

                              lineTotal:
                                activeOffer.price,
                            },
                          ],
                        },
                      ]}
                      total={
                        activeOffer.price
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}