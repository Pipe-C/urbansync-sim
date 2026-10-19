import type { CSSProperties, ReactNode } from 'react'

import { useInView } from '@/hooks/useInView'

export type RevealVariant = 'rise' | 'slide' | 'focus'

export interface RevealProps {
  children: ReactNode
  /** The material of the entrance. Each section differs on purpose. */
  variant?: RevealVariant
  /** Stagger inside a group, in milliseconds. */
  delayMs?: number
  className?: string
}

/**
 * A block that arrives when the viewer reaches it.
 *
 * Three variants rather than one. The craft floor's objection to the scroll
 * reveal is not to the idea but to the reflex of stamping the same
 * translate-and-fade onto every section, which reads as a template rather than
 * a composition. So the mechanism list slides in from the side it belongs to,
 * the comparison comes into focus from a blur, and the headings rise. The hidden
 * state lives in CSS under `prefers-reduced-motion: no-preference`, so a visitor
 * who has asked for less motion sees the page already composed instead of a set
 * of blocks waiting on an observer.
 *
 * The variants deliberately stay on `opacity`, `transform` and `filter`. An
 * earlier `wipe` variant used `clip-path`, and it never revealed: Chrome treats
 * a `clip-path` as a clip for `IntersectionObserver`, so the element the observer
 * was watching was clipped to zero width and could never intersect — hidden
 * forever, by the animation that was meant to show it. `filter` has no such
 * interaction and is the honest material for "comes into focus".
 */
export function Reveal({ children, variant = 'rise', delayMs = 0, className }: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>({ once: true })

  return (
    <div
      ref={ref}
      data-reveal={variant}
      data-visible={inView ? '' : undefined}
      className={className}
      style={{ '--reveal-delay': `${delayMs}ms` } as CSSProperties}
    >
      {children}
    </div>
  )
}
