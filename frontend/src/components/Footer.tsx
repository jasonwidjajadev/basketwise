import { FaFacebookF, FaInstagram, FaTiktok } from 'react-icons/fa'
import { FiArrowRight } from 'react-icons/fi'
import { Link } from 'react-router'

type FooterLink = {
  label: string
  to?: string
  href?: string
}

const SHOP_LINKS: FooterLink[] = [
  { to: '/browse', label: 'Browse groceries' },
  { to: '/#essentials', label: 'Everyday essentials' },
  { to: '/#meals', label: 'Meal baskets' },
]

const COMPANY_LINKS: FooterLink[] = [
  { to: '/', label: 'About BasketWise' },
  { to: '/compare', label: 'Compare your basket' },
  { to: '/#faq', label: 'Help centre' },
]

const CONNECT_LINKS: FooterLink[] = [
  { to: '/#faq', label: 'FAQs' },
  { href: 'mailto:hello@basketwise.com', label: 'Contact us' },
  {
    href: 'mailto:hello@basketwise.com?subject=Suggest%20a%20retailer',
    label: 'Suggest a retailer',
  },
]

const SOCIAL_LINKS = [
  {
    href: 'https://www.instagram.com/basketwise',
    label: 'Instagram',
    icon: FaInstagram,
  },
  {
    href: 'https://www.tiktok.com/@basketwise',
    label: 'TikTok',
    icon: FaTiktok,
  },
  {
    href: 'https://www.facebook.com/basketwise',
    label: 'Facebook',
    icon: FaFacebookF,
  },
]

function FooterColumn({
  heading,
  links,
}: {
  heading: string
  links: FooterLink[]
}) {
  return (
    <div>
      <h2 className="text-2xl leading-none font-medium tracking-[-0.02em] text-[#f4f2ea] uppercase">
        {heading}
      </h2>

      <div className="mt-5 flex flex-col gap-3">
        {links.map((link) =>
          link.href ? (
            <a
              key={link.label}
              href={link.href}
              className="w-fit text-base leading-none text-white/65 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ) : (
            <Link
              key={link.label}
              to={link.to ?? '/'}
              className="w-fit text-base leading-none text-white/65 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ),
        )}
      </div>
    </div>
  )
}

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-20 w-full bg-neutral-900 text-[#f4f2ea]">
      <div className="px-6 py-14 sm:py-16 lg:px-8 xl:px-12 2xl:px-16">
        <div className="mx-auto w-full max-w-7xl">
        <p className="text-center text-2xl font-bold leading-none tracking-[0.1em] text-[#f4f2ea]">
          BASKETWISE
        </p>
          {/* <span className="whitespace-nowrap  text-2xl font-medium tracking-[-0.025em] text-white">
                BASKETWISE
              </span> */}
          <div className="mt-14 grid grid-cols-1 gap-y-12 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.55fr)] lg:gap-x-10">
            <FooterColumn heading="Shop" links={SHOP_LINKS} />

            <FooterColumn heading="Company" links={COMPANY_LINKS} />

            <FooterColumn heading="Connect" links={CONNECT_LINKS} />

            <div className="border-t border-white/25 pt-10 lg:border-t-0 lg:border-l lg:pl-10 lg:pt-0">
              <h2 className="text-2xl leading-none font-medium tracking-[-0.02em] text-[#f4f2ea] uppercase">
                Join the list
              </h2>

              <p className="mt-4 max-w-[29ch] text-base leading-relaxed text-white/65">
                Grocery savings, smarter shopping tips and BasketWise updates.
              </p>

              <form
                action="mailto:hello@basketwise.com?subject=Join%20the%20BasketWise%20list"
                method="post"
                encType="text/plain"
                className="mt-7 flex border border-white/45"
              >
                <span className="flex shrink-0 items-center border-r border-white/45 px-4 text-sm tracking-[0.08em] text-white/80 uppercase">
                  Join us
                </span>

                <label htmlFor="footer-email" className="sr-only">
                  Email address
                </label>

                <input
                  id="footer-email"
                  name="email"
                  type="email"
                  required
                  placeholder="EMAIL ADDRESS"
                  className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/35"
                />

                <button
                  type="submit"
                  aria-label="Join the BasketWise mailing list"
                  className="flex w-12 shrink-0 items-center justify-center text-xl text-white/70 transition-colors hover:bg-white hover:text-[#252522]"
                >
                  <FiArrowRight />
                </button>
              </form>

              <div className="mt-8">
                <p className="text-sm tracking-[0.08em] text-white/45 uppercase">
                  Follow along
                </p>

                <div className="mt-4 flex items-center gap-5">
                  {SOCIAL_LINKS.map((social) => {
                    const Icon = social.icon

                    return (
                      <a
                        key={social.label}
                        href={social.href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={social.label}
                        className="text-xl text-white/70 transition-colors hover:text-white"
                      >
                        <Icon aria-hidden="true" />
                      </a>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 flex flex-col gap-5 border-t border-white/15 pt-6 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {currentYear} BasketWise Pty Ltd. Prices are indicative and
              subject to change in store.
            </p>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link to="/#" className="transition-colors hover:text-white">
                Privacy
              </Link>

              <Link to="/#" className="transition-colors hover:text-white">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}