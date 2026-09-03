import { MdCheck } from 'react-icons/md'

import { cn, formatMoney } from '@/lib/utils'
import SavingsBadge from '@/components/compare/SavingsBadge'
import WhyButton from '@/components/compare/WhyButton'

export default function OptionCard({
  label,
  tag,
  option,
  stores,
  active,
  onSelect,
  isBest,
  available = true,
  note,
  showWhyButton = false,
  whyOpen = false,
  onToggleWhy,
  animationDelay,
}) {
  if (!available) {
    return (
      <div
        className="animate-bw-fade-up flex flex-col items-start gap-2 bg-bw-surface px-5 py-5.5 text-bw-subtle"
        style={{ animationDelay }}
      >
        <h2 className="text-[13px] font-semibold text-bw-ink">{label}</h2>
        <p className="text-[12px] leading-relaxed text-bw-subtle italic">
          {note}
        </p>
      </div>
    )
  }

  // The recommended card hosts a nested WhyButton, and a <button> cannot
  // legally contain another <button> — the browser silently closes the
  // outer one when it hits the inner one. Render that one card as a
  // div[role=button] with manual keyboard support instead.
  const Tag = showWhyButton ? 'div' : 'button'
  const tagProps = showWhyButton
    ? {
        role: 'button',
        tabIndex: 0,
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect()
          }
        },
      }
    : { type: 'button' }

  return (
    <Tag
      onClick={onSelect}
      style={{ animationDelay }}
      className={cn(
        'animate-bw-fade-up flex w-full cursor-pointer flex-col items-start gap-2 border-2 bg-bw-surface px-5 py-5.5 text-left transition-all duration-200 motion-safe:active:scale-[0.98]',
        active
          ? 'border-bw-ink bg-bw-green-tint'
          : 'border-transparent hover:bg-bw-panel',
      )}
      {...tagProps}
    >
      <div className="flex items-center gap-2">
        {tag && (
          <span className="rounded-full bg-bw-green px-2.25 py-0.75 text-[10px] font-bold tracking-[.04em] text-white">
            {tag}
          </span>
        )}
        {showWhyButton && <WhyButton active={whyOpen} onClick={onToggleWhy} />}
      </div>

      <h2 className="text-[13px] font-semibold text-bw-ink">{label}</h2>
      <p className="text-[27px] leading-none text-bw-ink">
        {formatMoney(option.total)}
      </p>
      <p className="text-[11px] text-bw-subtle">{stores.join(' + ')}</p>

      {isBest ? (
        <span className="flex items-center gap-1 text-[10.5px] font-bold text-bw-green">
          <MdCheck className="h-3 w-3" /> Lowest price here
        </span>
      ) : (
        <SavingsBadge savings={option.savings} />
      )}
    </Tag>
  )
}
