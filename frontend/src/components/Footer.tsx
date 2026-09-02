import { Link } from 'react-router'

const SHOP_LINKS = [
  { to: '/#essentials', label: 'Essentials' },
  { to: '/#browse', label: 'All categories' },
  { to: '/#meals', label: 'Meal baskets' },
]

const COMPANY_LINKS = [
  { to: '/#', label: 'How we price' },
  { to: '/#', label: 'Data sources' },
  { to: '/#faq', label: 'Help centre' },
]

const LEGAL_LINKS = [
  { to: '/#', label: 'Privacy' },
  { to: '/#', label: 'Terms' },
]

function FooterColumn({ heading, links }) {
  return (
    <div className="flex flex-col gap-2.25 text-sm">
      <span className="font-archivo text-[11px] tracking-[.14em] text-bw-muted uppercase">
        {heading}
      </span>

      {links.map((link) => (
        <Link key={link.label} to={link.to} className="text-bw-on-dark">
          {link.label}
        </Link>
      ))}
    </div>
  )
}

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-20 w-full bg-bw-ink-inverse-bg px-6 pt-13 pb-7.5 text-bw-on-dark lg:px-10">
      <div className="mx-auto grid max-w-[1160px] grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <p className="mb-2.5 font-newsreader text-2xl text-bw-panel">
            BasketWise
          </p>
          <p className="max-w-[34ch] text-[13px] leading-relaxed">
            Independent grocery price tracking across Australia. We don&rsquo;t
            take a cut from any retailer.
          </p>
        </div>

        <FooterColumn heading="Shop" links={SHOP_LINKS} />
        <FooterColumn heading="Company" links={COMPANY_LINKS} />
        <FooterColumn heading="Legal" links={LEGAL_LINKS} />
      </div>

      <div className="mx-auto mt-9 max-w-[1160px] border-t border-white/10 pt-4.5 text-[11.5px] text-bw-muted">
        © {currentYear} BasketWise Pty Ltd · Prices indicative and subject to
        change in store.
      </div>
    </footer>
  )
}
