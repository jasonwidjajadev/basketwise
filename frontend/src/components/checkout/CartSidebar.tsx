import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { MdAdd, MdDeleteOutline, MdRemove } from 'react-icons/md'

import productDefault from '@/assets/product_card/product_default.png'
import { useCartLineItem } from '@/components/checkout/cartLineItems.js'
import { useCart } from '@/context/useCart'

const QTY_POP_DURATION_MS = 300
const ROW_COLLAPSE_DURATION_MS = 280

function fmt(n) {
  return `$${n.toFixed(2)}`
}

function LoadingRow() {
  return (
    <div className="animate-bw-fade-up flex items-center gap-3.5 border-b border-bw-line px-5 py-3.5">
      <div className="h-13 w-13 shrink-0 animate-pulse rounded-2xl border border-bw-line bg-bw-panel" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-2/3 animate-pulse rounded bg-bw-panel" />
        <div className="h-3 w-1/4 animate-pulse rounded bg-bw-panel" />
      </div>
    </div>
  )
}

function CartRow({
  productId,
  quantity,
  leaving,
  onIncrement,
  onDecrement,
  onRemove,
  onCollapseEnd,
  onUnavailable,
}) {
  const { status, item } = useCartLineItem(productId)

  const [qtyPop, setQtyPop] = useState(false)
  const prevQuantity = useRef(quantity)
  const popTimeout = useRef(undefined)

  useEffect(() => {
    if (prevQuantity.current !== quantity) {
      prevQuantity.current = quantity
      setQtyPop(true)
      clearTimeout(popTimeout.current)
      popTimeout.current = setTimeout(
        () => setQtyPop(false),
        QTY_POP_DURATION_MS,
      )
    }
    return () => clearTimeout(popTimeout.current)
  }, [quantity])

  // An id the catalogue no longer has can't be rendered, and leaving it in the
  // basket is what made the header count disagree with an empty panel. Drop it.
  useEffect(() => {
    if (status === 'missing') onUnavailable(productId)
  }, [status, productId, onUnavailable])

  if (status === 'loading') return <LoadingRow />
  if (status === 'missing') return null

  // status === 'error': the lookup failed (offline, server error), so keep the
  // row -- with its quantity controls -- rather than silently dropping it.
  const name = item ? item.name : 'Item unavailable'
  const imageSrc = item?.image_url || productDefault
  const priceLabel = !item
    ? "Couldn't load this item"
    : item.kind === 'meal'
      ? fmt(item.totalPrice)
      : fmt(item.unitPrice * quantity)
  const isMeal = item?.kind === 'meal'

  return (
    <div
      className={`bw-row-collapse ${leaving ? 'bw-row-collapse-leaving' : ''}`}
      onTransitionEnd={(e) => {
        if (leaving && e.propertyName === 'grid-template-rows') onCollapseEnd()
      }}
    >
      <div>
        <div
          className={`bw-row-collapse-inner animate-bw-fade-up flex items-center gap-3.5 border-b border-bw-line px-5 py-3.5`}
        >
          <img
            src={imageSrc}
            alt={name}
            onError={(e) => {
              if (e.currentTarget.src !== productDefault) {
                e.currentTarget.src = productDefault
              }
            }}
            className="h-13 w-13 shrink-0 rounded-2xl border border-bw-line bg-bw-panel object-contain"
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold text-bw-ink">
              {name}
            </p>
            {isMeal && (
              <p className="mt-0.5 text-[10.5px] text-bw-muted">{item.meta}</p>
            )}
            <p
              key={priceLabel}
              className="animate-bw-fade-up mt-0.5 text-[13px] text-bw-body"
              style={{ animationDuration: '200ms' }}
            >
              {priceLabel}
            </p>
          </div>

          {isMeal ? (
            <button
              type="button"
              onClick={onRemove}
              className="shrink-0 text-[10.5px] font-bold tracking-[.04em] text-bw-muted uppercase underline underline-offset-2 transition-colors hover:text-bw-ink motion-safe:duration-150"
            >
              Remove
            </button>
          ) : (
            <div className="flex shrink-0 items-center gap-3.5">
              <button
                type="button"
                onClick={onDecrement}
                aria-label="Decrease quantity"
                className="text-bw-ink transition-transform active:scale-90 motion-reduce:active:scale-100"
              >
                <MdRemove className="h-4.5 w-4.5" />
              </button>
              <span
                className={`min-w-[1em] text-center text-[13px] font-bold text-bw-ink tabular-nums ${
                  qtyPop ? 'motion-safe:animate-[bw-pop_300ms_ease]' : ''
                }`}
              >
                {quantity}
              </span>
              <button
                type="button"
                onClick={onIncrement}
                aria-label="Increase quantity"
                className="text-bw-ink transition-transform active:scale-90 motion-reduce:active:scale-100"
              >
                <MdAdd className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                onClick={onRemove}
                aria-label="Remove from basket"
                className="text-bw-muted transition-colors hover:text-bw-ink motion-safe:duration-150"
              >
                <MdDeleteOutline className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CartSidebar({ isOpen, onClose }) {
  const { count, items, increment, decrement, remove } = useCart()
  const [leavingIds, setLeavingIds] = useState(() => new Set())

  const beginRemove = (productId) => {
    setLeavingIds((prev) => new Set(prev).add(productId))
  }

  const handleCollapseEnd = (productId) => {
    remove(productId)
    setLeavingIds((prev) => {
      const next = new Set(prev)
      next.delete(productId)
      return next
    })
  }

  const handleDecrement = (productId, quantity) => {
    if (quantity <= 1) {
      beginRemove(productId)
      return
    }
    decrement(productId)
  }

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
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <aside
        className={`absolute top-0 right-0 flex h-full w-full max-w-md flex-col bg-white transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 p-6">
          <h2 className="text-xl font-semibold">Your basket ({count})</h2>

          <button
            type="button"
            aria-label="Close cart"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 active:bg-zinc-200"
          >
            ×
          </button>
        </div>

        {items.length === 0 ? (
          <div className="animate-bw-fade-up flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-bw-subtle">Your basket is empty.</p>
            <Link
              to="/browse"
              onClick={onClose}
              className="text-sm font-semibold text-bw-green underline underline-offset-2"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {items.map((entry) => (
              <CartRow
                key={entry.product_id}
                productId={entry.product_id}
                quantity={entry.quantity}
                leaving={leavingIds.has(entry.product_id)}
                onIncrement={() => increment(entry.product_id)}
                onDecrement={() =>
                  handleDecrement(entry.product_id, entry.quantity)
                }
                onRemove={() => beginRemove(entry.product_id)}
                onCollapseEnd={() => handleCollapseEnd(entry.product_id)}
                onUnavailable={remove}
              />
            ))}
          </div>
        )}

        <div className="border-t border-zinc-200 p-6">
          <Link
            to="/compare"
            onClick={onClose}
            className="flex w-full justify-center rounded-full bg-bw-green px-5 py-3 text-sm font-semibold text-white"
          >
            Compare basket
          </Link>
        </div>
      </aside>
    </div>
  )
}
