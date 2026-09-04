import { useState } from 'react'
import { MdKeyboardArrowDown } from 'react-icons/md'

const faqs = [
  {
    question: 'What is BasketWise?',
    answer:
      'BasketWise helps you build a grocery list, compare the same basket across retailers and choose the cheapest option that still fits your day.',
  },
  {
    question: 'How does BasketWise find the cheapest practical option?',
    answer:
      'We compare your basket as a whole, rather than chasing individual specials. You see a clear single-store option first, then a split-shop option only when the extra saving may be worth the time.',
  },
  {
    question: 'Do I need to visit more than one store?',
    answer:
      'No. We always show a one-store total. If another retailer could save you meaningfully more, we make the trade-off clear so you can decide whether it is worthwhile.',
  },
  {
    question: 'Where does the price information come from?',
    answer:
      'BasketWise compares price information from the retailers it covers and shows each store’s price alongside your items. Prices can change, so it is always worth confirming before you shop.',
  },
  {
    question: 'Do I need an account?',
    answer:
      'No. You can browse, build a basket and compare prices as a guest. Create an account only when you want to save a list and return to it later.',
  },
  {
    question: 'Is BasketWise free to use?',
    answer:
      'Yes. Browsing groceries, building a basket and comparing your options are free.',
  },
]

export default function FaqSection() {
  const [openQuestion, setOpenQuestion] = useState<number | null>(null)

  return (
    <section id="faq" className="mx-auto w-full max-w-[820px] py-15">
      <h2 className="mb-2 text-center text-3xl font-bold tracking-[-0.03em] text-bw-ink">
        FAQS
      </h2>

      <p className="mb-10 text-center text-[14px] text-bw-subtle">
        Our goal is a less expensive, less confusing weekly shop.
      </p>

      <div className="border-t border-bw-green">
        {faqs.map((faq, index) => {
          const isOpen = openQuestion === index
          const answerId = `faq-answer-${index}`

          return (
            <article key={faq.question} className="border-b border-bw-green">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={answerId}
                onClick={() =>
                  setOpenQuestion((currentQuestion) =>
                    currentQuestion === index ? null : index,
                  )
                }
                className="flex w-full items-center justify-between gap-6 px-1 py-6 text-left sm:py-7"
              >
                <span className="text-[17px] leading-[1.15] font-semibold tracking-[-0.015em] text-bw-ink sm:text-[19px]">
                  {faq.question}
                </span>

                <MdKeyboardArrowDown
                  aria-hidden="true"
                  className={`size-9 shrink-0 text-bw-green transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <div
                id={answerId}
                className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out ${
                  isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="overflow-hidden">
                  <p className="max-w-[68ch] px-1 pb-6 pr-10 text-[15px] leading-relaxed text-bw-muted sm:pb-7">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}