import { RETAILER_FILTER_OPTIONS } from '@/components/storePrices'
import { cn } from '@/lib/utils'

export default function RetailerFilter({
  value,
  onChange,
  label = 'Filter by retailer',
  className,
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex flex-wrap gap-1.5', className)}
    >
      {RETAILER_FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-full border border-bw-line-strong bg-bw-surface px-3.5 py-2.25 text-xs font-semibold text-bw-ink transition-colors focus-visible:ring-2 focus-visible:ring-bw-green focus-visible:outline-none',
            value === opt.value && 'border-bw-ink bg-bw-panel',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
