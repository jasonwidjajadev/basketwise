import { faqs } from '@/components/home/faqs'
import FaqRow from '@/components/home/FaqRow'

export default function FaqSection() {
  return (
    <section id="faq" className="mx-auto max-w-[820px] px-6 pt-19 lg:px-10">
      <h2 className="mb-1.5 text-center text-[36px] font-normal tracking-[-.02em] text-bw-ink sm:text-[44px]">
        FAQ
      </h2>
      <p className="mb-8 text-center text-[13px] text-bw-subtle">
        Everything about prices, receipts and stores.
      </p>

      <div className="border-t border-bw-line">
        {faqs.map((faq) => (
          <FaqRow
            key={faq.question}
            question={faq.question}
            answer={faq.answer}
          />
        ))}
      </div>
    </section>
  )
}
