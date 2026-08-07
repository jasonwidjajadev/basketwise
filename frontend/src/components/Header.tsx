import { useState } from 'react'
import { Link } from 'react-router'

import icon from '@/assets/logo.svg'
import CartIcon from '@/components/icons/CartIcon'
import CartSidebar from '@/components/CartSidebar'

export default function Header() {
  const [isCartOpen, setIsCartOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={icon}
              alt=""
              className="h-7 w-7 object-contain"
            />

            <span className="text-xl font-semibold tracking-tight text-green-900">
              BasketWise
            </span>
          </Link>

          <nav aria-label="Main navigation">
            <ul className="flex items-center gap-3">
              <li>
                <Link
                  to="/browse"
                  className="px-3 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-950"
                >
                  Browse groceries
                </Link>
              </li>

              <li>
                <Link
                  to="/signin"
                  className="px-3 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-950"
                >
                  Sign in
                </Link>
              </li>

              <li>
                <button
                  type="button"
                  aria-label="Open cart"
                  onClick={() => setIsCartOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
                >
                  <CartIcon />
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <CartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
      />
    </>
  )
}