import { useEffect, useId, useRef, useState } from 'react'
import { MdClose } from 'react-icons/md'

type SignInModalProps = {
  isOpen: boolean
  onClose: () => void
}

type AuthMode = 'create' | 'sign-in'

export default function SignInModal({
  isOpen,
  onClose,
}: SignInModalProps) {
  const [mode, setMode] = useState<AuthMode>('create')
  const emailInputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    emailInputRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  const isCreatingAccount = mode === 'create'
  const heading = isCreatingAccount ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'
  const supportingCopy = isCreatingAccount
    ? 'Save your lists and return to them whenever you shop.'
    : 'Sign in to access your saved grocery lists.'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 py-6"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-[34rem] rounded-sm bg-[#171715] px-7 pt-14 pb-10 text-white shadow-[0_24px_80px_rgba(0,0,0,0.42)] sm:px-12 sm:pt-16 sm:pb-12"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close sign in"
          onClick={onClose}
          className="absolute top-5 right-5 inline-flex h-10 w-10 items-center justify-center text-white/75 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <MdClose className="h-7 w-7" />
        </button>

        <p className="mb-4 text-xs font-semibold tracking-[0.14em] text-white/55">
          BASKETWISE
        </p>

        <h2
          id={titleId}
          className="max-w-sm text-3xl leading-[1.12] font-semibold tracking-[-0.035em] sm:text-[2.1rem]"
        >
          {heading}
        </h2>

        <p
          id={descriptionId}
          className="mt-4 max-w-sm text-sm leading-6 text-white/65"
        >
          {supportingCopy}
        </p>

        <form
          className="mt-9"
          onSubmit={(event) => event.preventDefault()}
        >
          <label
            htmlFor="sign-in-email"
            className="mb-2 block text-xs font-medium tracking-[0.04em] text-white/75"
          >
            EMAIL ADDRESS
          </label>

          <input
            ref={emailInputRef}
            id="sign-in-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            className="h-14 w-full rounded-sm border border-white/10 bg-white/[0.08] px-4 text-base text-white outline-none placeholder:text-white/35 focus:border-[#8A9B73] focus:ring-1 focus:ring-[#8A9B73]"
          />

          <button
            type="submit"
            className="mt-4 flex h-14 w-full items-center justify-center rounded-sm bg-[#7A8B63] px-5 text-sm font-semibold tracking-[0.08em] text-white transition-colors hover:bg-[#687954] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            CONTINUE
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-white/60">
          {isCreatingAccount
            ? 'Already have an account?'
            : 'New to BasketWise?'}{' '}
          <button
            type="button"
            onClick={() =>
              setMode(isCreatingAccount ? 'sign-in' : 'create')
            }
            className="font-medium text-white underline decoration-white/55 underline-offset-4 transition-colors hover:text-[#BECBAE]"
          >
            {isCreatingAccount ? 'SIGN IN' : 'CREATE AN ACCOUNT'}
          </button>
        </p>
      </section>
    </div>
  )
}