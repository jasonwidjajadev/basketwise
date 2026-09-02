import { formatMoney } from '@/lib/format'
import SavingsBadge from '@/components/compare/SavingsBadge'

export default function ConvergeBlock({ recommended }) {
  return (
    <div className="mb-6">
      <span className="font-archivo text-[10.5px] font-bold tracking-[.16em] text-bw-green uppercase">
        Recommended for you
      </span>
      <p className="my-1.5 font-newsreader text-[30px] leading-none text-bw-ink">
        {formatMoney(recommended.total)} — every way to shop matches
      </p>
      <p className="mb-3.5 max-w-[58ch] text-[13px] leading-relaxed text-bw-body">
        Recommended, cheapest-single-store, and lowest-total-price all land on
        the exact same result for this basket.
      </p>
      <SavingsBadge savings={recommended.savings} />
    </div>
  )
}
