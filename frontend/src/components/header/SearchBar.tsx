import searchIcon from '@/assets/icons/search.svg'

export default function SearchBar() {
  return (
    <form role="search" className="w-full min-w-0">
      <label htmlFor="header-search" className="sr-only">
        Search groceries
      </label>

      <div className="relative w-full min-w-0">
        <img
          src={searchIcon}
          alt=""
          className="pointer-events-none absolute top-1/2 left-3 
          h-4 w-4 -translate-y-1/2 invert opacity-60"
        />

        <input
          id="header-search"
          type="search"
          placeholder="Search groceries..."
          className="h-9 w-full min-w-0 rounded-full border-0 
          bg-white/10 pr-3 pl-9 text-xs text-white outline-none 
          transition-colors placeholder:text-white/45 hover:bg-white/12 focus:bg-white/15"
        />
      </div>
    </form>
  )
}