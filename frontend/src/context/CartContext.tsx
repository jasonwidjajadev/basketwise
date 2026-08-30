import { useCallback, useMemo, useRef, useState } from 'react'

import { CartContext } from '@/context/cart-context'

const PULSE_DURATION_MS = 420

export function CartProvider({ children }) {
  const [count, setCount] = useState(0)
  const [pulse, setPulse] = useState(false)
  const [addedIds, setAddedIds] = useState({})
  const [savedIds, setSavedIds] = useState({})
  const addedIdsRef = useRef({})
  const pulseTimeout = useRef(undefined)

  const add = useCallback((id, amount) => {
    if (addedIdsRef.current[id]) return
    addedIdsRef.current = { ...addedIdsRef.current, [id]: true }

    setAddedIds(addedIdsRef.current)
    setCount((prev) => prev + amount)
    setPulse(true)

    clearTimeout(pulseTimeout.current)
    pulseTimeout.current = setTimeout(() => setPulse(false), PULSE_DURATION_MS)
  }, [])

  const toggleSaved = useCallback((id) => {
    setSavedIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const value = useMemo(
    () => ({ count, pulse, addedIds, savedIds, add, toggleSaved }),
    [count, pulse, addedIds, savedIds, add, toggleSaved],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
