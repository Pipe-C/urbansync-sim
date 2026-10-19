import { cn } from '@/utils/cn'
import type { ControlMode, MetricsFrame } from '@/types/metrics'

/**
 * The two policies, read side by side.
 *
 * The panel's headline promotes one comparison — the wait-time reduction — but
 * a single delta is an assertion a reader has to trust. This rack is the
 * evidence behind it: every quantity the wire carries per strategy, drawn as a
 * pair of bars on one scale, so a shorter wait cannot be read without also
 * seeing the queue and the throughput it was paid for.
 *
 * The bars are scaled per row, not across rows. A queue of nine and a wait of
 * nine seconds are different units and a shared scale would make them look
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

const SERIES_FILL: Record<ControlMode, string> = {
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
      id: 'wait',
      label: 'Espera media',
      unit: 's',
      floor: 5,
      adaptive: frame.adaptive.averageWaitSeconds,
      fixed: frame.fixed.averageWaitSeconds,
      format: (value) => value.toFixed(1),
    },
    {
      id: 'served',
      label: 'Vehículos atendidos',
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
      label: 'Cola máxima',
      unit: 'veh',
      floor: 5,
      adaptive: frame.adaptive.longestQueue,
      fixed: frame.fixed.longestQueue,
      format: (value) => value.toFixed(0),
    },
    {
      id: 'emergency',
      label: 'Respuesta de emergencia',
      unit: 's',
      floor: 10,
      adaptive: frame.adaptive.emergencyResponseSeconds,
      fixed: frame.fixed.emergencyResponseSeconds,
      format: (value) => value.toFixed(1),
      zeroMeansAbsent: true,
    },
  ]
}

interface ComparisonRowViewProps {
  row: ComparisonRow
  mode: ControlMode
  hasRun: boolean
}

function ComparisonRowView({ row, mode, hasRun }: ComparisonRowViewProps) {
  const max = Math.max(row.adaptive, row.fixed, row.floor)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="font-mono text-micro uppercase leading-none text-muted">{row.label}</dt>
        <span className="font-mono text-micro leading-none text-muted">{row.unit}</span>
      </div>

      {SERIES.map((series) => {
        const value = row[series]
        const isActive = series === mode
        const absent = !hasRun || (row.zeroMeansAbsent === true && value <= 0)
        const absentLabel = hasRun ? 'Sin emergencia registrada' : 'Sin ejecutar'

        return (
          <dd
            key={series}
            className="grid grid-cols-[5.5rem_minmax(0,1fr)_3.25rem] items-center gap-2"
          >
            <span
              className={cn(
                'font-mono text-micro uppercase leading-none',
                isActive ? 'text-primary' : 'text-muted',
              )}
            >
              {SERIES_LABEL[series]}
            </span>

            <span className="h-1 overflow-hidden rounded-full bg-elevated" aria-hidden="true">
              {/* No width tween. Ticks land ten a second, so a 300 ms ease would
                  spend most of its life chasing a value it never catches; the
                  bar would disagree with the number printed beside it. The bar
                  steps with the tick, and the number is always the bar's truth. */}
              <span
                className={cn('block h-full rounded-full', SERIES_FILL[series])}
                style={{ width: `${absent ? 0 : shareOf(value, max)}%` }}
              />
            </span>

            <span
              className={cn(
                'tabular text-right font-mono text-xs',
                isActive ? 'text-primary' : 'text-secondary',
              )}
            >
              {absent ? <span aria-label={absentLabel}>—</span> : row.format(value)}
            </span>
          </dd>
        )
      })}
    </div>
  )
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
    <dl className={cn('flex flex-col gap-4', className)}>
      {rows.map((row) => (
        <ComparisonRowView key={row.id} row={row} mode={mode} hasRun={hasRun} />
      ))}
    </dl>
  )
}
