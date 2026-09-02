import { useNavigate } from 'react-router'

import searchIcon from '@/assets/icons/search.svg'

export default function SearchBar() {
  const navigate = useNavigate()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q')?.toString().trim()
    if (q) navigate(`/browse?q=${encodeURIComponent(q)}`)
  }

  return (
    <form role="search" className="w-full min-w-0" onSubmit={handleSubmit}>
      <label htmlFor="header-search" className="sr-only">
        Search groceries
      </label>

      <div className="relative">
        <img
          src={searchIcon}
          alt=""
          className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2"
        />

        <input
          id="header-search"
          name="q"
          type="search"
          placeholder="Search groceries..."
          className="w-full min-w-0 rounded-full border border-transparent bg-white/10 py-2.5 pr-4 pl-12 text-sm text-bw-panel outline-none transition placeholder:text-bw-on-dark focus:border-bw-yellow focus:bg-white/15 focus:ring-2 focus:ring-bw-yellow/20"
        />
      </div>
    </form>
  )
}
