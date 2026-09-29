import { cn } from '@/utils/cn'

export type BadgeTone = 'flow' | 'warning' | 'congested' | 'emergency' | 'neutral'

/**
 * Tone colours are duplicated rather than derived so that a tone can never
 * silently inherit a different role if a palette token is renamed.
 */
const DOT_CLASSES: Record<BadgeTone, string> = {
  flow: 'bg-flow',
  warning: 'bg-warning',
  congested: 'bg-congested',
  emergency: 'bg-emergency',
  neutral: 'bg-muted',
}

const TEXT_CLASSES: Record<BadgeTone, string> = {
  flow: 'text-flow',
  warning: 'text-warning',
  congested: 'text-congested',
  emergency: 'text-emergency',
  neutral: 'text-muted',
}

export interface BadgeProps extends React.ComponentProps<'span'> {
  tone?: BadgeTone
  /** The status dot. Default on; turning it off still leaves the text label. */
  dot?: boolean
}

/**
 * A traffic state, always named in words.
 *
 * Red against green is the most common colour-only encoding failure in this
 * product, and a user who cannot tell the two apart cannot read the metrics
 * panel at all. So the text is not optional decoration on top of the dot — it
 * is the accessible half of the same signal.
 */
export function Badge({ tone = 'neutral', dot = true, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm bg-elevated px-2 py-1',
        'font-mono text-micro uppercase leading-none',
        TEXT_CLASSES[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASSES[tone])} />}
      {children}
    </span>
  )
}
