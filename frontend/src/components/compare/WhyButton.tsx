import { MdInfoOutline } from 'react-icons/md'

import { cn } from '@/lib/utils'

export default function WhyButton({ active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label="Why is this recommended?"
      aria-expanded={active}
      className={cn(
        'flex h-4.5 w-4.5 items-center justify-center rounded-full border transition-all duration-150 motion-safe:active:scale-90',
        active
          ? 'border-bw-ink bg-bw-ink text-white'
          : 'border-bw-line-strong bg-bw-surface text-bw-muted',
      )}
    >
      <MdInfoOutline className="h-2.75 w-2.75" />
    </button>
  )
}
