import { cn } from '@/utils/cn'
import type { ControlMode, MetricsFrame } from '@/types/metrics'

/**
 * The two policies, read side by side.
 *
 * The wait comparison is promoted out of this table and into the panel's
 * headline: it is the claim the product rests on, and repeating it here would
 * give the same number two homes. What remains is the evidence behind that
 * claim — the totals and the costs — so a shorter wait cannot be read without
 * also seeing the throughput and the queue it was bought with.
 *
 * A table, not a stack of paired bars. One header names the two policies once,
 * the numbers align down each column, and the row labels stay short. The bars
 * are scaled per row, not across rows: a queue of nine and a wait of nine
 * seconds are different units, and a shared scale would make them look
 * comparable. The floor under each scale keeps a quiet run from turning a
 * one-vehicle difference into a full bar; it is a rendering floor, not a
 * threshold, and it never changes the printed value.
 *
 * A shorter bar is not always the better result — less waiting is good, less
 * throughput is not — so the bars do not colour by "winner". Adaptive wears the
 * chart's own Flow Green and the fixed cycle its muted baseline, and the reader
 * compares lengths. The active policy is marked in the text colour only,
 * because the toggle changes which reading is headlined, not which one exists.
 */

interface ComparisonRow {
  id: string
  label: string
  unit: string
  /** Smallest value the row's bar scale will use, in that row's own unit. */
  floor: number
  adaptive: number
  fixed: number
  format: (value: number) => string
  /** A zero here means "none observed", not "zero seconds". */
  zeroMeansAbsent?: boolean
}

const SERIES: readonly ControlMode[] = ['adaptive', 'fixed']

const SERIES_LABEL: Record<ControlMode, string> = {
  adaptive: 'Adaptativo',
  fixed: 'Ciclo fijo',
}

const SERIES_TONE: Record<ControlMode, string> = {
  adaptive: 'bg-flow',
  fixed: 'bg-muted',
}

function shareOf(value: number, max: number): number {
  if (max <= 0 || value <= 0) {
    return 0
  }

  // A two-percent floor keeps a real, small reading from disappearing into a
  // one-pixel bar. It is only applied to non-zero values, so zero stays empty.
  return Math.max(Math.min(1, value / max) * 100, 2)
}

function buildRows(frame: MetricsFrame): ComparisonRow[] {
  return [
    {
      id: 'served',
      label: 'Atendidos',
      unit: 'veh',
      floor: 1,
      adaptive: frame.vehiclesProcessed.adaptive,
      fixed: frame.vehiclesProcessed.fixed,
      format: (value) => value.toLocaleString('es-ES'),
    },
    {
      id: 'flow',
      label: 'Caudal',
      unit: 'veh/min',
      floor: 10,
      adaptive: frame.adaptive.throughputPerMinute,
      fixed: frame.fixed.throughputPerMinute,
      format: (value) => value.toFixed(0),
    },
    {
      id: 'queue',
      label: 'Cola máx.',
      unit: 'veh',
      floor: 5,
      adaptive: frame.adaptive.longestQueue,
      fixed: frame.fixed.longestQueue,
      format: (value) => value.toFixed(0),
    },
    {
      id: 'emergency',
      label: 'Emergencia',
      unit: 's',
      floor: 10,
      adaptive: frame.adaptive.emergencyResponseSeconds,
      fixed: frame.fixed.emergencyResponseSeconds,
      format: (value) => value.toFixed(1),
      zeroMeansAbsent: true,
    },
  ]
}

export interface StrategyComparisonProps {
  frame: MetricsFrame
  mode: ControlMode
  hasRun: boolean
  className?: string
}

export function StrategyComparison({ frame, mode, hasRun, className }: StrategyComparisonProps) {
  const rows = buildRows(frame)

  return (
    <table className={cn('w-full border-collapse text-left', className)}>
      <caption className="sr-only">
        Comparación de la política adaptativa frente al ciclo fijo
      </caption>

      <thead>
        <tr className="border-b border-line">
          <th
            scope="col"
            className="pb-2 pr-2 font-mono text-micro uppercase tracking-wider text-muted"
          >
            Lectura
          </th>
          {SERIES.map((series) => (
            <th
              key={series}
              scope="col"
              className="pb-2 pl-3 text-right font-mono text-micro uppercase tracking-wider"
            >
              <span
                className={cn(
                  'inline-flex items-center gap-1.5',
                  series === mode ? 'text-primary' : 'text-muted',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn('size-1.5 rounded-full', SERIES_TONE[series])}
                />
                {SERIES_LABEL[series]}
              </span>
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-y divide-line">
        {rows.map((row) => {
          const max = Math.max(row.adaptive, row.fixed, row.floor)

          return (
            <tr key={row.id}>
              <th
                scope="row"
                className="py-2.5 pr-2 font-mono text-micro uppercase leading-tight tracking-wider text-muted"
              >
                {row.label}
              </th>

              {SERIES.map((series) => {
                const value = row[series]
                const absent = !hasRun || (row.zeroMeansAbsent === true && value <= 0)
                const isActive = series === mode
                const absentLabel = hasRun ? 'Sin emergencia registrada' : 'Sin ejecutar'

                return (
                  <td key={series} className="py-2.5 pl-3 align-middle">
                    <span
                      aria-label={absent ? absentLabel : undefined}
                      className={cn(
                        'tabular flex items-baseline justify-end gap-1 font-mono text-xs',
                        isActive ? 'text-primary' : 'text-secondary',
                      )}
                    >
                      {absent ? '—' : row.format(value)}
                      {!absent && (
                        <span className="font-mono text-micro text-muted">{row.unit}</span>
                      )}
                    </span>

                    {/* No width tween. Ticks land ten a second, so an ease would
                        spend most of its life chasing a value it never catches;
                        the bar would disagree with the number beside it. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-1 block h-1 overflow-hidden rounded-full bg-elevated',
                        absent && 'invisible',
                      )}
                    >
                      <span
                        className={cn('block h-full rounded-full', SERIES_TONE[series])}
                        style={{ width: `${absent ? 0 : shareOf(value, max)}%` }}
                      />
                    </span>
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
