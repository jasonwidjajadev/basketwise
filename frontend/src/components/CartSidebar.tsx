import { Link } from 'react-router'

import { useCart } from '@/context/useCart'

export default function CartSidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { entries, count, updateQuantity, remove } = useCart()

  return (
    <div
      className={`fixed inset-0 z-50 ${
        isOpen ? 'pointer-events-auto visible' : 'pointer-events-none invisible'
      }`}
    >
      <button
        type="button"
        aria-label="Close cart"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <aside
        className={`absolute top-0 right-0 flex h-full w-full max-w-md flex-col bg-bw-surface transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-bw-line px-6 py-5">
          <h2 className="font-newsreader text-2xl font-normal text-bw-ink">
            Your basket ({count})
          </h2>

          <button
            type="button"
            aria-label="Close cart"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-bw-muted transition hover:bg-bw-panel hover:text-bw-ink"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-bw-muted">
              Your basket is empty.
            </p>
          ) : (
            <ul className="divide-y divide-bw-line">
              {entries.map(({ product, quantity }) => (
                <li key={product.id} className="flex gap-3 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[13px] font-medium text-bw-ink">{product.name}</p>
                    <p className="mt-0.5 text-[12px] text-bw-subtle">
                      {product.min_price != null ? `$${product.min_price.toFixed(2)}` : '—'}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(product.id, quantity - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-bw-line text-bw-muted transition hover:border-bw-ink hover:text-bw-ink"
                    >
                      −
                    </button>
                    <span className="w-4 text-center text-[13px] text-bw-ink">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(product.id, quantity + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-bw-line text-bw-muted transition hover:border-bw-ink hover:text-bw-ink"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(product.id)}
                      className="ml-1 text-[18px] text-bw-muted transition hover:text-bw-red"
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-bw-line px-6 py-5">
          <Link
            to="/compare"
            onClick={onClose}
            className="flex w-full justify-center rounded-sm bg-bw-green px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Compare basket →
          </Link>
        </div>
      </aside>
    </div>
  )
}
