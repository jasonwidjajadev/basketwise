import { useState } from 'react'
import { Link } from 'react-router'

import icon from '@/assets/logo.svg'
import CartSidebar from '@/components/CartSidebar'
import CartIcon from '@/components/icons/CartIcon'

export default function Header() {
  const [isCartOpen, setIsCartOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-360 items-center justify-between px-6 lg:px-8 xl:px-10">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={icon}
              alt=""
              className="h-6.5 w-6.5 object-contain"
            />

            <span className="font-eb-garamond text-2xl font-medium text-basket-green">
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