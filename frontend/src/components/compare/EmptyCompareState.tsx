import { Link } from 'react-router'

export default function EmptyCompareState() {
  return (
    <div className="flex flex-col items-center px-6 py-24 text-center lg:px-8 xl:px-12 2xl:px-16">
      <h1 className="text-[28px] text-bw-ink">Your basket is empty</h1>
      <p className="mt-2 max-w-[44ch] text-[13px] leading-relaxed text-bw-body">
        Add a few products from Browse and come back here to see the cheapest
        way to buy them.
      </p>
      <Link
        to="/browse"
        className="mt-6 rounded-full bg-bw-green px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-bw-green-hover"
      >
        Browse products
      </Link>
    </div>
  )
}
