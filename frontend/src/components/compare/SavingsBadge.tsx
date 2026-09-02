import { formatMoney } from '@/lib/format'

export default function SavingsBadge({ savings }) {
  if (savings <= 0.005) return null

  return (
    <span className="inline-block bg-bw-yellow px-1.75 py-0.75 font-archivo text-[10px] font-bold text-bw-yellow-ink">
      Save {formatMoney(savings)}
    </span>
  )
}
