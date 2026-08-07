export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-zinc-200">
      <div className="mx-auto flex w-full max-w-360 flex-col gap-2 px-6 py-6 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between lg:px-8 xl:px-10">
        <p>© {currentYear} BasketWise</p>
        <p>Smarter grocery runs.</p>
      </div>
    </footer>
  )
}