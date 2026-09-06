import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/**
 * Client-side navigation keeps the window's scroll position, so following a
 * link from halfway down Browse used to drop you halfway down the next page.
 * Renders nothing -- mount it once inside the router.
 *
 * Back/forward is left alone: the browser restores the position the user left,
 * and forcing them to the top would undo that.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (navigationType === 'POP') return

    // `/#essentials` and friends: react-router doesn't jump to the anchor on a
    // client-side navigation, so do it here rather than scrolling past it.
    const targetId = hash.slice(1)
    if (targetId) {
      const target = document.getElementById(targetId)
      if (target) {
        target.scrollIntoView({ block: 'start' })
        return
      }
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, hash, navigationType])

  return null
}
