import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  MdOutlineGridView,
  MdOutlineListAlt,
  MdOutlinePerson,
} from 'react-icons/md'

import icon from '@/assets/basketwise_logo/logo.svg'
import cartOutlineIcon from '@/assets/icons/cart-outline.svg'
import menuIcon from '@/assets/icons/menu.svg'
import CartSidebar from '@/components/checkout/CartSidebar'
import SearchBar from '@/components/header/SearchBar'
import { useCart } from '@/context/useCart'
import { cn } from '@/lib/utils'

export default function Header() {
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const menuRef = useRef<HTMLDivElement | null>(null)
  const { count, pulse } = useCart()

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
      <header className="sticky top-0 z-40 w-full bg-[#171715] text-white">
        <div className="relative grid h-[60px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 sm:gap-5 sm:px-5 lg:gap-7 lg:px-10">
          {/* Brand */}
          <Link
            to="/"
            aria-label="BasketWise home"
            className="flex shrink-0 items-center gap-2.5"
          >
            <img
              src={icon}
              alt=""
              className="h-6 w-6 shrink-0 object-contain"
            />

            <span className="whitespace-nowrap text-xl font-semibold tracking-[-0.025em] text-white">
              BASKETWISE
            </span>
          </Link>

          {/* Search */}
          <div
            className="
              w-full min-w-0 max-w-xs justify-self-center
              md:max-w-md
              lg:max-w-lg
              xl:max-w-xl
              min-[1400px]:absolute
              min-[1400px]:left-1/2
              min-[1400px]:max-w-2xl
              min-[1400px]:-translate-x-1/2
            "
          >
            <SearchBar />
          </div>

          {/* Desktop navigation */}
          <nav
            aria-label="Main navigation"
            className="hidden shrink-0 justify-self-end text-sm lg:block"
          >
            <ul className="flex items-center gap-6">
              <li>
                <Link
                  to="/browse"
                  className="flex items-center gap-2 font-medium tracking-[0.04em] text-white/70 transition-colors hover:text-white"
                >
                  <MdOutlineGridView className="h-5 w-5" />
                  <span>BROWSE</span>
                </Link>
              </li>

              <li>
                <Link
                  to="/account"
                  className="flex items-center gap-2 font-medium tracking-[0.04em] text-white/70 transition-colors hover:text-white"
                >
                  <MdOutlineListAlt className="h-5 w-5" />
                  <span>MY LISTS</span>
                </Link>
              </li>

              <li>
                <Link
                  to="/signin"
                  className="flex items-center gap-2 font-medium tracking-[0.04em] text-white/70 transition-colors hover:text-white"
                >
                  <MdOutlinePerson className="h-5 w-5" />
                  <span>SIGN IN</span>
                </Link>
              </li>

              <li>
                <button
                  type="button"
                  aria-label={`Open basket, ${count} items`}
                  onClick={() => setIsCartOpen(true)}
                  className="relative flex h-8 w-8 items-center justify-center text-white/70 transition-colors hover:text-white"
                >
                  <img
                    src={cartOutlineIcon}
                    alt=""
                    className="h-[22px] w-[22px] invert opacity-80"
                  />

                  {count > 0 && (
                    <span
                      className={cn(
                        'absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bw-yellow px-1 text-[9px] font-semibold leading-none text-bw-yellow-ink',
                        pulse && 'animate-[bw-pop_.42s_ease]',
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              </li>
            </ul>
          </nav>

          {/* Mobile actions */}
          <div
            ref={menuRef}
            className="relative flex shrink-0 items-center justify-self-end gap-0 lg:hidden"
          >
            <button
              type="button"
              aria-label={`Open basket, ${count} items`}
              onClick={() => setIsCartOpen(true)}
              className="relative flex h-8 w-8 items-center justify-center text-white/75"
            >
              <img
                src={cartOutlineIcon}
                alt=""
                className="h-[20px] w-[20px] invert"
              />

              {count > 0 && (
                <span
                  className={cn(
                    'absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bw-yellow px-1 text-[9px] font-semibold leading-none text-bw-yellow-ink',
                    pulse && 'animate-[bw-pop_.42s_ease]',
                  )}
                >
                  {count}
                </span>
              )}
            </button>

            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((open) => !open)}
              className="flex h-8 w-8 items-center justify-center"
            >
              <img
                src={menuIcon}
                alt=""
                className="h-[20px] w-[20px] invert"
              />
            </button>

            {isMenuOpen && (
              <div className="absolute top-[46px] right-0 w-52 border border-bw-line bg-white p-2 text-bw-ink shadow-lg">
                <Link
                  to="/browse"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-xs font-medium tracking-[0.04em] hover:bg-bw-panel"
                >
                  <MdOutlineGridView className="h-5 w-5" />
                  BROWSE
                </Link>

                <Link
                  to="/account"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-xs font-medium tracking-[0.04em] hover:bg-bw-panel"
                >
                  <MdOutlineListAlt className="h-5 w-5" />
                  MY LISTS
                </Link>

                <Link
                  to="/signin"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-xs font-medium tracking-[0.04em] hover:bg-bw-panel"
                >
                  <MdOutlinePerson className="h-5 w-5" />
                  SIGN IN
                </Link>
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