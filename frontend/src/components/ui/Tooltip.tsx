import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'

import { cn } from '@/utils/cn'

export type TooltipSide = 'top' | 'bottom'
export type TooltipAlign = 'center' | 'end'

export interface TooltipProps {
  content: ReactNode
  /** Must be a single focusable element — the tooltip is driven by its focus. */
  children: ReactElement
  side?: TooltipSide
  /** `end` pins the tooltip to the trigger's right edge, keeping a right-edge
   *  trigger from pushing the text (and the document) past the viewport. */
  align?: TooltipAlign
}

/**
 * CSS-only tooltip.
 *
 * Visibility is driven by `group-focus-within` as well as `group-hover`, so the
 * content is reachable by keyboard and not just by pointer. This is a
 * lightweight affordance, not a popover system: it cannot be opened on tap, so
 * anything essential must also be stated in the element's own label.
 */
export function Tooltip({ content, children, side = 'top', align = 'center' }: TooltipProps) {
  const tooltipId = useId()

  return (
    <span className="group relative inline-flex">
      {cloneElement(children as ReactElement<Record<string, unknown>>, {
        'aria-describedby': tooltipId,
      })}
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 w-max max-w-64',
          align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2',
          'rounded-md border border-line bg-elevated px-3 py-2 text-xs leading-snug text-secondary',
          'opacity-0 shadow-popover transition-opacity duration-150 ease-signal',
          'group-focus-within:opacity-100 group-hover:opacity-100',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
        )}
      >
        {content}
      </span>
    </span>
  )
}
