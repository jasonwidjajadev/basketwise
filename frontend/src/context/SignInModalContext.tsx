import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
  } from 'react'
  
  import SignInModal from '@/pages/SignInPage'
  
  type SignInModalContextValue = {
    openSignIn: () => void
    closeSignIn: () => void
  }
  
  const SignInModalContext =
    createContext<SignInModalContextValue | null>(null)
  
  export function SignInModalProvider({
    children,
  }: {
    children: ReactNode
  }) {
    const [isSignInOpen, setIsSignInOpen] = useState(false)
  
    const openSignIn = useCallback(() => setIsSignInOpen(true), [])
    const closeSignIn = useCallback(() => setIsSignInOpen(false), [])
  
    const value = useMemo(
      () => ({ openSignIn, closeSignIn }),
      [openSignIn, closeSignIn],
    )
  
    return (
      <SignInModalContext.Provider value={value}>
        {children}
  
        <SignInModal
          isOpen={isSignInOpen}
          onClose={closeSignIn}
        />
      </SignInModalContext.Provider>
    )
  }
  
  export function useSignInModal() {
    const context = useContext(SignInModalContext)
  
    if (!context) {
      throw new Error(
        'useSignInModal must be used within a SignInModalProvider',
      )
    }
  
    return context
  }