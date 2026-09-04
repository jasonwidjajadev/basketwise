const faqs = [
  {
    question: 'Where do the prices come from',
    answer:
      'We collect published shelf prices from Coles, Woolworths, ALDI and IGA several times a day, then normalise them per unit so a 500g tub and a 1kg tub are genuinely comparable.',
  },
  {
    question: 'How accurate is receipt scanning',
    answer:
      'About 97% of line items match first pass. Anything ambiguous gets shown to you as a quick two-tap confirmation rather than being guessed at.',
  },
  {
    question: 'Do you get paid by supermarkets',
    answer:
      'No. BasketWise takes no retailer commissions or placement fees. If a cheaper option exists, you see it — including the one nobody pays us to show.',
  },
  {
    question: 'Can I split a basket across stores',
    answer:
      'Yes. Every basket shows a single-store total and a split total, with the driving detour and time cost so you can decide if the saving is worth it.',
  },
  {
    question: 'Which areas are covered',
    answer:
      'All metro areas plus roughly 400 regional postcodes. Enter your postcode and we only show stores you can actually reach.',
  },
]

export default function FaqSection() {
  return (
    <section
      id="faq"
      className="mx-auto w-full max-w-[820px] pt-19"
    >
      <h2 className="mb-1.5 text-center text-[36px] font-normal tracking-[-.02em] text-bw-ink sm:text-[44px]">
        FAQ
      </h2>

      <p className="mb-8 text-center text-[13px] text-bw-subtle">
        Everything about prices, receipts and stores.
      </p>

      <div className="border-t border-bw-line">
        {faqs.map((faq) => (
          <div
            key={faq.question}
            className="border-b border-bw-line px-1 py-5"
          >
            <span className="text-[12.5px] font-bold tracking-[.12em] text-bw-ink uppercase">
              {faq.question}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}