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

export function CartProvider({ children }) {
  const persisted = useRef(readPersistedCart()).current

  const [count, setCount] = useState(persisted?.count ?? 0)
  const [pulse, setPulse] = useState(false)
  const [addedIds, setAddedIds] = useState(persisted?.addedIds ?? {})
  const [savedIds, setSavedIds] = useState(persisted?.savedIds ?? {})
  const [items, setItems] = useState(persisted?.items ?? [])
  const addedIdsRef = useRef(persisted?.addedIds ?? {})
  const pulseTimeout = useRef(undefined)

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ count, addedIds, savedIds, items }),
      )
    } catch {
      // localStorage unavailable (private mode, quota, disabled) — cart just won't persist
    }
  }, [count, addedIds, savedIds, items])

  const add = useCallback((id, amount) => {
    if (addedIdsRef.current[id]) return
    addedIdsRef.current = { ...addedIdsRef.current, [id]: amount }

    setAddedIds(addedIdsRef.current)
    setItems((prev) => [...prev, { product_id: id, quantity: amount }])
    setCount((prev) => prev + amount)
    setPulse(true)

    clearTimeout(pulseTimeout.current)
    pulseTimeout.current = setTimeout(() => setPulse(false), PULSE_DURATION_MS)
  }, [])

  const remove = useCallback((id) => {
    const amount = addedIdsRef.current[id]
    if (!amount) return
    const rest = { ...addedIdsRef.current }
    delete rest[id]
    addedIdsRef.current = rest

    setAddedIds(rest)
    setItems((prev) => prev.filter((entry) => entry.product_id !== id))
    setCount((prev) => prev - amount)
  }, [])

  const increment = useCallback((id) => {
    if (!addedIdsRef.current[id]) return
    addedIdsRef.current = {
      ...addedIdsRef.current,
      [id]: addedIdsRef.current[id] + 1,
    }

    setAddedIds(addedIdsRef.current)
    setItems((prev) =>
      prev.map((entry) =>
        entry.product_id === id
          ? { ...entry, quantity: entry.quantity + 1 }
          : entry,
      ),
    )
    setCount((prev) => prev + 1)
  }, [])

  const decrement = useCallback(
    (id) => {
      const amount = addedIdsRef.current[id]
      if (!amount) return
      if (amount <= 1) {
        remove(id)
        return
      }

      addedIdsRef.current = { ...addedIdsRef.current, [id]: amount - 1 }
      setAddedIds(addedIdsRef.current)
      setItems((prev) =>
        prev.map((entry) =>
          entry.product_id === id
            ? { ...entry, quantity: entry.quantity - 1 }
            : entry,
        ),
      )
      setCount((prev) => prev - 1)
    },
    [remove],
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
