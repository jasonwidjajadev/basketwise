/**
 * "Today's price" -- where the selected retailer's price sits between the
 * cheapest and the dearest price we have observed for this item.
 *
 * Dependency-free like PriceHistoryChart: the project ships no charting library
 * and a three-stop gradient does not justify adding one.
 */

const money = (n: number) => `$${n.toFixed(2)}`

// Prices are equal to the cent when they differ by less than half of one.
const FLAT_EPSILON = 0.005

type Tick = {
  label: string
  value: number
  position: number
}

/**
 * Keep a label inside the track. A bubble centred on 0% would hang half of
 * itself off the left edge, so pin the outer few percent to the ends instead.
 */
function anchor(position: number) {
  if (position <= 6) return { left: '0%', transform: 'none' }
  if (position >= 94) return { left: '100%', transform: 'translateX(-100%)' }
  return { left: `${position}%`, transform: 'translateX(-50%)' }
}

function alignment(position: number) {
  if (position <= 6) return 'items-start text-left'
  if (position >= 94) return 'items-end text-right'
  return 'items-center text-center'
}

export default function PriceRangeBar({
  lowest,
  usually,
  highest,
  current,
  currentLabel,
  caption,
}: {
  lowest: number
  usually: number
  highest: number
  /** The selected retailer's price, marked on the track. */
  current: number | null
  currentLabel: string | null
  caption: string
}) {
  const span = highest - lowest

  // Every observation is the same price. A gradient across a zero-width range
  // would invent a spread the data does not have, so show one flat reading.
  const flat = span < FLAT_EPSILON

  const positionOf = (value: number) =>
    flat ? 50 : Math.min(100, Math.max(0, ((value - lowest) / span) * 100))

  const ticks: Tick[] = flat
    ? [{ label: 'Every observation', value: lowest, position: 50 }]
    : [
        { label: 'Lowest', value: lowest, position: 0 },
        { label: 'Usually', value: usually, position: positionOf(usually) },
        { label: 'Highest', value: highest, position: 100 },
      ]

  const currentPosition = current == null ? null : positionOf(current)

  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-bw-ink">
          Today&rsquo;s price
        </h2>
        <span className="text-xs text-bw-subtle">{caption}</span>
      </div>

      {/* Price marker */}
      <div className="relative h-8">
        {current != null && currentPosition != null && (
          <div
            className={`absolute bottom-0 flex flex-col ${alignment(currentPosition)}`}
            style={anchor(currentPosition)}
          >
            <span className="rounded-md bg-bw-ink px-2 py-1 text-xs font-semibold text-white">
              {money(current)}
            </span>
          </div>
        )}
      </div>

      {/* Track */}
      <div
        className="relative h-2.5 w-full rounded-full"
        style={{
          background: flat
            ? '#1a8a3f'
            : 'linear-gradient(to right, #1a8a3f 0%, #6aa61d 35%, #e0a800 65%, #d92b2b 100%)',
        }}
        role="img"
        aria-label={
          flat
            ? `Every observed price is ${money(lowest)}`
            : `Observed prices run from ${money(lowest)} to ${money(highest)}, usually ${money(usually)}${
                current == null
                  ? ''
                  : `. ${currentLabel ?? 'Selected store'} is ${money(current)}`
              }`
        }
      >
        {currentPosition != null && (
          <span
            className="absolute -top-1 h-4.5 w-1 -translate-x-1/2 rounded-full bg-bw-ink"
            style={{ left: `${currentPosition}%` }}
          />
        )}
      </div>

      {/* Ticks */}
      <div className="relative mt-2 h-9">
        {ticks.map((tick) => (
          <div
            key={tick.label}
            className={`absolute top-0 flex flex-col gap-0.5 ${alignment(tick.position)}`}
            style={anchor(tick.position)}
          >
            <span className="text-[11px] whitespace-nowrap text-bw-muted">
              {tick.label}
            </span>
            <span className="text-[11px] font-semibold whitespace-nowrap text-bw-ink">
              {money(tick.value)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
