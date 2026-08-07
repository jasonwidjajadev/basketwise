import { Link } from 'react-router'

import mascot from '@/assets/mascots/mascot-paper-bag.svg'

export default function NotFoundPage() {
  return (
    <section className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-6 text-center">
      <img
        src={mascot}
        alt=""
        className="h-60 w-60 object-contain"
      />

      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950">
        404 Page not found
      </h1>

      <p className="mt-4 max-w-l text-zinc-600">
        The page you are looking for does not exist or may have been moved.
      </p>

      <Link
        to="/"
        className="mt-8 rounded-lg bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Return home
      </Link>
    </section>
  )
}