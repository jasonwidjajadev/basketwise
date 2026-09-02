import { useState } from 'react'

import { cn } from '@/lib/utils'
import { useCart } from '@/context/useCart'
import { computeCompareOptions, RETAILER_LABEL } from '@/lib/compareBasket'
import EmptyCompareState from '@/components/compare/EmptyCompareState'
import OptionCard from '@/components/compare/OptionCard'
import LedgerBreakdown from '@/components/compare/LedgerBreakdown'
import UnavailableBanner from '@/components/compare/UnavailableBanner'
import ConvergeBlock from '@/components/compare/ConvergeBlock'
import CompareFooterActions from '@/components/compare/CompareFooterActions'

export default function ComparePage() {
  const { items } = useCart()
  const data = computeCompareOptions(items)

  const [active, setActive] = useState('recommended')
  const [showWhy, setShowWhy] = useState(false)
  const [saved, setSaved] = useState(false)
  // No auth system exists yet (see PRODUCT.md) — always render the
  // signed-out state until sign-in is real.
  const signedIn = false

  if (!data) return <EmptyCompareState />

  const optionMap = {
    recommended: data.recommended,
    single: data.cheapestSingle,
    lowest: data.lowestTotal,
  }
  const shown = data.converge
    ? data.recommended
    : optionMap[active] || data.recommended

  const cards = data.converge
    ? []
    : [
        {
          id: 'recommended',
          label: 'Recommended split',
          tag: 'Recommended',
          option: data.recommended,
          stores: data.recommended.groups.map((g) => g.label),
          available: true,
          showWhyButton: true,
        },
        data.hasSingleStoreOption
          ? {
              id: 'single',
              label: 'Cheapest single store',
              option: data.cheapestSingle,
              stores: [RETAILER_LABEL[data.cheapestSingle.retailer]],
              available: true,
            }
          : {
              id: 'single',
              label: 'Cheapest single store',
              available: false,
              note: 'No single store carries everything in this basket.',
            },
        {
          id: 'lowest',
          label: 'Lowest possible price',
          option: data.lowestTotal,
          stores: data.lowestTotal.groups.map((g) => g.label),
          available: true,
        },
      ]

  const availableTotals = cards
    .filter((c) => c.available)
    .map((c) => c.option.total)
  const bestTotal = availableTotals.length ? Math.min(...availableTotals) : null
  const tie =
    availableTotals.length > 0 &&
    availableTotals.every((t) => Math.abs(t - bestTotal) < 0.005)

  const hasUnavailable = data.unavailable.length > 0
  const hasExcluded =
    !hasUnavailable && data.recommended.excludedItems.length > 0

  return (
    // <div className="px-6 pt-9.5 pb-24 lg:px-8 xl:px-12 2xl:px-16">
    <div className="mx-auto px-6 pt-9.5 pb-24 lg:max-w-5xl xl:max-w-[1280px]">
      <h1 className="font-newsreader text-[32px] text-bw-ink">
        How do you want to shop?
      </h1>
      <p className="mt-1.5 text-[13px] text-bw-body">
        {data.isSingleItem
          ? "1 item — here's where it's cheapest"
          : `${data.itemCount} items in your basket`}
      </p>

      <div className="mt-6">
        {hasUnavailable && (
          <div className="animate-bw-fade-up mb-5">
            <UnavailableBanner>
              <strong className="text-bw-ink">
                {data.unavailable.map((p) => p.name).join(', ')}
              </strong>{' '}
              isn't available at any store right now — it's been left out of
              every total below.
            </UnavailableBanner>
          </div>
        )}

        {hasExcluded && (
          <div className="animate-bw-fade-up mb-5">
            <UnavailableBanner>
              <strong className="text-bw-ink">
                {data.recommended.excludedItems.map((p) => p.name).join(', ')}
              </strong>{' '}
              isn't carried by any store in your delivery area, so it's left out
              of the Recommended split entirely. See "Lowest possible price" to
              include it.
            </UnavailableBanner>
          </div>
        )}

        {!hasUnavailable && data.converge && (
          <div className="animate-bw-fade-up">
            <ConvergeBlock recommended={data.recommended} />
          </div>
        )}

        {!hasUnavailable && !data.converge && (
          <div className="mb-5 grid grid-cols-1 gap-px bg-bw-line sm:grid-cols-3">
            {cards.map((c, i) => (
              <OptionCard
                key={c.id}
                {...c}
                active={c.id === active}
                onSelect={() => setActive(c.id)}
                isBest={
                  c.available &&
                  !tie &&
                  Math.abs(c.option.total - bestTotal) < 0.005
                }
                whyOpen={showWhy}
                onToggleWhy={() => setShowWhy((s) => !s)}
                animationDelay={`${i * 60}ms`}
              />
            ))}

            <div
              aria-hidden={!showWhy}
              className={cn(
                'bw-row-collapse col-span-full',
                !showWhy && 'bw-row-collapse-leaving',
              )}
            >
              <div>
                <div className="bw-row-collapse-inner bg-bw-surface px-5 py-3 text-[12px] leading-relaxed text-bw-body">
                  {hasExcluded
                    ? `We only recommend stores within your delivery area — a store that's too far to visit is left out completely, even on the rare item where it would've been cheaper. ${data.recommended.excludedItems.map((p) => p.name).join(', ')} isn't carried by any store in range, so it's dropped from this split rather than reached for anyway.`
                    : "We only recommend stores within your delivery area — a store that's too far to visit is left out completely, even on the rare item where it would've been cheaper."}
                </div>
              </div>
            </div>
          </div>
        )}

        <div
          key={data.converge ? 'converge' : active}
          className="animate-bw-fade-up"
        >
          <LedgerBreakdown groups={shown.groups} total={shown.total} />
        </div>
      </div>

      <div className="mt-8">
        <CompareFooterActions
          signedIn={signedIn}
          saved={saved}
          onSave={() => setSaved(true)}
        />
      </div>
    </div>
  )
}
