import { Link } from 'react-router'

export default function CompareFooterActions({ signedIn, saved, onSave }) {
  return (
    <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
      <Link
        to="/browse"
        className="flex items-center justify-center rounded-full border border-bw-line-strong bg-transparent px-5 py-3 font-archivo text-sm font-semibold text-bw-ink transition-colors hover:bg-bw-panel"
      >
        Continue editing basket
      </Link>

      {signedIn ? (
        <button
          type="button"
          onClick={onSave}
          disabled={saved}
          className="flex items-center justify-center gap-1.5 rounded-full bg-bw-green px-5 py-3 font-archivo text-sm font-semibold text-white transition-all enabled:hover:bg-bw-green-hover disabled:cursor-default motion-safe:active:scale-[0.97]"
        >
          <span
            key={saved ? 'saved' : 'save'}
            className={saved ? 'motion-safe:animate-[bw-pop_360ms_ease]' : ''}
          >
            {saved ? 'Saved ✓' : 'Save list'}
          </span>
        </button>
      ) : (
        <Link
          to="/signin"
          className="flex items-center justify-center rounded-full bg-bw-green px-5 py-3 font-archivo text-sm font-semibold text-white transition-colors hover:bg-bw-green-hover"
        >
          Sign in to save list
        </Link>
      )}
    </div>
  )
}
