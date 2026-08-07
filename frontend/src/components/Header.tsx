import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

// import cartOutlineIcon from '@/assets/icons/cart-outline.svg'
import { MdOutlineShoppingCart } from 'react-icons/md'
import menuIcon from '@/assets/icons/menu.svg'
import icon from '@/assets/logo.svg'
import CartSidebar from '@/components/CartSidebar'
import SearchBar from '@/components/SearchBar'

export default function Header() {
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white">
        <div className="grid h-16 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-6 lg:grid-cols-[1fr_minmax(0,36rem)_1fr] lg:gap-6 lg:px-8 xl:px-12">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 justify-self-start"
          >
            <img
              src={icon}
              alt=""
              className="h-6.5 w-6.5 shrink-0 object-contain"
            />

            <span className="hidden font-eb-garamond text-2xl font-medium text-basket-green sm:block">
              BasketWise
            </span>
          </Link>

          {/* Search */}
          <SearchBar />

          {/* Desktop navigation */}
          <nav
            aria-label="Main navigation"
            className="hidden justify-self-end lg:block"
          >
            <ul className="flex items-center gap-3">
              <li>
                <Link
                  to="/browse"
                  className="whitespace-nowrap px-3 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-950"
                >
                  Browse groceries
                </Link>
              </li>

              <li>
                <Link
                  to="/signin"
                  className="whitespace-nowrap rounded-full bg-basket-green px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
                >
                  Sign in
                </Link>
              </li>

              <li>

                <button
                  type="button"
                  aria-label="Open cart"
                  onClick={() => setIsCartOpen(true)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-800 hover:bg-zinc-200"
                >
                  <MdOutlineShoppingCart className="h-6 w-6" />
                </button>
              </li>
            </ul>
          </nav>

          {/* Mobile menu */}
          <div
            ref={menuRef}
            className="relative justify-self-end lg:hidden"
          >
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-zinc-100 active:bg-zinc-200"
            >
              <img
                src={menuIcon}
                alt=""
                className="h-7 w-7"
              />
            </button>

            {isMenuOpen && (
              <div className="absolute top-12 right-0 w-52 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
                <Link
                  to="/browse"
                  onClick={() => setIsMenuOpen(false)}
                  className="block rounded-lg px-4 py-3 text-sm text-zinc-800 hover:bg-zinc-100"
                >
                  Browse groceries
                </Link>

                <Link
                  to="/signin"
                  onClick={() => setIsMenuOpen(false)}
                  className="block rounded-lg px-4 py-3 text-sm text-zinc-800 hover:bg-zinc-100"
                >
                  Sign in
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    setIsCartOpen(true)
                  }}
                  className="block w-full rounded-lg px-4 py-3 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                >
                  Cart
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <CartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
      />
    </>
  )
}