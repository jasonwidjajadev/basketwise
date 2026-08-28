import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  MdOutlineGridView,
  MdOutlineListAlt,
  MdOutlinePerson,
} from 'react-icons/md'

import cartOutlineIcon from '@/assets/icons/cart-outline.svg'
import menuIcon from '@/assets/icons/menu.svg'
import icon from '@/assets/logo.svg'
import CartSidebar from '@/components/CartSidebar'
import SearchBar from '@/components/SearchBar'
import { useCart } from '@/context/useCart'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { to: '/#essentials', label: 'Groceries' },
  { to: '/#meals', label: 'Meals' },
  { to: '/#browse', label: 'Compare' },
  { to: '/#faq', label: 'Help' },
]

export default function Header() {
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const menuRef = useRef(null)
  const { count, pulse } = useCart()

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target)
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
      <header className="sticky top-0 z-40 w-full bg-bw-ink-inverse-bg text-bw-on-dark">
        <div className="grid h-13 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-6 lg:grid-cols-[1fr_minmax(0,32rem)_1fr] lg:gap-6 lg:px-10">
          {/* Logo + anchor nav */}
          <div className="flex items-center gap-7 justify-self-start">
            <Link
              to="/"
              className="flex items-center gap-2"
            >
              <img
                src={icon}
                alt=""
                className="h-6 w-6 shrink-0 object-contain"
              />

              <span className="hidden font-newsreader text-xl tracking-[-.01em] text-bw-panel sm:block">
                BasketWise
              </span>
            </Link>

            <nav
              aria-label="Section navigation"
              className="hidden items-center gap-5.5 xl:flex"
            >
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="font-archivo text-xs tracking-[.08em] text-bw-on-dark uppercase"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Search */}
          <SearchBar />

          {/* Desktop navigation */}
          <nav
            aria-label="Main navigation"
            className="hidden justify-self-end lg:block"
          >
            <ul className="flex items-center gap-4">
              <li className="hidden shrink-0 items-center gap-4.5 font-archivo text-[11.5px] tracking-[.1em] text-bw-on-dark uppercase xl:flex">
                <Link
                  to="/signin"
                  className="border-b border-bw-yellow/45 whitespace-nowrap text-bw-yellow"
                >
                  Sign in
                </Link>
              </li>

              <li>
                <Link
                  to="/browse"
                  className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-bw-on-dark transition hover:text-bw-panel"
                >
                  <MdOutlineGridView className="h-5 w-5" />
                  Browse
                </Link>
              </li>

              <li>
                <Link
                  to="/account"
                  className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-bw-on-dark transition hover:text-bw-panel"
                >
                  <MdOutlineListAlt className="h-5 w-5" />
                  Lists
                </Link>
              </li>

              <li>
                <Link
                  to="/signin"
                  aria-label="Account"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-bw-on-dark transition hover:bg-white/15 hover:text-bw-panel"
                >
                  <MdOutlinePerson className="h-5.5 w-5.5" />
                </Link>
              </li>

              <li>
                <button
                  type="button"
                  aria-label="Open cart"
                  onClick={() => setIsCartOpen(true)}
                  className="flex items-center gap-2.5 rounded-full bg-bw-green px-3.25 py-1.75 font-archivo text-sm font-semibold text-white transition hover:bg-bw-green-hover"
                >
                  <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                    <img
                      src={cartOutlineIcon}
                      alt=""
                      className="h-5 w-5 invert"
                    />
                    <span
                      className={cn(
                        'absolute -top-1.75 -right-1.75 inline-flex h-3.75 min-w-3.75 items-center justify-center rounded-full bg-bw-yellow px-0.75 text-[10px] leading-none font-bold text-bw-yellow-ink ring-2 ring-bw-green',
                        pulse && 'animate-[bw-pop_.42s_ease]',
                      )}
                    >
                      {count}
                    </span>
                  </span>
                  <span className="leading-none">Basket</span>
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
              className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10 active:bg-white/15"
            >
              <img
                src={menuIcon}
                alt=""
                className="h-6.5 w-6.5 invert"
              />
            </button>

            {isMenuOpen && (
              <div className="absolute top-12 right-0 w-52 border border-bw-line bg-bw-surface p-2 text-bw-ink">
                <Link
                  to="/browse"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-bw-ink hover:bg-bw-panel"
                >
                  <MdOutlineGridView className="h-5 w-5" />
                  Browse
                </Link>

                <Link
                  to="/lists"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-bw-ink hover:bg-bw-panel"
                >
                  <MdOutlineListAlt className="h-5 w-5" />
                  Lists
                </Link>

                <Link
                  to="/signin"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-bw-ink hover:bg-bw-panel"
                >
                  <MdOutlinePerson className="h-5 w-5" />
                  Account
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    setIsCartOpen(true)
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-bw-ink hover:bg-bw-panel"
                >
                  <img
                    src={cartOutlineIcon}
                    alt=""
                    className="h-5 w-5"
                  />
                  Cart ({count})
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
