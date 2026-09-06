/**
 * Multi-retailer price history, drawn as inline SVG.
 *
 * Deliberately dependency-free -- the project ships no charting library and a
 * six-point line does not justify adding one.
 *
 * The series is fetched by PriceHistoryPanel (/products/{id}/price-history) and
 * passed in, so the panel's range bar and this chart share one request. Crawls are
 * irregular, so the x-axis is scaled by real date rather than by index: a three-day
 * gap has to look like a three-day gap, otherwise the chart implies daily sampling
 * we do not have.
 */
import { RETAILER_LABEL } from '@/api/client'

import type { PriceHistory, Retailer } from '@/api/client'

const COLOR: Record<Retailer, string> = {
  coles: '#e01a22',
  woolworths: '#178841',
  aldi: '#0b4ea2',
  harrisfarm: '#e07b17',
}

const W = 640
const H = 220
const PAD = { top: 16, right: 16, bottom: 30, left: 46 }

const money = (n: number) => `$${n.toFixed(2)}`

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  })

export default function PriceHistoryChart({
  series,
}: {
  series: PriceHistory[]
}) {
  // A missing chart is better than a broken page: the offers above still answer
  // "what does this cost right now".
  const points = series.flatMap((s) => s.points)
  if (points.length === 0) return null

  const times = points.map((p) => new Date(p.recorded_at).getTime())
  const prices = points.map((p) => p.price)
  const t0 = Math.min(...times)
  const t1 = Math.max(...times)
  // Pad the price axis so a flat line sits mid-plot instead of on the frame.
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  const span = hi - lo || Math.max(hi * 0.2, 1)
  const yLo = Math.max(0, lo - span * 0.25)
  const yHi = hi + span * 0.25

  const x = (iso: string) =>
    t1 === t0
      ? (PAD.left + (W - PAD.right)) / 2
      : PAD.left +
        ((new Date(iso).getTime() - t0) / (t1 - t0)) *
          (W - PAD.left - PAD.right)

  const y = (v: number) =>
    H - PAD.bottom - ((v - yLo) / (yHi - yLo)) * (H - PAD.top - PAD.bottom)

  const days = new Set(points.map((p) => p.recorded_at.slice(0, 10)))
  const ticks = [yLo, (yLo + yHi) / 2, yHi]

  return (
    <section className="mt-8">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Price history</h2>
        <span className="text-xs text-gray-500">
          {days.size} observation
          {days.size === 1 ? '' : 's'} · {shortDate(new Date(t0).toISOString())}{' '}
          – {shortDate(new Date(t1).toISOString())}
        </span>
      </div>

      {days.size === 1 && (
        <p className="mb-2 text-xs text-gray-500">
          Only one crawl covers this product so far, so there is no trend to
          plot yet.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[220px] w-full min-w-[420px]"
          role="img"
          aria-label={`Price history across retailers, ${days.size} observations`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={y(t) + 4}
                textAnchor="end"
                className="fill-gray-400 text-[10px]"
              >
                {money(t)}
              </text>
            </g>
          ))}

          {series.map((s) => {
            const c = COLOR[s.retailer] ?? '#6b7280'
            const pts = s.points
              .map((p) => `${x(p.recorded_at)},${y(p.price)}`)
              .join(' ')
            return (
              <g key={s.retailer}>
                {s.points.length > 1 && (
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={c}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {s.points.map((p) => (
                  <circle
                    key={`${s.retailer}-${p.recorded_at}`}
                    cx={x(p.recorded_at)}
                    cy={y(p.price)}
                    r="3.5"
                    fill={c}
                  >
                    <title>
                      {`${RETAILER_LABEL[s.retailer]} · ${shortDate(p.recorded_at)} · ${money(p.price)}`}
                    </title>
                  </circle>
                ))}
              </g>
            )
          })}

          <text x={PAD.left} y={H - 8} className="fill-gray-400 text-[10px]">
            {shortDate(new Date(t0).toISOString())}
          </text>
          <text
            x={W - PAD.right}
            y={H - 8}
            textAnchor="end"
            className="fill-gray-400 text-[10px]"
          >
            {shortDate(new Date(t1).toISOString())}
          </text>
        </svg>
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => {
          const first = s.points[0]
          const last = s.points[s.points.length - 1]
          const delta = last.price - first.price
          return (
            <li
              key={s.retailer}
              className="flex items-center gap-1.5 text-xs text-gray-600"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLOR[s.retailer] }}
              />
              {RETAILER_LABEL[s.retailer]}
              <span className="text-gray-400">{money(last.price)}</span>
              {delta !== 0 && (
                <span className={delta < 0 ? 'text-green-600' : 'text-red-600'}>
                  {delta < 0 ? '↓' : '↑'} {money(Math.abs(delta))}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
