import { Link } from 'react-router'

export default function Hero() {
  return (
    <section className="mx-auto grid max-w-[1160px] grid-cols-1 items-stretch gap-7 px-6 pt-11 pb-16 lg:grid-cols-[1.05fr_.95fr] lg:px-10">
      <div
        className="relative flex min-h-[420px] items-center justify-center border border-bw-line"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg,#EFEDE4 0 10px,#E9E7DC 10px 20px)',
        }}
      >
        <span className="px-6 text-center font-mono text-[11px] tracking-[.1em] text-bw-subtle uppercase">
          Hero photo — produce &amp; bread still life
        </span>

        <div className="absolute inset-x-0 bottom-0 border-t border-bw-line bg-bw-page/94 px-4 py-3">
          <p className="text-[12.5px] font-bold text-bw-ink">
            Fresh every week
          </p>
          <p className="mt-0.5 text-xs leading-snug text-bw-muted">
            We track over 40,000 products across the big four, so you always
            know where the good stuff is cheapest.
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-center border border-bw-line bg-bw-panel px-8 py-10 sm:px-13 sm:py-14">
        <p className="mb-5 font-archivo text-[10.5px] tracking-[.22em] text-bw-subtle uppercase">
          Australia&rsquo;s grocery price companion
        </p>

        <h1 className="font-newsreader text-[40px] leading-[1.06] font-normal tracking-[-.02em] text-bw-ink sm:text-[52px]">
          Shop <em className="font-bold italic">smarter</em>, spend{' '}
          <em className="font-bold italic">less</em>, on every{' '}
          <em className="font-bold italic">weekly</em> shop.
        </h1>

        <p className="mt-5.5 mb-7.5 max-w-[44ch] text-[14.5px] leading-relaxed text-bw-body">
          BasketWise compares live prices across Coles, Woolworths, ALDI and
          IGA, reads your receipts and turns the meals you love into a ready to
          go basket.
        </p>

        <div className="flex flex-wrap items-center gap-3.5">
          <Link
            to="/#essentials"
            className="rounded-sm bg-bw-green px-5 py-3.5 font-archivo text-[13.5px] font-semibold text-white transition-colors hover:bg-bw-green-hover"
          >
            Scan a receipt
          </Link>

          <span className="font-archivo text-[11px] font-semibold tracking-[.14em] text-bw-subtle uppercase">
            Or
          </span>

          <div className="flex flex-wrap gap-2.5">
            <Link
              to="/#start"
              className="rounded-sm border border-bw-green px-5 py-3.5 font-archivo text-[13.5px] font-semibold text-bw-green transition-colors hover:bg-bw-green hover:text-white"
            >
              Look for groceries
            </Link>

            <Link
              to="/#start"
              className="rounded-sm border border-bw-green px-5 py-3.5 font-archivo text-[13.5px] font-semibold text-bw-green transition-colors hover:bg-bw-green hover:text-white"
            >
              Get Meal Plans
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
