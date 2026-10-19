import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * The OS motion preference, as live React state.
 *
 * The landing has two authored sequences — the desk entrance and the comparison
 * sweep — and both have to be able to stand down without a reload if the visitor
 * changes the setting. CSS can answer the media query on its own for the
 * declarative half; this hook exists for the structural half, where the choice
 * is which component to mount at all: a live WebGL junction, or the static CSS
 * one that the reduced-motion contract already resolves to a readable frame.
 *
 * The initial read is guarded for a non-browser environment so the module can be
 * imported by anything that reaches it without a `window`.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    const query = window.matchMedia(QUERY)
    const onChange = (event: MediaQueryListEvent) => setPrefersReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return prefersReduced
}
