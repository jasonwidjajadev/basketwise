import { useEffect, useState } from 'react'

import { getPriceTrend, RETAILER_LABEL } from '@/api/client'

import type { PriceHistory, Retailer } from '@/api/client'

import { RETAILER_ORDER } from '@/components/storePrices'

/**
 * Price over time, one line per retailer.
 *
 * Renders nothing unless the backend has observations on at least two distinct
 * days -- a single day is not a trend, and the artifact alone only ever holds one.
 * Multi-day data comes from /price-trend, which merges Supabase uploads in.
 */

const RANGES = [
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
  { days: 365, label: '1y' },
] as const

// Fixed order, never cycled: a retailer keeps its colour whatever subset is
// present. Validated for CVD separation; the amber is under 3:1 on white so the
// line end is always direct-labelled and the table view is one click away.
const SERIES_COLOR: Record<Retailer, string> = {
  woolworths: '#1b6e3a',
  coles: '#c4122f',
  aldi: '#1d4ed8',
  harrisfarm: '#e0a010',
}

// Second encoding beside colour, so two similar hues still read apart.
const SERIES_MARK: Record<
  Retailer,
  'circle' | 'square' | 'diamond' | 'triangle'
> = {
  woolworths: 'circle',
  coles: 'square',
  aldi: 'diamond',
  harrisfarm: 'triangle',
}

type Series = {
  retailer: Retailer
  points: { day: string; t: number; price: number }[]
}

const DAY_MS = 86_400_000

function dayOf(iso: string) {
  return iso.slice(0, 10)
}

function toSeries(history: PriceHistory[]): Series[] {
  const byRetailer = new Map<Retailer, Series>()
  for (const h of history) {
    const retailer = h.retailer as Retailer
    if (!(retailer in SERIES_COLOR)) continue
    const points = h.points
      .filter((p) => typeof p.price === 'number' && Number.isFinite(p.price))
      .map((p) => {
        const day = dayOf(p.recorded_at)
        return { day, t: Date.parse(`${day}T00:00:00Z`), price: p.price }
      })
      .filter((p) => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t)
    if (points.length > 0) byRetailer.set(retailer, { retailer, points })
  }
  // Legend and stacking order follow the retailer order used everywhere else.
  return RETAILER_ORDER.flatMap((r) => byRetailer.get(r) ?? [])
}

function distinctDays(series: Series[]) {
  const days = new Set<string>()
  for (const s of series) for (const p of s.points) days.add(p.day)
  return [...days].sort()
}

function formatDay(day: string, withYear = false) {
  const d = new Date(`${day}T00:00:00Z`)
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  })
}

function niceTicks(min: number, max: number, count = 5) {
  const span = max - min || 1
  const rawStep = span / count
  const mag = 10 ** Math.floor(Math.log10(rawStep))
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step)
    ticks.push(Number(v.toFixed(4)))
  return { lo, hi, ticks }
}

function Marker({
  kind,
  x,
  y,
  color,
  r = 4,
}: {
  kind: (typeof SERIES_MARK)[Retailer]
  x: number
  y: number
  color: string
  r?: number
}) {
  const ring = { stroke: '#ffffff', strokeWidth: 2 }
  switch (kind) {
    case 'square':
      return (
        <rect
          x={x - r}
          y={y - r}
          width={r * 2}
          height={r * 2}
          fill={color}
          {...ring}
        />
      )
    case 'diamond':
      return (
        <polygon
          points={`${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}`}
          fill={color}
          {...ring}
        />
      )
    case 'triangle':
      return (
        <polygon
          points={`${x},${y - r - 1} ${x + r + 1},${y + r} ${x - r - 1},${y + r}`}
          fill={color}
          {...ring}
        />
      )
    default:
      return <circle cx={x} cy={y} r={r} fill={color} {...ring} />
  }
}

export default function PriceTrendChart({ productId }: { productId: string }) {
  const [days, setDays] = useState<(typeof RANGES)[number]['days']>(90)
  // Loading is derived from whether the stored result matches the current
  // request, rather than set synchronously in the effect -- same race fix as
  // Browse: an out-of-order response can never mark a stale result fresh.
  const requestKey = `${productId}:${days}`
  const [loaded, setLoaded] = useState<{
    key: string
    series: Series[]
  } | null>(null)
  const [showTable, setShowTable] = useState(false)
  const [hoverDay, setHoverDay] = useState<string | null>(null)

  // The host div only mounts once there is data, so the element is held in
  // state (not a ref) and the observer attaches when it appears.
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(720)

  useEffect(() => {
    if (!host) return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(host)
    return () => ro.disconnect()
  }, [host])

  useEffect(() => {
    const controller = new AbortController()
    getPriceTrend(productId, days, controller.signal)
      .then((history) =>
        setLoaded({ key: requestKey, series: toSeries(history) }),
      )
      .catch((error) => {
        // A chart is decoration; the product page must not care if it fails.
        if (!controller.signal.aborted) {
          console.error('Price trend lookup failed', error)
          setLoaded({ key: requestKey, series: [] })
        }
      })
    return () => controller.abort()
  }, [productId, days, requestKey])

  if (!loaded) return null

  const series = loaded.series
  // While a new range loads, keep the previous frame at reduced opacity.
  const refetching = loaded.key !== requestKey

  const dayList = distinctDays(series)
  // One day is a price, not a trend. Only show once the backend has history.
  if (dayList.length < 2) return null

  const prices = series.flatMap((s) => s.points.map((p) => p.price))
  const { lo, hi, ticks } = niceTicks(Math.min(...prices), Math.max(...prices))

  const margin = { top: 16, right: 92, bottom: 28, left: 44 }
  const height = 260
  const plotW = Math.max(120, width - margin.left - margin.right)
  const plotH = height - margin.top - margin.bottom

  const t0 = Date.parse(`${dayList[0]}T00:00:00Z`)
  const t1 = Date.parse(`${dayList[dayList.length - 1]}T00:00:00Z`)
  const span = Math.max(t1 - t0, DAY_MS)
  const xOf = (t: number) => margin.left + ((t - t0) / span) * plotW
  const yOf = (v: number) =>
    margin.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH

  // Label at most ~6 dates so they never collide.
  const stride = Math.max(1, Math.ceil(dayList.length / 6))
  const xTicks = dayList.filter(
    (_, i) => i % stride === 0 || i === dayList.length - 1,
  )
  const spansYears =
    dayList[0].slice(0, 4) !== dayList[dayList.length - 1].slice(0, 4)

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    let best = dayList[0]
    let bestDist = Infinity
    for (const day of dayList) {
      const d = Math.abs(xOf(Date.parse(`${day}T00:00:00Z`)) - px)
      if (d < bestDist) {
        bestDist = d
        best = day
      }
    }
    setHoverDay(best)
  }

  const hoverX = hoverDay ? xOf(Date.parse(`${hoverDay}T00:00:00Z`)) : null
  const hoverRows = hoverDay
    ? series.map((s) => ({
        retailer: s.retailer,
        price: s.points.find((p) => p.day === hoverDay)?.price ?? null,
      }))
    : []
  const tooltipLeft =
    hoverX != null && hoverX > margin.left + plotW * 0.6
      ? hoverX - 172
      : (hoverX ?? 0) + 12

  return (
    <section className="mt-10" aria-labelledby="price-trend-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="price-trend-heading"
            className="text-[10.5px] font-bold tracking-[.14em] text-bw-muted uppercase"
          >
            Price over time
          </h2>
          <p className="mt-1 text-sm text-bw-muted">
            {dayList.length} days of prices, {formatDay(dayList[0], true)} to{' '}
            {formatDay(dayList[dayList.length - 1], true)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Date range"
            className="flex overflow-hidden rounded-full border border-bw-line text-xs font-semibold"
          >
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                aria-pressed={r.days === days}
                onClick={() => setDays(r.days)}
                className={
                  r.days === days
                    ? 'bg-bw-green px-3 py-1.5 text-white'
                    : 'px-3 py-1.5 text-bw-ink transition hover:bg-bw-panel'
                }
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={showTable}
            onClick={() => setShowTable((v) => !v)}
            className="rounded-full border border-bw-line px-3 py-1.5 text-xs font-semibold text-bw-ink transition hover:bg-bw-panel"
          >
            {showTable ? 'Chart' : 'Table'}
          </button>
        </div>
      </div>

      {/* Legend: always present for 2+ series, line keys mirror the mark. */}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-bw-body">
        {series.map((s) => (
          <li key={s.retailer} className="flex items-center gap-2">
            <svg width="22" height="12" aria-hidden="true">
              <line
                x1="0"
                y1="6"
                x2="22"
                y2="6"
                stroke={SERIES_COLOR[s.retailer]}
                strokeWidth="2"
              />
              <Marker
                kind={SERIES_MARK[s.retailer]}
                x={11}
                y={6}
                color={SERIES_COLOR[s.retailer]}
                r={3}
              />
            </svg>
            {RETAILER_LABEL[s.retailer]}
          </li>
        ))}
      </ul>

      <div
        ref={setHost}
        className="relative mt-3 rounded-2xl border border-bw-line bg-white p-2 transition-opacity"
        style={{ opacity: refetching ? 0.55 : 1 }}
      >
        {showTable ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-bw-muted">
                  <th className="px-2 py-1.5 font-semibold">Date</th>
                  {series.map((s) => (
                    <th
                      key={s.retailer}
                      className="px-2 py-1.5 text-right font-semibold"
                    >
                      {RETAILER_LABEL[s.retailer]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...dayList].reverse().map((day) => (
                  <tr key={day} className="border-t border-bw-line">
                    <td className="px-2 py-1.5 text-bw-ink">
                      {formatDay(day, true)}
                    </td>
                    {series.map((s) => {
                      const p = s.points.find((pt) => pt.day === day)
                      return (
                        <td
                          key={s.retailer}
                          className="px-2 py-1.5 text-right text-bw-ink tabular-nums"
                        >
                          {p ? `$${p.price.toFixed(2)}` : '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label="Line chart of price per retailer over time"
              className="block max-w-full touch-none select-none"
              onPointerMove={onPointerMove}
              onPointerLeave={() => setHoverDay(null)}
            >
              {/* Grid + y axis */}
              {ticks.map((v) => (
                <g key={v}>
                  <line
                    x1={margin.left}
                    x2={margin.left + plotW}
                    y1={yOf(v)}
                    y2={yOf(v)}
                    stroke="#e4e1d6"
                    strokeWidth="1"
                  />
                  <text
                    x={margin.left - 8}
                    y={yOf(v)}
                    dy="0.35em"
                    textAnchor="end"
                    fontSize="11"
                    fill="#6e6d63"
                  >
                    ${v.toFixed(2)}
                  </text>
                </g>
              ))}

              {/* x axis */}
              {xTicks.map((day) => (
                <text
                  key={day}
                  x={xOf(Date.parse(`${day}T00:00:00Z`))}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#6e6d63"
                >
                  {formatDay(day, spansYears)}
                </text>
              ))}

              {/* Crosshair */}
              {hoverX != null && (
                <line
                  x1={hoverX}
                  x2={hoverX}
                  y1={margin.top}
                  y2={margin.top + plotH}
                  stroke="#c9c6b8"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              )}

              {/* Lines, markers, direct labels */}
              {series.map((s) => {
                const color = SERIES_COLOR[s.retailer]
                const d = s.points
                  .map((p, i) => `${i ? 'L' : 'M'}${xOf(p.t)},${yOf(p.price)}`)
                  .join(' ')
                const last = s.points[s.points.length - 1]
                return (
                  <g key={s.retailer}>
                    <path
                      d={d}
                      fill="none"
                      stroke={color}
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {s.points.map((p) => (
                      <Marker
                        key={p.day}
                        kind={SERIES_MARK[s.retailer]}
                        x={xOf(p.t)}
                        y={yOf(p.price)}
                        color={color}
                        r={p.day === hoverDay ? 5 : 4}
                      />
                    ))}
                    <text
                      x={xOf(last.t) + 10}
                      y={yOf(last.price)}
                      dy="0.35em"
                      fontSize="11"
                      fontWeight="600"
                      fill="#1c1c1a"
                    >
                      {RETAILER_LABEL[s.retailer]}
                    </text>
                  </g>
                )
              })}
            </svg>

            {hoverDay && hoverX != null && (
              <div
                className="pointer-events-none absolute top-3 w-40 rounded-lg border border-bw-line bg-white px-3 py-2 text-xs shadow-md"
                style={{ left: tooltipLeft }}
              >
                <p className="font-semibold text-bw-ink">
                  {formatDay(hoverDay, true)}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {hoverRows.map((row) => (
                    <li key={row.retailer} className="flex items-center gap-2">
                      <span
                        className="inline-block h-0.5 w-3"
                        style={{ background: SERIES_COLOR[row.retailer] }}
                      />
                      <span className="flex-1 text-bw-muted">
                        {RETAILER_LABEL[row.retailer]}
                      </span>
                      <span className="font-semibold text-bw-ink tabular-nums">
                        {row.price == null ? '—' : `$${row.price.toFixed(2)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
