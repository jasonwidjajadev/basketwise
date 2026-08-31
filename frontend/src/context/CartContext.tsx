import { useCallback, useMemo, useRef, useState } from 'react'

import { CartContext } from '@/context/cart-context'

const PULSE_DURATION_MS = 420

export function CartProvider({ children }) {
  const [count, setCount] = useState(0)
  const [pulse, setPulse] = useState(false)
  const [addedIds, setAddedIds] = useState({})
  const [savedIds, setSavedIds] = useState({})
  const [items, setItems] = useState([])
  const addedIdsRef = useRef({})
  const pulseTimeout = useRef(undefined)

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
      toggleSaved,
    }),
    [count, pulse, addedIds, savedIds, items, add, remove, toggleSaved],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
