export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-zinc-200">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© {currentYear} BasketWise</p>

        <p>Smarter grocery runs.</p>
      </div>
    </footer>
  )
}