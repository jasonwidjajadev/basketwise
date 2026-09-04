import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  MdOutlineGridView,
  MdOutlineListAlt,
  MdOutlinePerson,
} from 'react-icons/md'

import cartOutlineIcon from '@/assets/icons/cart-outline.svg'
import menuIcon from '@/assets/icons/menu.svg'
import { useCart } from '@/context/useCart'
import { cn } from '@/lib/utils'

type HeaderActionsProps = {
  onOpenCart: () => void
}

export default function HeaderActions({
  onOpenCart,
}: HeaderActionsProps) {
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
    <div className="justify-self-end">
      {/* Desktop */}
      <nav
        aria-label="Main navigation"
        className="hidden text-sm lg:block"
      >
        <ul className="flex items-center gap-4 min-[1300px]:gap-6">
          <li>
            <Link
              to="/browse"
              aria-label="Browse"
              className="flex items-center gap-2 font-medium tracking-[0.04em] text-white/70 transition-colors hover:text-white"
            >
              <MdOutlineGridView className="h-5 w-5" />

              <span className="hidden min-[1300px]:inline">
                BROWSE
              </span>
            </Link>
          </li>

          <li>
            <Link
              to="/account"
              aria-label="My Lists"
              className="flex items-center gap-2 font-medium tracking-[0.04em] text-white/70 transition-colors hover:text-white"
            >
              <MdOutlineListAlt className="h-5 w-5" />

              <span className="hidden min-[1300px]:inline">
                MY LISTS
              </span>
            </Link>
          </li>

          <li>
            <Link
              to="/signin"
              aria-label="Sign in"
              className="flex items-center gap-2 font-medium tracking-[0.04em] text-white/70 transition-colors hover:text-white"
            >
              <MdOutlinePerson className="h-5 w-5" />

              <span className="hidden min-[1300px]:inline">
                SIGN IN
              </span>
            </Link>
          </li>

          <li>
            <button
              type="button"
              aria-label={`Open basket, ${count} items`}
              onClick={onOpenCart}
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
                    'absolute -top-0 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bw-yellow px-1 text-[9px] font-semibold leading-none text-bw-yellow-ink',
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

      {/* Mobile */}
      <div
        ref={menuRef}
        className="relative flex items-center gap-0 lg:hidden"
      >
        <button
          type="button"
          aria-label={`Open basket, ${count} items`}
          onClick={onOpenCart}
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
  )
}