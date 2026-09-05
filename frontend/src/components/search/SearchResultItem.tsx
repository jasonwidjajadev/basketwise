import type { Product } from '@/api/client'
import {
  formatSize,
  RETAILER_LABEL,
} from '@/api/client'

import productDefault from '@/assets/product_card/product_default.png'
import { thumbnailUrl } from '@/lib/imageThumbnail'

function retailerLabel(
  retailer: string | null | undefined,
) {
  if (!retailer) return null

  return (
    RETAILER_LABEL[
      retailer as keyof typeof RETAILER_LABEL
    ] ?? retailer
  )
}

type SearchResultItemProps = {
  product: Product
  compact?: boolean
}

export default function SearchResultItem({
  product,
  compact = false,
}: SearchResultItemProps) {
  const size = formatSize(product)

  const retailer = retailerLabel(
    product.cheapest_retailer,
  )

  const image =
    thumbnailUrl(product.image_url, 100) ??
    productDefault

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={
          compact
            ? 'flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white'
            : 'flex h-[100px] w-[100px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-bw-line bg-white'
        }
      >
        <img
          src={image}
          alt=""
          width={100}
          height={100}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-bw-ink">
          {product.name}
        </p>

        <p className="mt-0.5 truncate text-[11px] text-bw-muted">
          {[product.brand, size]
            .filter(Boolean)
            .join(' · ') || 'Grocery item'}
        </p>

        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {product.min_price != null && (
            <span className="text-xs font-semibold text-bw-green">
              from ${product.min_price.toFixed(2)}
            </span>
          )}

          {retailer && (
            <span className="text-[10.5px] text-bw-subtle">
              {retailer}
            </span>
          )}

          {product.retailer_count > 1 && (
            <span className="text-[10.5px] text-bw-subtle">
              · {product.retailer_count} stores
            </span>
          )}
        </div>
      </div>
    </div>
  )
}