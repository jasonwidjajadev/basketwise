/**
 * Price history for one product, in the slot the basket ledger used to occupy.
 *
 * Owns the single /products/{id}/price-history request and hands the result to
 * both visuals, so the range bar and the chart never fetch the same series twice.
 *
 * Coverage is thin -- the crawler has only recently begun recording daily
 * observations, and the deployed API currently returns one point per retailer --
 * so the range bar leads. A spread still reads honestly with a single crawl,
 * where a line chart on its own would just draw dots. The chart fills in as
 * crawls accumulate.
 */
import { useEffect, useState } from 'react'

import { getPriceHistory, RETAILER_LABEL } from '@/api/client'

import type { Offer, PriceHistory } from '@/api/client'

import PriceHistoryChart from '@/components/PriceHistoryChart'
import PriceRangeBar from '@/components/PriceRangeBar'

const DAYS = 30

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export default function PriceHistoryPanel({
  productId,
  activeOffer,
  offers,
}: {
  productId: string
  /** The retailer card the shopper has selected -- its price is marked on the bar. */
  activeOffer: Offer | undefined
  offers: Offer[]
}) {
  // Keyed by product so staleness is derived at render instead of reset by a
  // setState in the effect body -- the latter trips react-hooks/set-state-in-effect.
  const [res, setRes] = useState<{
    id: string
    series: PriceHistory[] | null
  }>({ id: '', series: null })

  useEffect(() => {
    const ac = new AbortController()

    getPriceHistory(productId, DAYS, ac.signal)
      .then((d) => setRes({ id: productId, series: d }))
      .catch((e) => {
        if (e?.name !== 'AbortError') setRes({ id: productId, series: null })
      })

    return () => ac.abort()
  }, [productId])

  if (res.id !== productId)
    return (
      <div className="animate-bw-skeleton mt-5 h-40 rounded-lg bg-bw-panel" />
    )

  const series = res.series ?? []
  const observed = series.flatMap((s) => s.points.map((p) => p.price))

  // Nothing recorded yet (or the request failed): the offers on screen still
  // describe a real spread across stores, which beats hiding the panel.
  const prices = observed.length > 0 ? observed : offers.map((o) => o.price)

  if (prices.length === 0) return null

  const storeCount =
    observed.length > 0
      ? series.length
      : new Set(offers.map((o) => o.retailer)).size

  const caption =
    observed.length > 0
      ? `${storeCount} store${storeCount === 1 ? '' : 's'} · last ${DAYS} days`
      : `${storeCount} store${storeCount === 1 ? '' : 's'} · today`

  // The chart's x-axis is real time, so a single crawl would scatter each
  // retailer's dot across the full width purely on the minute it was recorded --
  // a trend the data does not contain. Plot only once two days exist.
  const days = new Set(
    series.flatMap((s) => s.points.map((p) => p.recorded_at.slice(0, 10))),
  )

  return (
    <div className="mt-5">
      <PriceRangeBar
        lowest={Math.min(...prices)}
        usually={median(prices)}
        highest={Math.max(...prices)}
        current={activeOffer?.price ?? null}
        currentLabel={activeOffer ? RETAILER_LABEL[activeOffer.retailer] : null}
        caption={caption}
      />

      {days.size > 1 ? (
        <PriceHistoryChart series={series} />
      ) : (
        <p className="mt-4 text-xs text-bw-subtle">
          {days.size === 1
            ? 'Only one crawl covers this item so far, so there is no trend to plot yet.'
            : 'No price observations recorded for this item yet.'}
        </p>
      )}
    </div>
  )
}
