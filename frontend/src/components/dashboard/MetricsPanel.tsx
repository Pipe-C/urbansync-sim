import { Badge, Card, Stat, type BadgeTone, type StatTrend } from '@/components/ui'
import { useMetricsStore } from '@/store/metricsStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useStreamStore } from '@/store/streamStore'
import { cn } from '@/utils/cn'
import type { SimulationStatus } from '@/types/metrics'
import type { ConnectionState } from '@/types/stream'

import { FlowChart } from './FlowChart'
import { SimulationControls } from './SimulationControls'

/**
 * The measurements column.
 *
 * Four things are true about this panel and they drove most of its layout:
 *
 * **The numbers are the backend algorithm's, and the panel says so.** They arrive
 * on the socket from `services/socket.ts`, produced by the same control law the
 * canvas demonstrates — so there is a provenance strip at the head of the panel
 * naming the engine, and a connection badge that reports whether those numbers
 * are still arriving. A panel that kept showing the last frame after the stream
 * died would be the one way this screen could lie, and the badge is what stops it.
 *
 * **The comparison is the headline, not a footnote.** A single number moving is
 * not evidence of anything. So each reading carries its own delta against the
 * fixed cycle underneath it, and the wait-time delta is promoted out of the list
 * because that is the claim the whole product rests on.
 *
 * **The empty state is a real state.** Before a reading there is no value to show,
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

/**
 * The connection badge, which is the run's liveness and the channel's, folded
 * into the one label the header has room for. The run's own state wins where the
 * two overlap — a paused run is paused whether or not its socket is healthy —
 * because that is the state the operator most recently asked for.
 */
function connectionBadge(
  status: SimulationStatus,
  connection: ConnectionState,
): { tone: BadgeTone; label: string } {
  if (connection === 'error') return { tone: 'congested', label: 'Sin conexión' }
  if (connection === 'reconnecting') return { tone: 'warning', label: 'Reconectando' }
  if (connection === 'connecting') return { tone: 'neutral', label: 'Conectando' }
  if (status === 'paused') return { tone: 'warning', label: 'En pausa' }
  if (connection === 'stale') return { tone: 'warning', label: 'Datos atrasados' }
  if (connection === 'live') return { tone: 'flow', label: 'En vivo' }
  return { tone: 'neutral', label: 'En espera' }
}

/** One sentence under the strip, naming where the numbers come from and, when the
 *  channel is not well, whether they can still be trusted. */
function provenanceLine(status: SimulationStatus, connection: ConnectionState): string {
  if (connection === 'error') {
    return 'Sin conexión con el motor del algoritmo. Los números en pantalla son los últimos recibidos.'
  }
  if (connection === 'reconnecting') {
    return 'Se perdió el canal en vivo. Reconectando; hasta entonces no llegan lecturas nuevas.'
  }
  if (connection === 'stale') {
    return 'El canal está abierto pero no llegan lecturas nuevas. Se muestran las últimas recibidas.'
  }
  if (status === 'idle') {
    return 'Inicia la simulación para medir el cruce con el motor del algoritmo.'
  }
  return 'Números producidos por el algoritmo del backend en vivo, no una serie simulada.'
}

export interface MetricsPanelProps {
  className?: string
}

export function MetricsPanel({ className }: MetricsPanelProps) {
  const frame = useMetricsStore((state) => state.frame)
  const history = useMetricsStore((state) => state.history)
  const hasRun = useMetricsStore((state) => state.hasRun)
  const mode = useSimulationStore((state) => state.mode)
  const status = useSimulationStore((state) => state.status)
  const connection = useStreamStore((state) => state.connection)

  const active = mode === 'adaptive' ? frame.adaptive : frame.fixed
  const baseline = mode === 'adaptive' ? frame.fixed : frame.adaptive
  const activeLabel: string = mode === 'adaptive' ? 'Adaptativo' : 'Ciclo fijo'
  const otherLabel = mode === 'adaptive' ? 'Ciclo fijo' : 'Adaptativo'
  const badge = connectionBadge(status, connection)

  // A ratio against the baseline is only a reading once the baseline has one. In
  // the first seconds of a run the fixed cycle may not have served anyone yet, and
  // a delta of 0/0 would print `NaN%` — so the comparison waits with the data.
  const comparable = hasRun && baseline.averageWaitSeconds > 0
  const waitReduction = comparable
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
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </header>

        <div className="px-4 py-2.5">
          <p className="font-mono text-micro uppercase tracking-wider text-muted">
            Motor del algoritmo · backend
          </p>
          <p className="mt-1 text-xs leading-relaxed text-secondary">
            {provenanceLine(status, connection)}
          </p>
        </div>

        <div className="px-4 py-4">
          {/* The claim, promoted. Everything else on this screen is in service
              of making this one number credible. */}
          <p className="font-mono text-micro uppercase text-muted">
            Espera media frente a {otherLabel.toLowerCase()}
          </p>
          <p
            className={cn(
              'tabular mt-1 font-mono text-metric leading-none',
              comparable ? waitSentiment(waitReduction) : 'text-muted',
            )}
          >
            {comparable ? formatDelta(waitReduction) : '—'}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-secondary">
            {comparable
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
            value={hasRun ? frame.vehiclesProcessed[mode].toLocaleString('es-ES') : '—'}
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
