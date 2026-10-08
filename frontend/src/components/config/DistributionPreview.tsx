import { Card } from '@/components/ui'
import { DEFAULT_BASE_RATE, DEFAULT_PEAK_RATE, LANES, VEHICLE_SPECS } from '@/simulation/core'
import { CONFIGURABLE_KINDS, CONFIGURABLE_KIND_LABELS, type ConfigurableKind } from '@/types/config'
import { cn } from '@/utils/cn'

export interface DistributionPreviewProps {
  quietRatePerMinute: number
  /** Partial because the preview also renders mid-edit form state, where any
   *  individual weight can still be unset. A missing weight reads as zero. */
  typeWeights: Partial<Record<ConfigurableKind, number>>
  className?: string
}

/** Police share of the arriving stream, fixed by the fleet. The operator does
 *  not set it, and the preview reports it as fixed rather than hiding it. */
const POLICE_WEIGHT = VEHICLE_SPECS.police.weight

function formatPercent(share: number): string {
  return `${Math.round(share * 100)}%`
}

/**
 * What the configuration means, before it is saved.
 *
 * Everything shown here is derived arithmetically from the values on the left
 * — same inputs, same output, no hidden model — because the preview's job is
 * to teach the mapping, not to predict the run. The per-kind shares include
 * the fleet's fixed police weight, so the percentages add up to what the
 * junction will actually draw, not just to the five sliders the operator can
 * touch.
 *
 * The bars are neutral, never teal and never a signal colour: this is read-only
 * instrumentation, and teal means "you can act here".
 */
export function DistributionPreview({
  quietRatePerMinute,
  typeWeights,
  className,
}: DistributionPreviewProps) {
  const quietPerLane = quietRatePerMinute / 60 / LANES.length
  const peakPerMinute = quietPerLane * (DEFAULT_PEAK_RATE / DEFAULT_BASE_RATE) * 60 * LANES.length

  const entries = [
    ...CONFIGURABLE_KINDS.map((kind) => ({
      key: kind as string,
      label: CONFIGURABLE_KIND_LABELS[kind],
      weight: typeWeights[kind] ?? 0,
      fixed: false,
    })),
    { key: 'police', label: 'Policía', weight: POLICE_WEIGHT, fixed: true },
  ]

  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)

  return (
    <Card title="Lo que verá el cruce" className={className}>
      <dl className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-xs text-secondary">Punto tranquilo</dt>
          <dd className="tabular font-mono text-sm text-primary">{quietRatePerMinute} veh/min</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-xs text-secondary">Por carril</dt>
          <dd className="tabular font-mono text-sm text-primary">
            {quietPerLane.toFixed(3)} veh/s
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-xs text-secondary">Pico · misma curva</dt>
          <dd className="tabular font-mono text-sm text-primary">
            {Math.round(peakPerMinute)} veh/min
          </dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-line pt-4">
        <h3 className="font-mono text-micro uppercase text-muted">Reparto del flujo</h3>

        <ul className="mt-3 flex flex-col gap-2.5">
          {entries.map((entry) => {
            const share = total > 0 ? entry.weight / total : 0

            return (
              <li key={entry.key} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={cn('text-xs', entry.fixed ? 'text-muted' : 'text-secondary')}>
                    {entry.label}
                    {entry.fixed && <span className="ml-1.5 text-[0.6875rem]">· fijo</span>}
                  </span>
                  <span
                    className={cn(
                      'tabular font-mono text-xs',
                      entry.fixed ? 'text-muted' : 'text-primary',
                    )}
                  >
                    {formatPercent(share)}
                  </span>
                </div>
                <div
                  role="presentation"
                  className="h-1.5 w-full overflow-hidden rounded-full bg-elevated"
                >
                  <div
                    className={cn(
                      'h-full rounded-full',
                      entry.fixed ? 'bg-muted' : 'bg-lineStrong',
                    )}
                    style={{ width: `${share * 100}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Porcentajes modelados sobre el reparto configurado más el peso fijo de la policía. El
          cruce los usa al crear cada vehículo del flujo.
        </p>
      </div>
    </Card>
  )
}
