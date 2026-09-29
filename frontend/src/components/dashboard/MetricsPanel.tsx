import { Badge, Card, Stat, type StatTrend } from '@/components/ui'
import { useMetricsStore } from '@/store/metricsStore'
import { useSimulationStore } from '@/store/simulationStore'
import { cn } from '@/utils/cn'

import { FlowChart } from './FlowChart'
import { SimulationControls } from './SimulationControls'

/**
 * The measurements column.
 *
 * Three things are true about this panel and they drove most of its layout:
 *
 * **Every number is invented, and says so.** The `SIMULADO` badge is in the
 * header, not in a footer or a tooltip, because the reader who skims is exactly
 * the reader who would otherwise quote a fabricated 18.4 seconds to a professor.
 * The same honesty is why the fixed-cycle comparison is generated rather than
 * faked: a product claiming adaptive control is better has to be willing to
 * show the baseline losing.
 *
 * **The comparison is the headline, not a footnote.** A single number moving is
 * not evidence of anything. So each reading carries its own delta against the
 * fixed cycle underneath it, and the wait-time delta is promoted out of the list
 * because that is the claim the whole product rests on.
 *
 * **The empty state is a real state.** Before a run there is no value to show,
 * so there is a dash rather than a zero. A dashboard that opens on 0 veh/min and
 * 0s wait is making a measurement it has not taken.
 */

/** `−40%` reads as a reduction in wait; `+33%` as an increase. The sign is
 *  carried by the arrow's meaning, so it is spelled out here rather than left to
 *  the call site to get right twice. */
function formatDelta(reductionPercent: number): string {
  return `${reductionPercent > 0 ? '−' : '+'}${Math.abs(reductionPercent).toFixed(0)}%`
}

/**
 * Whether the live policy is doing better than the other one.
 *
 * Signed rather than boolean, because a dashboard that coloured the fixed-cycle
 * reading green just because it was on screen would be telling the viewer the
 * baseline is winning. The number and its colour come from the same comparison.
 */
function waitSentiment(reductionPercent: number): 'text-flow' | 'text-congested' {
  return reductionPercent > 0 ? 'text-flow' : 'text-congested'
}

/** Wait time falling is good news; throughput rising is good news. Sentiment is
 *  decided here, not inferred from the arrow's direction at the call site. */
function waitTrend(active: number, other: number): StatTrend {
  return {
    direction: active <= other ? 'down' : 'up',
    sentiment: active <= other ? 'positive' : 'negative',
  }
}

export interface MetricsPanelProps {
  className?: string
}

export function MetricsPanel({ className }: MetricsPanelProps) {
  const frame = useMetricsStore((state) => state.frame)
  const history = useMetricsStore((state) => state.history)
  const hasRun = useMetricsStore((state) => state.hasRun)
  const mode = useSimulationStore((state) => state.mode)

  const active = mode === 'adaptive' ? frame.adaptive : frame.fixed
  const baseline = mode === 'adaptive' ? frame.fixed : frame.adaptive
  const activeLabel = mode === 'adaptive' ? 'Adaptativo' : 'Ciclo fijo'
  const otherLabel = mode === 'adaptive' ? 'Ciclo fijo' : 'Adaptativo'

  const waitReduction = hasRun
    ? (1 - active.averageWaitSeconds / baseline.averageWaitSeconds) * 100
    : 0

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Card
        padding="none"
        className="flex flex-col divide-y divide-line"
        aria-label="Métricas de la ejecución"
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <h2 className="font-mono text-micro uppercase tracking-widest text-muted">
            Lecturas · {activeLabel}
          </h2>
          <Badge tone="warning">Simulado</Badge>
        </header>

        <div className="px-4 py-4">
          {/* The claim, promoted. Everything else on this screen is in service
              of making this one number credible. */}
          <p className="font-mono text-micro uppercase text-muted">
            Espera media frente a {otherLabel.toLowerCase()}
          </p>
          <p
            className={cn(
              'tabular mt-1 font-mono text-metric leading-none',
              hasRun ? waitSentiment(waitReduction) : 'text-muted',
            )}
          >
            {hasRun ? formatDelta(waitReduction) : '—'}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-secondary">
            {hasRun
              ? `${active.averageWaitSeconds.toFixed(1)} s de media con control ${activeLabel.toLowerCase()}, frente a ${baseline.averageWaitSeconds.toFixed(1)} s con ${otherLabel.toLowerCase()}.`
              : 'Inicia la simulación para comparar ambas políticas sobre el mismo tráfico.'}
          </p>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          <Stat
            label="Espera media"
            value={hasRun ? active.averageWaitSeconds.toFixed(1) : '—'}
            unit={hasRun ? 's' : undefined}
            hint={
              hasRun ? `${otherLabel}: ${baseline.averageWaitSeconds.toFixed(1)} s` : 'Sin ejecutar'
            }
            {...(hasRun
              ? { trend: waitTrend(active.averageWaitSeconds, baseline.averageWaitSeconds) }
              : {})}
          />

          <Stat
            label="Vehículos atendidos"
            value={hasRun ? frame.vehiclesProcessed.toLocaleString('es-ES') : '—'}
            hint={
              hasRun
                ? `${active.throughputPerMinute.toFixed(0)} veh/min · cola máx. ${active.longestQueue}`
                : 'Sin ejecutar'
            }
          />

          <Stat
            label="Respuesta a emergencia"
            value={hasRun ? active.emergencyResponseSeconds.toFixed(1) : '—'}
            unit={hasRun ? 's' : undefined}
            hint={
              hasRun
                ? `${otherLabel}: ${baseline.emergencyResponseSeconds.toFixed(1)} s`
                : 'Sin ejecutar'
            }
          />
        </div>
      </Card>

      <Card
        title="Flujo por minuto"
        description={`Adaptativo frente a ciclo fijo · ${history.length} muestras`}
        padding="md"
      >
        <FlowChart history={history} />
      </Card>

      <Card title="Control" padding="md">
        <SimulationControls />
      </Card>
    </div>
  )
}
