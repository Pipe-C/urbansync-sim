import { useEffect, useRef, useState, type RefObject } from 'react'

export interface UseInViewOptions {
  /** Grows the viewport the element is measured against. */
  rootMargin?: string
  /** Fraction of the element that must be visible to count. */
  threshold?: number
  /** Stop observing after the first intersection. For entrances. */
  once?: boolean
}

export interface UseInViewResult<T extends Element> {
  ref: RefObject<T | null>
  inView: boolean
}

/**
 * Whether an element is on screen, as state.
 *
 * The landing uses it for two jobs that look similar and are not. An entrance
 * wants `once: true`: the block reveals as it arrives and stays revealed, so a
 * scroll back up does not replay the page. A running loop wants `once: false`:
 * the comparison's playhead has to stop when its section leaves the viewport,
 * because a nonessential animation that keeps drawing off screen is exactly the
 * kind of debt the motion contract exists to prevent.
 */
export function useInView<T extends Element>({
  rootMargin = '0px 0px -10% 0px',
  threshold = 0.15,
  once = false,
}: UseInViewOptions = {}): UseInViewResult<T> {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (node === null) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry === undefined) {
          return
        }

        if (entry.isIntersecting) {
          setInView(true)
          if (once) {
            observer.disconnect()
          }
        } else if (!once) {
          setInView(false)
        }
      },
      { rootMargin, threshold },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [rootMargin, threshold, once])

  return { ref, inView }
}
