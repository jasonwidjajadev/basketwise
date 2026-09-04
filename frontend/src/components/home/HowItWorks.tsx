const STEPS = [
  {
    number: '01',
    title: 'Upload your receipt',
    body: "Start with what you already buy. Take a photo of last week's receipt and upload it to BasketWise.",
  },
  {
    number: '02',
    title: 'We compare the prices',
    body: 'We compare prices across nearby Coles, Woolworths, ALDI and Harris Farm stores.',
  },
  {
    number: '03',
    title: 'Build your cheapest basket',
    body: 'Choose the cheapest practical option for your groceries, whether that is one store or a split shop.',
  },
]

export default function HowItWorks() {
  return (
    <section className="w-full pb-15">
      <h2 className="mb-5.5 text-base font-bold tracking-[0.2em] text-bw-ink uppercase">
        HOW IT WORKS
      </h2>

      <div className="grid grid-cols-1 gap-px border border-bw-line bg-bw-line sm:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.number} className="bg-bw-page px-6 py-5.5">
            <span
              className="text-[30px] leading-none text-bw-line-strong"
              style={{ fontFamily: '"EB Garamond", Georgia, serif' }}
            >
              {step.number}
            </span>

            <p className="mt-2 mb-0.5 text-[15px] font-semibold text-bw-ink">
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