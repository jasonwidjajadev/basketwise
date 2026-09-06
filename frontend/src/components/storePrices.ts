import aldiColor from '@/assets/product_card/aldi_color.webp'
import aldiGreyscale from '@/assets/product_card/aldi_grey.webp'
import colesColor from '@/assets/product_card/coles_color.webp'
import colesGreyscale from '@/assets/product_card/coles_grey.webp'
import harrisColor from '@/assets/product_card/harris_color.webp'
import harrisGreyscale from '@/assets/product_card/harris_grey.webp'
import woolworthsColor from '@/assets/product_card/woolies_color.webp'
import woolworthsGreyscale from '@/assets/product_card/woolies_grey.webp'

export const RETAILER_LABELS = {
  woolworths: 'Woolworths',
  coles: 'Coles',
  aldi: 'ALDI',
  harrisfarm: 'Harris Farm',
} as const

export const RETAILER_LOGOS = {
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

export const RETAILER_ORDER = [
  'woolworths',
  'coles',
  'aldi',
  'harrisfarm',
] as const

export type Retailer = (typeof RETAILER_ORDER)[number]

export type StoreOffer = {
  retailer: Retailer
  price: number
}

/** Store filter buttons, in the same order the price row renders them. */
export const RETAILER_FILTER_OPTIONS = [
  { value: '', label: 'All stores' },
  ...RETAILER_ORDER.map((retailer) => ({
    value: retailer as string,
    label: RETAILER_LABELS[retailer],
  })),
]

export const RETAILER_FILTER_VALUES = RETAILER_FILTER_OPTIONS.map(
  (opt) => opt.value,
)
