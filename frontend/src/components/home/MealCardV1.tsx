import { cn } from '@/lib/utils'

export default function MealCard({ meal, added, onAdd }) {
  return (
    <div className="border border-bw-line bg-bw-[#f5f3ec]">
      <div
        className="flex aspect-4/3 items-center justify-center"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg,#F3F1EA 0 10px,#EDEBE2 10px 20px)',
        }}
      >
        <span className="font-mono text-[10px] tracking-[.08em] text-[#9B9A8F] uppercase">
          {meal.shot}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div>
          <p className="mb-0.5 text-[14.5px] font-semibold text-bw-ink">
            {meal.name}
          </p>
          <p className="text-[11.5px] text-bw-subtle">{meal.meta}</p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          aria-label={added ? `${meal.name} added` : `Add ${meal.name}`}
          className={cn(
            'flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full text-base leading-none text-white transition-colors',
            added ? 'bg-bw-ink-inverse-bg' : 'bg-bw-green',
          )}
        >
          {added ? '✓' : '+'}
        </button>
      </div>
    </div>
  )
}
