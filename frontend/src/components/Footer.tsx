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
      <span className="text-[11px] tracking-[.14em] text-bw-muted uppercase">
        {heading}
      </span>

      {links.map((link) => (
        <Link
          key={link.label}
          to={link.to}
          className="text-bw-on-dark"
        >
          {link.label}
        </Link>
      ))}
    </div>
  )
}

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-20 w-full bg-bw-ink-inverse-bg text-bw-on-dark">
      <div className="w-full px-6 pt-13 pb-7.5 lg:px-8 xl:px-12 2xl:px-16">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
            <div>
              <p className="mb-2.5 text-2xl text-bw-panel">
                BASKETWISE
              </p>

              <p className="max-w-[34ch] text-[13px] leading-relaxed">
                Independent grocery price tracking across Australia. We
                don&rsquo;t take a cut from any retailer.
              </p>
            </div>

            <FooterColumn
              heading="Shop"
              links={SHOP_LINKS}
            />

            <FooterColumn
              heading="Company"
              links={COMPANY_LINKS}
            />

            <FooterColumn
              heading="Legal"
              links={LEGAL_LINKS}
            />
          </div>

          <div className="mt-9 border-t border-white/10 pt-4.5 text-[11.5px] text-bw-muted">
            © {currentYear} BasketWise Pty Ltd · Prices indicative and
            subject to change in store.
          </div>
        </div>
      </div>
    </footer>
  )
}