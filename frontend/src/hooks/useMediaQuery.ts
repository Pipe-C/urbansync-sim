import { useEffect, useState } from 'react'

/**
 * A CSS media query as live React state.
 *
 * The sidebar is a static column on desktop and an overlay drawer below the
 * layout breakpoint. CSS can move it off-canvas, but focus and the accessibility
 * tree do not follow a transform — a closed drawer would still be a run of tab
 * stops on invisible links. This hook is the structural half: it tells the
 * component which of the two things the sidebar currently is.
 *
 * The initial read is guarded for a non-browser environment, following the same
 * contract as `usePrefersReducedMotion`.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)

    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [query])

  return matches
}
