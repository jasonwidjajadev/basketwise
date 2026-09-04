import { useState } from 'react'
import { Link } from 'react-router'

import icon from '@/assets/basketwise_logo/logo.svg'
import CartSidebar from '@/components/checkout/CartSidebar'
import HeaderActions from '@/components/header/HeaderActions'
import SearchBar from '@/components/header/SearchBar'
import { useSignInModal } from '@/context/SignInModalContext'

export default function Header() {
  const [isCartOpen, setIsCartOpen] = useState(false)
  const { openSignIn } = useSignInModal()

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#171715] text-white">
        <div className="grid h-[60px] w-full grid-cols-3 items-center gap-6 px-6 lg:px-8 xl:px-12 2xl:px-16">
          {/* LHS */}
          <div className="justify-self-start">
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
              <p className="text-center text-2xl font-bold leading-none tracking-[0.05em] text-[#f4f2ea]">
                BASKETWISE
              </p>
              {/* <span className="whitespace-nowrap  text-2xl font-medium tracking-[-0.025em] text-white">
                BASKETWISE
              </span> */}
            </Link>
          </div>

          {/* Search */}
          <div className="w-[120%] max-w-2xl justify-self-center">
            <SearchBar />
          </div>

          {/* RHS */}
          <div className="justify-self-end">
            <HeaderActions
              onOpenCart={() => setIsCartOpen(true)}
              onOpenSignIn={openSignIn}
            />
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
