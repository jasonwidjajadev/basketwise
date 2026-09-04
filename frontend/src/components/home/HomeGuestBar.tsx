import { Link } from 'react-router'

export default function HomeGuestBar() {
  return (
    <section className="w-full bg-[#252522] text-white">
      <div className="flex h-[46px] items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.08em] text-white/65">
          <span>HI THERE</span>
          <span>GUEST</span>
        </div>

        <div className="hidden items-center gap-3 text-sm uppercase tracking-[0.07em] text-white/55 sm:flex">
          <span>COMPARE AS A GUEST. SIGN IN TO SAVE.</span>

          <Link
            to="/signin"
            className="text-white/70 underline underline-offset-2 transition-colors hover:text-white"
          >
            SIGN IN
          </Link>
        </div>

        <Link
          to="/signin"
          className="text-sm uppercase tracking-[0.07em] text-white/70 underline underline-offset-2 sm:hidden"
        >
          SIGN IN
        </Link>
      </div>
    </section>
  )
}