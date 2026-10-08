/**
 * The meter faces on the landing desk.
 *
 * Each dial is one claim, drawn as an instrument rather than written as a
 * sentence: an inked scale, a needle parked at rest and a single sweep on
 * arrival. The needle is authored for the entrance only — it eases once, from
 * where the instrument would read on a fixed controller to where it reads under
 * the adaptive one — so the eye is told which reading is the point.
 *
 * No number is printed on the face on purpose. The landing demonstrates the
 * mechanism; the measurements live in the dashboard, where they are computed
 * from a running session rather than typed into the marketing page. A dial with
 * a label, a scale and a needle can carry a claim honestly; the same dial with a
 * fabricated figure beside it would not.
 *
 * Geometry only in the SVG; colour comes from Tailwind classes, so the palette
 * stays in `tailwind-palette.js`. The one authored motion lives in the
 * stylesheet so it can rest at its final angle, which is what keeps the dial
 * legible under `prefers-reduced-motion`.
 */

import type { CSSProperties } from 'react'

import { cn } from '@/utils/cn'

import './InstrumentDial.css'

/** Degrees swept by the scale, and the angle the scale starts at (clockwise from up). */
const SWEEP = 240
const START = -120
/** Pivot of the needle, in viewBox units. */
const PIVOT_X = 50
const PIVOT_Y = 62
/** Scale radius and needle length, so the tip stops just short of the ticks. */
const RADIUS = 40
const NEEDLE = 38
/** Even tick count gives a major mark at each end and in the middle. */
const TICK_COUNT = 9

export interface InstrumentBand {
  /** Fraction along the scale where the tinted band begins. */
  from: number
  tone: 'accent' | 'emergency'
}

export interface InstrumentDialProps {
  /** Name of the instrument, rendered in mono above the face. */
  label: string
  /** Where the needle comes to rest, as a fraction of the scale. */
  reading: number
  /** Where the needle starts, for the single entrance sweep. */
  rest?: number
  /** Label for the low end of the scale. */
  from: string
  /** Label for the high end of the scale. */
  to: string
  /** Tinted arc marking the reading the dial argues for. */
  band?: InstrumentBand
  /** One line explaining what the instrument measures. */
  note: string
  className?: string
}

function angleAt(fraction: number): number {
  return START + SWEEP * Math.min(1, Math.max(0, fraction))
}

function point(angle: number, radius: number): [number, number] {
  const radians = (angle * Math.PI) / 180
  return [PIVOT_X + radius * Math.sin(radians), PIVOT_Y - radius * Math.cos(radians)]
}

function arcPath(from: number, to: number, radius: number): string {
  const [x0, y0] = point(from, radius)
  const [x1, y1] = point(to, radius)
  const largeArc = Math.abs(to - from) > 180 ? 1 : 0
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

const TICKS = Array.from({ length: TICK_COUNT }, (_, index) => index)
const NEEDLE_PATH = `M ${PIVOT_X - 1.7} ${PIVOT_Y} L ${PIVOT_X} ${PIVOT_Y - NEEDLE} L ${PIVOT_X + 1.7} ${PIVOT_Y} Z`

export function InstrumentDial({
  label,
  reading,
  rest = 0,
  from,
  to,
  band,
  note,
  className,
}: InstrumentDialProps) {
  return (
    <figure className={cn('rounded-lg border border-line bg-surface p-4', className)}>
      <figcaption className="font-mono text-micro uppercase text-muted">{label}</figcaption>

      <svg
        viewBox="0 0 100 86"
        className="mt-3 w-full"
        role="img"
        aria-label={`${label}. ${from} a ${to}. ${note}`}
      >
        <path
          d={arcPath(START, START + SWEEP, RADIUS)}
          className="fill-none stroke-line"
          strokeWidth="1.5"
        />

        {band && (
          <path
            d={arcPath(angleAt(band.from), START + SWEEP, RADIUS - 7)}
            className={cn(
              'fill-none',
              band.tone === 'accent' ? 'stroke-accent' : 'stroke-emergency',
            )}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}

        {TICKS.map((tick) => {
          const angle = START + (SWEEP * tick) / (TICK_COUNT - 1)
          const major = tick % 2 === 0
          const [x1, y1] = point(angle, major ? RADIUS - 7 : RADIUS - 4)
          const [x2, y2] = point(angle, RADIUS + 0.5)
          return (
            <line
              key={tick}
              x1={x1.toFixed(2)}
              y1={y1.toFixed(2)}
              x2={x2.toFixed(2)}
              y2={y2.toFixed(2)}
              className="stroke-line"
              strokeWidth={major ? 1.4 : 0.9}
            />
          )
        })}

        <circle
          cx={PIVOT_X}
          cy={PIVOT_Y}
          r="3.2"
          className="fill-elevated stroke-line"
          strokeWidth="0.8"
        />

        <path
          d={NEEDLE_PATH}
          className="instrument-needle fill-primary"
          style={
            {
              '--needle-from': `${angleAt(rest)}deg`,
              '--needle-to': `${angleAt(reading)}deg`,
            } as CSSProperties
          }
        />
      </svg>

      <div className="mt-1 flex justify-between font-mono text-micro text-muted">
        <span>{from}</span>
        <span>{to}</span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-secondary">{note}</p>
    </figure>
  )
}
