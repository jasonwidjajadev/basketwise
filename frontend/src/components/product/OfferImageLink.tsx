import { RETAILER_LABEL, offerUrl } from '@/api/client'

import type { Offer } from '@/api/client'

import aldiColor from '@/assets/product_card/aldi_color.webp'
import colesColor from '@/assets/product_card/coles_color.webp'
import harrisColor from '@/assets/product_card/harris_color.webp'
import productDefault from '@/assets/product_card/product_default.png'
import woolworthsColor from '@/assets/product_card/woolies_color.webp'

import { thumbnailUrl } from '@/lib/imageThumbnail'

import type { Retailer } from '@/api/client'

const RETAILER_LOGO: Record<Retailer, string> = {
  coles: colesColor,
  woolworths: woolworthsColor,
  aldi: aldiColor,
  harrisfarm: harrisColor,
}

/**
 * The picture a single retailer publishes for this item, and the only way
 * through to that retailer's page -- clicking the image opens the offer.
 *
 * `thumbnailUrl` only knows how to shrink the hosts we have seen, and returns
 * null for anything else, so fall back to the full-size URL before falling
 * back to the store logo. An offer with no image at all still renders a tile,
 * so the click target never disappears.
 */
export default function OfferImageLink({ offer }: { offer: Offer }) {
  const label = RETAILER_LABEL[offer.retailer]

  const href = offerUrl(offer)

  const image =
    thumbnailUrl(offer.image_url, 200) ??
    offer.image_url ??
    RETAILER_LOGO[offer.retailer] ??
    productDefault

  const picture = (
    <img
      src={image}
      alt={`${offer.retailer_product_name} at ${label}`}
      loading="lazy"
      className="h-[92px] w-[92px] object-contain"
    />
  )

  return (
    <figure className="flex flex-col items-center gap-2 text-center">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${offer.retailer_product_name} at ${label}`}
          className="flex h-[120px] w-full items-center justify-center rounded-xl border border-bw-line bg-white p-3 transition hover:border-bw-green focus-visible:ring-2 focus-visible:ring-bw-green focus-visible:outline-none"
        >
          {picture}
        </a>
      ) : (
        <div className="flex h-[120px] w-full items-center justify-center rounded-xl border border-bw-line bg-white p-3">
          {picture}
        </div>
      )}

      <figcaption className="text-[11px] leading-tight text-bw-muted">
        <span className="block font-semibold text-bw-ink">{label}</span>

        {offer.retailer_product_name}
      </figcaption>
    </figure>
  )
}
