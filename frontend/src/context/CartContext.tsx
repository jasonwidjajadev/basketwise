import { useCallback, useMemo, useRef, useState } from 'react'

import type { BasketItem, Product } from '@/api/client'
import { CartContext } from '@/context/cart-context'

const PULSE_DURATION_MS = 420

interface CartEntry {
  product: Product
  quantity: number
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<CartEntry[]>([])
  const [pulse, setPulse] = useState(false)
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({})
  const pulseTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const add = useCallback((product: Product, qty = 1) => {
    setEntries((prev) => {
      const existing = prev.find((e) => e.product.id === product.id)
      if (existing) {
        return prev.map((e) =>
          e.product.id === product.id ? { ...e, quantity: e.quantity + qty } : e,
        )
      }
      return [...prev, { product, quantity: qty }]
    })
    setPulse(true)
    clearTimeout(pulseTimeout.current)
    pulseTimeout.current = setTimeout(() => setPulse(false), PULSE_DURATION_MS)
  }, [])

  const remove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.product.id !== id))
  }, [])

  const updateQuantity = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      setEntries((prev) => prev.filter((e) => e.product.id !== id))
    } else {
      setEntries((prev) =>
        prev.map((e) => (e.product.id === id ? { ...e, quantity: qty } : e)),
      )
    }
  }, [])

  const toggleSaved = useCallback((id: string) => {
    setSavedIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const count = useMemo(
    () => entries.reduce((sum, e) => sum + e.quantity, 0),
    [entries],
  )

  const addedIds = useMemo(
    () => Object.fromEntries(entries.map((e) => [e.product.id, true])),
    [entries],
  )

  const basketItems: BasketItem[] = useMemo(
    () => entries.map((e) => ({ product_id: e.product.id, quantity: e.quantity })),
    [entries],
  )

  const value = useMemo(
    () => ({
      entries,
      count,
      pulse,
      addedIds,
      savedIds,
      basketItems,
      add,
      remove,
      updateQuantity,
      toggleSaved,
    }),
    [entries, count, pulse, addedIds, savedIds, basketItems, add, remove, updateQuantity, toggleSaved],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
