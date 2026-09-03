import { useState } from 'react'
import { Link } from 'react-router'

import { cn } from '@/lib/utils'

const startAnotherWayTabs = [
  {
    label: 'Look for groceries',
    blurb:
      'Prefer to pick out your groceries manually? Let BasketWise show you the cheapest prices for all your faves!',
  },
  {
    label: 'Start from a meal plan',
    blurb:
      'Pick a week of dinners and we assemble one costed basket, flagging anything cheaper at a second store.',
  },
]

export default function StartAnotherWay() {
  const [tab, setTab] = useState(0)
  const active = startAnotherWayTabs[tab]

  return (
    <section id="start" className="mx-auto max-w-[1160px] px-6 pb-5 lg:px-10">
      <h2 className="mb-4.5 text-[30px] font-normal tracking-[-.01em] text-bw-ink">
        No receipt? Start another way.
      </h2>

      <div className="flex flex-wrap gap-2.5">
        {startAnotherWayTabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setTab(i)}
            className={cn(
              'rounded-full border px-4.5 py-2.5 text-[13px] font-semibold transition-all',
              i === tab
                ? 'border-bw-ink bg-bw-ink text-white'
                : 'border-[#D9D6CA] bg-transparent text-bw-body',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col items-start gap-4 border border-bw-line bg-bw-surface px-6 py-5.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[70ch] text-sm leading-relaxed text-bw-body">
          {active.blurb}
        </p>

        <Link
          to="/#essentials"
          className="shrink-0 border-b border-bw-green pb-0.5 text-[12.5px] font-semibold tracking-[.06em] text-bw-green uppercase"
        >
          Start →
        </Link>
      </div>
    </section>
  )
}
