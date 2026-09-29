import { cn } from '@/utils/cn'

export type TrendDirection = 'up' | 'down' | 'flat'
/**
 * Whether a movement is good news, independently of which way it points.
 * Lower average wait time is an improvement and a downward arrow is not a
 * problem, so direction and sentiment are separate axes.
 */
export type TrendSentiment = 'positive' | 'negative' | 'neutral'

export interface StatTrend {
  direction: TrendDirection
  sentiment: TrendSentiment
}

export interface StatProps {
  label: string
  value: string | number
  unit?: string
  /** Secondary line under the value. Never carries the primary number. */
  hint?: string
  trend?: StatTrend
  className?: string
}

const SENTIMENT_CLASSES: Record<TrendSentiment, string> = {
  positive: 'text-flow',
  negative: 'text-congested',
  neutral: 'text-muted',
}

const ARROW_ROTATION: Record<TrendDirection, string> = {
  up: 'rotate-0',
  down: 'rotate-180',
  flat: 'rotate-90',
}

const SENTIMENT_LABEL: Record<TrendSentiment, string> = {
  positive: 'mejora',
  negative: 'empeora',
  neutral: 'sin cambio significativo',
}

function TrendArrow({ trend }: { trend: StatTrend }) {
  return (
    <span className={cn('inline-flex items-center gap-1', SENTIMENT_CLASSES[trend.sentiment])}>
      <svg
        viewBox="0 0 12 12"
        width="10"
        height="10"
        aria-hidden="true"
        className={cn('transition-transform', ARROW_ROTATION[trend.direction])}
      >
        <path d="M6 2l4 8H2z" fill="currentColor" />
      </svg>
      <span className="sr-only">
        {trend.direction === 'up' ? 'sube' : trend.direction === 'down' ? 'baja' : 'estable'}
        {`, ${SENTIMENT_LABEL[trend.sentiment]}`}
      </span>
    </span>
  )
}

/**
 * One measured value.
 *
 * The number is set in mono with tabular figures because the mono-means-measured
 * rule in DESIGN.md is what separates a live reading from a placeholder, and
 * because a value updating every 150ms would otherwise shift its own column.
 */
export function Stat({ label, value, unit, hint, trend, className }: StatProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="font-mono text-micro uppercase leading-none text-muted">{label}</span>

      <span className="flex items-baseline gap-1.5">
        <span className="tabular font-mono text-metric leading-none text-primary">{value}</span>
        {unit && <span className="font-mono text-xs text-muted">{unit}</span>}
        {trend && <TrendArrow trend={trend} />}
      </span>

      {hint && <span className="text-xs text-secondary">{hint}</span>}
    </div>
  )
}
