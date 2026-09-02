import { formatMoney } from '@/lib/format'

export default function LedgerBreakdown({ groups, total }) {
  return (
    <div className="border border-bw-line bg-bw-surface">
      {groups.map((group, i) => (
        <div
          key={group.retailer}
          className={i > 0 ? 'border-t border-bw-line' : ''}
        >
          <div className="flex items-baseline justify-between bg-bw-panel px-4 py-2 sm:px-5.5">
            <h3 className="font-newsreader text-[16px] font-medium text-bw-ink">
              {group.label}
            </h3>
            <span className="font-archivo text-[10px] font-bold tracking-[.14em] text-bw-subtle uppercase">
              {group.lines.length} item{group.lines.length === 1 ? '' : 's'}
            </span>
          </div>

          <ul>
            {group.lines.map((line) => (
              <li
                key={line.product.id}
                className="flex items-center justify-between gap-3 border-t border-bw-line px-4 py-2 first:border-t-0 sm:px-5.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-bw-ink">
                    {line.product.name}
                  </p>
                  <p className="text-[11px] text-bw-subtle">
                    {line.quantity} × {formatMoney(line.unitPrice)}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-semibold text-bw-ink">
                  {formatMoney(line.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-bw-line px-4 py-2 sm:px-5.5">
            <span className="font-archivo text-[10.5px] font-bold tracking-[.08em] text-bw-muted uppercase">
              {group.label} subtotal
            </span>
            <span className="text-[13px] font-semibold text-bw-ink">
              {formatMoney(group.subtotal)}
            </span>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between bg-bw-ink-inverse-bg px-4 py-4.5 sm:px-5.5">
        <span className="font-archivo text-[11px] font-bold tracking-[.16em] text-bw-on-dark uppercase">
          Total
        </span>
        <span className="font-newsreader text-[30px] leading-none text-white">
          {formatMoney(total)}
        </span>
      </div>
    </div>
  )
}
