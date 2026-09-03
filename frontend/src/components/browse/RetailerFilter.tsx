import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: '', label: 'All stores' },
  { value: 'woolworths', label: 'Woolworths' },
  { value: 'coles', label: 'Coles' },
  { value: 'aldi', label: 'ALDI' },
  { value: 'harrisfarm', label: 'Harris Farm' },
]

export default function RetailerFilter({ value, onChange }) {
  return (
    <div
      role="group"
      aria-label="Filter by retailer"
      className="flex flex-wrap gap-1.5"
    >
      {OPTIONS.map((opt) => (
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
