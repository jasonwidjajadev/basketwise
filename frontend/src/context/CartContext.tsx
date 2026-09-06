import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CartContext } from '@/context/cart-context'

const PULSE_DURATION_MS = 420
const STORAGE_KEY = 'basketwise:cart'

function readPersistedCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// `items` is the only thing worth persisting -- count and addedIds are derived
// from it. Older payloads stored count separately, which is exactly how a
// basket ends up claiming "(2)" over an empty panel, so anything but items and
// savedIds is dropped on read. Malformed or duplicated entries are folded in
// rather than trusted.
function sanitize(persisted) {
  const byId = new Map()

  for (const entry of Array.isArray(persisted?.items) ? persisted.items : []) {
    const id = entry?.product_id
    const quantity = Math.floor(Number(entry?.quantity))
    if (typeof id !== 'string' || id === '') continue
    if (!Number.isFinite(quantity) || quantity < 1) continue
    byId.set(id, (byId.get(id) ?? 0) + quantity)
  }

  const savedIds = {}
  for (const [id, saved] of Object.entries(persisted?.savedIds ?? {})) {
    if (saved) savedIds[id] = true
  }

  return {
    items: [...byId].map(([product_id, quantity]) => ({
      product_id,
      quantity,
    })),
    savedIds,
  }
}

export function CartProvider({ children }) {
  const [persisted] = useState(() => sanitize(readPersistedCart()))

  const [items, setItems] = useState(persisted.items)
  const [savedIds, setSavedIds] = useState(persisted.savedIds)
  const [pulse, setPulse] = useState(false)

  // Mirrors `items` so the callbacks below can read the current basket without
  // being recreated on every change.
  const itemsRef = useRef(items)
  const pulseTimeout = useRef(undefined)

  const commit = useCallback((next) => {
    itemsRef.current = next
    setItems(next)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, savedIds }))
    } catch {
      // localStorage unavailable (private mode, quota, disabled) — cart just won't persist
    }
  }, [items, savedIds])

  useEffect(() => () => clearTimeout(pulseTimeout.current), [])

  const addedIds = useMemo(
    () =>
      Object.fromEntries(
        items.map((entry) => [entry.product_id, entry.quantity]),
      ),
    [items],
  )

  const count = useMemo(
    () => items.reduce((total, entry) => total + entry.quantity, 0),
    [items],
  )

  const add = useCallback(
    (id, amount) => {
      if (itemsRef.current.some((entry) => entry.product_id === id)) return
      const quantity = Math.max(1, Math.floor(Number(amount)) || 1)
      commit([...itemsRef.current, { product_id: id, quantity }])

      setPulse(true)
      clearTimeout(pulseTimeout.current)
      pulseTimeout.current = setTimeout(
        () => setPulse(false),
        PULSE_DURATION_MS,
      )
    },
    [commit],
  )

  const remove = useCallback(
    (id) => {
      const next = itemsRef.current.filter((entry) => entry.product_id !== id)
      if (next.length === itemsRef.current.length) return
      commit(next)
    },
    [commit],
  )

  const setQuantity = useCallback(
    (id, next) => {
      const entry = itemsRef.current.find((item) => item.product_id === id)
      if (!entry) return
      if (next < 1) {
        remove(id)
        return
      }
      commit(
        itemsRef.current.map((item) =>
          item.product_id === id ? { ...item, quantity: next } : item,
        ),
      )
    },
    [commit, remove],
  )

  const increment = useCallback(
    (id) => {
      const entry = itemsRef.current.find((item) => item.product_id === id)
      if (entry) setQuantity(id, entry.quantity + 1)
    },
    [setQuantity],
  )

  const decrement = useCallback(
    (id) => {
      const entry = itemsRef.current.find((item) => item.product_id === id)
      if (entry) setQuantity(id, entry.quantity - 1)
    },
    [setQuantity],
  )

  const toggleSaved = useCallback((id) => {
    setSavedIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const value = useMemo(
    () => ({
      count,
      pulse,
      addedIds,
      savedIds,
      items,
      add,
      remove,
      increment,
      decrement,
      toggleSaved,
    }),
    [
      count,
      pulse,
      addedIds,
      savedIds,
      items,
      add,
      remove,
      increment,
      decrement,
      toggleSaved,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
