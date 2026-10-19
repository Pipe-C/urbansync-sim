import { Badge, Card, type BadgeTone } from '@/components/ui'
import { useMetricsStore } from '@/store/metricsStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useStreamStore } from '@/store/streamStore'
import { cn } from '@/utils/cn'
import type { SimulationStatus } from '@/types/metrics'
import type { ConnectionState } from '@/types/stream'

import { FlowChart } from './FlowChart'
import { SimulationControls } from './SimulationControls'
import { StrategyComparison } from './StrategyComparison'

/**
 * The measurements column.
 *
 * Five things are true about this panel and they drove most of its layout:
 *
 * **The numbers are the backend algorithm's, and the panel says so.** They arrive
 * on the socket from `services/socket.ts`, produced by the same control law the
 * canvas demonstrates — so there is a provenance strip at the head of the panel
 * naming the engine, and a connection badge that reports whether those numbers
 * are still arriving. A panel that kept showing the last frame after the stream
 * died would be the one way this screen could lie, and the badge is what stops it.
 *
 * **The comparison is the headline, not a footnote.** A single number moving is
 * not evidence of anything. So the wait-time delta is promoted out of the rack
 * because that is the claim the whole product rests on, and the rack below it
 * puts every reading from both policies on the same line.
 *
 * **The rack is the evidence, not a second headline.** It shows both policies at
 * once, including the ones that do not flatter the adaptive case: a shorter wait
 * is only credible next to the queue and the throughput it was bought with.
 *
 * **The latency is measured, not implied.** `sentAt` rides on every tick. The
 * strip reports the last one-way reading and the p95 of the recent window, so
 * "real time" is a number the viewer can check rather than a word in a subtitle.
 *
 * **The empty state is a real state.** Before a reading there is no value to show,
 * so there is a dash rather than a zero. A dashboard that opens on 0 veh/min and
 * 0s wait is making a measurement it has not taken.
 */

/** `−40%` reads as a reduction in wait; `+33%` as an increase. A difference that
 *  rounds to zero is printed without a sign: `0%` is a tie, not a tiny win. */
function formatDelta(reductionPercent: number): string {
  const rounded = Math.round(reductionPercent)
  if (rounded === 0) return '0%'
  return `${rounded < 0 ? '+' : '−'}${Math.abs(rounded)}%`
}

/**
 * Whether the live policy is doing better than the other one.
 *
 * Signed rather than boolean, because a dashboard that coloured the fixed-cycle
 * reading green just because it was on screen would be telling the viewer the
 * baseline is winning. A tie is neutral; painting `0%` red would call a draw a
 * failure. The number and its colour come from the same comparison.
 */
function waitSentiment(reductionPercent: number): 'text-flow' | 'text-congested' | 'text-muted' {
  if (Math.round(reductionPercent) === 0) return 'text-muted'
  return reductionPercent > 0 ? 'text-flow' : 'text-congested'
}

/** One decimal below ten milliseconds keeps sub-millisecond readings legible;
 *  above that the decimal is noise. */
function formatLatency(ms: number): string {
  return ms < 10 ? ms.toFixed(1) : ms.toFixed(0)
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
  const latency = useStreamStore((state) => state.latency)

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

          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line pt-2">
            <span className="font-mono text-micro uppercase tracking-wider text-muted">
              Latencia one-way
            </span>
            {latency ? (
              <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-xs text-secondary">
                <span>
                  p95 <span className="tabular text-primary">{formatLatency(latency.p95Ms)}</span>{' '}
                  ms
                </span>
                <span className="text-line" aria-hidden="true">
                  ·
                </span>
                <span>
                  última{' '}
                  <span className="tabular text-primary">{formatLatency(latency.lastMs)}</span> ms
                </span>
              </span>
            ) : (
              <span className="font-mono text-xs text-muted">—</span>
            )}
          </div>
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

        <div className="px-4 py-4">
          <StrategyComparison frame={frame} mode={mode} hasRun={hasRun} />
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
