import { MdErrorOutline } from 'react-icons/md'

export default function UnavailableBanner({ children }) {
  return (
    <div className="flex items-start gap-2.5 border border-bw-red bg-bw-surface px-4 py-3 text-[12px] leading-relaxed text-bw-body">
      <MdErrorOutline className="mt-0.5 h-4 w-4 shrink-0 text-bw-red" />
      <span>{children}</span>
    </div>
  )
}
