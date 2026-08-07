import { Link } from 'react-router'

type CartSidebarProps = {
  isOpen: boolean
  onClose: () => void
}

export default function CartSidebar({
  isOpen,
  onClose,
}: CartSidebarProps) {
  return (
    <div
      className={`fixed inset-0 z-50 ${
        isOpen
          ? 'pointer-events-auto visible'
          : 'pointer-events-none invisible'
      }`}
    >
      <button
        type="button"
        aria-label="Close cart"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <aside
        className={`absolute top-0 right-0 flex h-full w-full max-w-md flex-col bg-white transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 p-6">
          <h2 className="text-xl font-semibold">
            Your basket
          </h2>

          <button
            type="button"
            aria-label="Close cart"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 active:bg-zinc-200"
          >
            ×
          </button>
        </div>

        <div className="flex-1" />

        <div className="border-t border-zinc-200 p-6">
          <Link
            to="/compare"
            onClick={onClose}
            className="flex w-full justify-center rounded-full bg-basket-green px-5 py-3 text-sm font-semibold text-white"
          >
            Compare basket
          </Link>
        </div>
      </aside>
    </div>
  )
}