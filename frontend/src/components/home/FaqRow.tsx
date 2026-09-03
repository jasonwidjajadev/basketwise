// `answer` is accepted but not yet rendered — the FAQ section is
// questions-only for now; wiring up a disclosure later shouldn't need
// this component's shape to change.
export default function FaqRow({ question }) {
  return (
    <div className="border-b border-bw-line px-1 py-5">
      <span className="text-[12.5px] font-bold tracking-[.12em] text-bw-ink uppercase">
        {question}
      </span>
    </div>
  )
}
