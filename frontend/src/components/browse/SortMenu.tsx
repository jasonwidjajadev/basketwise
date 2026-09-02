import { useEffect, useRef, useState } from 'react'
import { MdExpandMore, MdSort } from 'react-icons/md'

import { SORT_OPTIONS } from '@/lib/browseSort'
import { cn } from '@/lib/utils'

export default function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape' && open) {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const current =
    SORT_OPTIONS.find((opt) => opt.value === value) ?? SORT_OPTIONS[0]

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-bw-line-strong bg-bw-surface px-4 py-2.25 font-archivo text-xs font-semibold text-bw-ink transition-colors focus-visible:ring-2 focus-visible:ring-bw-green focus-visible:outline-none"
      >
        <MdSort className="h-4 w-4 text-bw-subtle" />
        Sort: {current.label}
        <MdExpandMore
          className={cn(
            'h-3.5 w-3.5 text-bw-subtle transition-transform motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>

      <div
        role="listbox"
        aria-label="Sort by"
        aria-hidden={!open}
        className={cn(
          'absolute top-[calc(100%+8px)] right-0 z-30 min-w-56 origin-top-right border border-bw-line bg-bw-surface transition-[opacity,transform] ease-out motion-reduce:transition-none',
          open
            ? 'pointer-events-auto visible translate-y-0 scale-100 opacity-100 duration-150'
            : 'pointer-events-none invisible -translate-y-1 scale-95 opacity-0 duration-100',
        )}
      >
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="option"
            tabIndex={open ? 0 : -1}
            aria-selected={opt.value === value}
            onClick={() => {
              onChange(opt.value)
              setOpen(false)
              triggerRef.current?.focus()
            }}
            className={cn(
              'block w-full border-b border-bw-line px-4 py-2.75 text-left font-archivo text-xs text-bw-ink last:border-b-0 hover:bg-bw-panel focus-visible:ring-2 focus-visible:ring-bw-green focus-visible:outline-none',
              opt.value === value && 'bg-bw-panel font-semibold',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
