import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'
import { useCart } from '@/context/useCart'
import {
  computeCompareOptions,
  RETAILER_LABEL,
} from '@/components/compare/compareBasket'
import CompareLoader from '@/components/compare/CompareLoader'
import EmptyCompareState from '@/components/compare/EmptyCompareState'
import OptionCard from '@/components/compare/OptionCard'
import LedgerBreakdown from '@/components/compare/LedgerBreakdown'
import UnavailableBanner from '@/components/compare/UnavailableBanner'
import ConvergeBlock from '@/components/compare/ConvergeBlock'
import CompareFooterActions from '@/components/compare/CompareFooterActions'

// Pricing usually returns in well under a second -- hold the loader long enough
// that it reads as a moment rather than a flash.
const LOADER_MIN_MS = 2500

export default function ComparePage() {
  const { items } = useCart()

  // Keyed by product_id AND quantity -- unlike Browse's sort, every basket
  // change here must trigger a fresh POST /compare, quantity included.
  const basketKey = items
    .map((entry) => `${entry.product_id}:${entry.quantity}`)
    .join(',')

  const [result, setResult] = useState({ key: null, data: null, failed: false })
  const loading = items.length > 0 && result.key !== basketKey

  useEffect(() => {
    if (items.length === 0) return

    let cancelled = false
    const controller = new AbortController()

    computeCompareOptions(items, controller.signal)
      .then((data) => {
        if (!cancelled) setResult({ key: basketKey, data, failed: false })
      })
      .catch((err) => {
        if (cancelled || err.name === 'AbortError') return
        setResult({ key: basketKey, data: null, failed: true })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [items, basketKey])

  // Minimum time the loader stays up, derived the same way `loading` is rather
  // than set synchronously in an effect. Gating on `heldKey === null` applies
  // the floor to the first pricing run only, so editing the basket from the
  // drawer later re-prices without another full-screen hold.
  const [heldKey, setHeldKey] = useState(null)
  const holding = heldKey === null

  useEffect(() => {
    if (heldKey !== null) return

    const timer = setTimeout(() => setHeldKey(basketKey), LOADER_MIN_MS)

    return () => clearTimeout(timer)
  }, [heldKey, basketKey])

  const [active, setActive] = useState('recommended')
  const [showWhy, setShowWhy] = useState(false)
  const [saved, setSaved] = useState(false)

  // No auth system exists yet (see PRODUCT.md) — always render the
  // signed-out state until sign-in is real.
  const signedIn = false

  if (items.length === 0) return <EmptyCompareState />

  if (loading || holding) return <CompareLoader />

  if (result.failed) {
    return (
      <main className="w-full px-6 pt-9.5 pb-24 lg:px-8 xl:px-12 2xl:px-16">
        <div className="mx-auto w-full max-w-7xl">
          <h1 className="text-[32px] text-bw-ink">How do you want to shop?</h1>
          <div className="mt-6">
            <UnavailableBanner>
              Couldn't price your basket right now. Check your connection and
              try again.
            </UnavailableBanner>
          </div>
        </div>
      </main>
    )
  }

  const data = result.data

  const optionMap = {
    recommended: data.recommended,
    single: data.cheapestSingle,
    lowest: data.lowestTotal,
  }

  const firstAvailable =
    data.recommended ?? data.cheapestSingle ?? data.lowestTotal
  const shown = data.converge
    ? data.recommended
    : (optionMap[active] ?? firstAvailable)

  const cards = data.converge
    ? []
    : [
        {
          id: 'recommended',
          label: 'Recommended split',
          tag: 'Recommended',
          option: data.recommended,
          stores: data.recommended?.groups.map((g) => g.label) ?? [],
          available: data.recommended != null,
          note: 'No combination of up to two stores covers your full basket.',
          showWhyButton: true,
        },
        {
          id: 'single',
          label: 'Cheapest single store',
          option: data.cheapestSingle,
          stores: data.cheapestSingle
            ? [RETAILER_LABEL[data.cheapestSingle.retailer]]
            : [],
          available: data.cheapestSingle != null,
          note: 'No single store carries everything in this basket.',
        },
        {
          id: 'lowest',
          label: 'Lowest possible price',
          option: data.lowestTotal,
          stores: data.lowestTotal?.groups.map((g) => g.label) ?? [],
          available: data.lowestTotal != null,
          note: 'None of your stores carry every item in this basket.',
        },
      ]

  const availableTotals = cards
    .filter((c) => c.available)
    .map((c) => c.option.total)

  const bestTotal = availableTotals.length ? Math.min(...availableTotals) : null

  const tie =
    availableTotals.length > 0 &&
    availableTotals.every((t) => Math.abs(t - bestTotal) < 0.005)

  const hasUnavailable = data.unavailableCount > 0
  const noOptionsAvailable = !shown

  return (
    <main className="w-full px-6 pt-9.5 pb-24 lg:px-8 xl:px-12 2xl:px-16">
      <div className="mx-auto w-full max-w-7xl">
        <h1 className="text-[32px] text-bw-ink">How do you want to shop?</h1>

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
                  {data.unavailableCount}{' '}
                  {data.unavailableCount === 1 ? 'item' : 'items'}
                </strong>{' '}
                in your basket could not be found and{' '}
                {data.unavailableCount === 1 ? 'has' : 'have'} been left out of
                every total below.
              </UnavailableBanner>
            </div>
          )}

          {noOptionsAvailable ? (
            <div className="animate-bw-fade-up">
              <UnavailableBanner>
                None of your stores carry every item in this basket, even
                combined. Remove an item to see pricing for the rest.
              </UnavailableBanner>
            </div>
          ) : (
            <>
              {!hasUnavailable && data.converge && (
                <div className="animate-bw-fade-up">
                  <ConvergeBlock recommended={data.recommended} />
                </div>
              )}

              {!data.converge && (
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
                        We price every 1- and 2-store combination and recommend
                        whichever is cheapest overall — a third store only gets
                        added if "Lowest possible price" shows it's worth the
                        extra trip.
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
            </>
          )}
        </div>

        <div className="mt-8">
          <CompareFooterActions
            signedIn={signedIn}
            saved={saved}
            onSave={() => setSaved(true)}
          />
        </div>
      </div>
    </main>
  )
}
