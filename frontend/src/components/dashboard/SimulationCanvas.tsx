import { AmbientIntersection } from '@/components/simulation/AmbientIntersection'
import { Badge, type BadgeTone } from '@/components/ui'
import { useMetricsStore } from '@/store/metricsStore'
import { useSimulationStore } from '@/store/simulationStore'
import { cn } from '@/utils/cn'
import type { SimulationStatus } from '@/types/metrics'

/**
 * The junction viewport.
 *
 * This is a framed stand-in for `IntersectionScene` (Sprint 1-E), and it is
 * dressed as the canvas that will replace it: a bounded viewport with a title
 * bar, a status line and a per-approach readout, because a Phaser canvas mounted
 * bare in a page looks like a bug. Dressing it now means Sprint 1-E swaps the
 * contents and not the frame.
 *
 * The provenance note in the footer is deliberate. The numbers beside this
 * canvas are simulated, and so is this view; a demo that quietly presented a
 * CSS animation as the simulation engine would be overclaiming in the one place
 * an evaluator is most likely to look.
 */

const STATUS_TONE: Record<SimulationStatus, BadgeTone> = {
  idle: 'neutral',
  running: 'flow',
  paused: 'warning',
}

const STATUS_LABEL: Record<SimulationStatus, string> = {
  idle: 'En espera',
  running: 'Simulando',
  paused: 'En pausa',
}

export interface SimulationCanvasProps {
  className?: string
}

export function SimulationCanvas({ className }: SimulationCanvasProps) {
  const status = useSimulationStore((state) => state.status)
  const mode = useSimulationStore((state) => state.mode)
  const frame = useMetricsStore((state) => state.frame)
  const hasRun = useMetricsStore((state) => state.hasRun)

  const isIdle = status === 'idle'
  const longestQueue = Math.max(...frame.queue.map((approach) => approach.queued), 0)

  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-line bg-surface',
        className,
      )}
      aria-label="Vista de la intersección"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-primary">Av. Norte × Calle Este</h2>
          <p className="mt-0.5 font-mono text-micro uppercase tracking-widest text-muted">
            Intersección 01 · 4 accesos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
          <Badge tone={mode === 'adaptive' ? 'flow' : 'neutral'}>
            {mode === 'adaptive' ? 'Adaptativo' : 'Ciclo fijo'}
          </Badge>
        </div>
      </header>

      {/* The scene sizes and centres itself; the only job of this box is to
          give it a definite height, which is what makes the junction's container
          queries resolve against it rather than against the viewport. */}
      <div className="relative flex-1 bg-canvas p-4">
        <AmbientIntersection className="size-full" paused={status === 'paused'} />

        {/* The empty state sits over the scene rather than replacing it. The
            junction is already running when the console opens, which is the same
            argument the login makes; the difference is that here the viewer
            knows what the Start button is for. */}
        {isIdle && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-lg border border-line bg-surface/90 px-5 py-4 text-center">
              <p className="font-mono text-micro uppercase tracking-widest text-muted">
                Sin ejecución
              </p>
              <p className="mt-1.5 text-sm text-primary">
                Pulsa <span className="font-mono text-accent">Iniciar</span> para muestrear el cruce
              </p>
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-line">
        <dl className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
          {frame.queue.map((approach) => {
            const isWorst = hasRun && approach.queued === longestQueue && longestQueue > 0

            return (
              <div
                key={approach.approach}
                className="border-b border-line px-4 py-2.5 last:border-b-0 sm:border-b-0"
              >
                <dt className="font-mono text-micro uppercase tracking-wider text-muted">
                  {approach.label}
                </dt>
                <dd className="mt-1 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      'tabular font-mono text-sm',
                      isWorst ? 'text-warning' : 'text-primary',
                    )}
                  >
                    {hasRun ? approach.queued : '—'}
                  </span>
                  <span className="font-mono text-micro text-muted">
                    {hasRun ? `· ${approach.meanWaitSeconds.toFixed(0)}s` : 'en cola'}
                  </span>
                </dd>
              </div>
            )
          })}
        </dl>

        <p className="border-t border-line px-4 py-2 font-mono text-micro text-muted">
          Vista previa en CSS · el motor Phaser entra en el Sprint 1-E
        </p>
      </footer>
    </section>
  )
}
