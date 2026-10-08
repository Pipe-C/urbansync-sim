import { useRef, type KeyboardEvent } from 'react'

/**
 * Keyboard semantics for a `role="radiogroup"` of buttons, per the WAI-ARIA
 * radio group pattern: one tab stop (roving tabindex), arrow keys move and
 * select, Home/End jump to the ends.
 *
 * Two controls in this app are segmented radio groups built from buttons —
 * the dashboard's mode toggle and the configuration form's default policy —
 * and both were only half-implemented: focusable, activatable, but with no
 * arrow keys and two tab stops. This hook is the missing half; it deliberately
 * owns no state, so the callers keep their existing value/change wiring
 * (Zustand's setter in one, react-hook-form's `field.onChange` in the other).
 */

export interface RovingRadioItemProps {
  /** Exactly one item in the group returns 0; the rest return -1. */
  tabIndex: number
  ref: (node: HTMLButtonElement | null) => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}

export function useRovingRadioGroup<T extends string>(
  options: readonly T[],
  value: T,
  onChange: (value: T) => void,
) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const focusValue = (next: T) => {
    const nextIndex = options.indexOf(next)
    onChange(next)
    if (nextIndex >= 0) {
      itemRefs.current[nextIndex]?.focus()
    }
  }

  const onKeyDown =
    (index: number) =>
    (event: KeyboardEvent<HTMLButtonElement>): void => {
      const lastIndex = options.length - 1
      let next: T | undefined

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          next = options[Math.min(index + 1, lastIndex)]
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          next = options[Math.max(index - 1, 0)]
          break
        case 'Home':
          next = options[0]
          break
        case 'End':
          next = options[lastIndex]
          break
        default:
          return
      }

      event.preventDefault()
      if (next !== undefined && next !== value) {
        focusValue(next)
      }
    }

  const getRadioProps = (index: number): RovingRadioItemProps => ({
    tabIndex: options[index] === value ? 0 : -1,
    ref: (node) => {
      itemRefs.current[index] = node
    },
    onKeyDown: onKeyDown(index),
  })

  return { getRadioProps }
}
