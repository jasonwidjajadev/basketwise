const STEPS = [
  {
    number: '01',
    title: 'Upload your receipt',
    body: "Take a photo of last week's receipt and upload it to BaskWise.",
  },
  {
    number: '02',
    title: 'We compare the prices',
    body: 'Scans all nearby Coles, Woolworths, ALDI and IGA stores to compare prices directy.',
  },
  {
    number: '03',
    title: 'Build your cheapest basket',
    body: 'BasketWise lets you choose the cheapest practical option for your groceries - one store or split.',
  },
]

export default function HowItWorks() {
  return (
    <section className="w-full pt-11">
      <p className="mb-5.5 text-[11.5px] tracking-[.18em] text-bw-subtle uppercase">
        How BasketWise works
      </p>

      <div className="grid grid-cols-1 gap-px border border-bw-line bg-bw-line sm:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.number} className="bg-bw-page px-6 py-5.5">
            <span className="text-[26px] text-bw-line-strong">
              {step.number}
            </span>

            <p className="mt-1.5 mb-0.5 text-[15px] font-semibold text-bw-ink">
              {step.title}
            </p>

            <p className="text-[13px] leading-normal text-bw-muted">
              {step.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}