import { ARMS, ARM_LABEL } from '@/simulation/core'
import { ThreeCanvas } from '@/components/simulation/ThreeCanvas'
import { Badge, type BadgeTone } from '@/components/ui'
import { useEngineReadout } from '@/hooks/useEngineReadout'
import { useSimulationStore } from '@/store/simulationStore'
import { cn } from '@/utils/cn'
import type { SimulationStatus } from '@/types/metrics'

/**
 * The junction viewport.
 *
 * The scene behind this frame is the engine: `IntersectionWorld` stepped by
 * the shared runner, painted by `IntersectionScene`, live at refresh rate.
 * The badge says so — "Motor real" — because the honest split in this product
 * is that the junction runs on the model while the charts beside it are still
 * the mock series, and the metrics panel marks its own half with "Simulado".
 * One badge per panel, each telling the truth about itself.
 *
 * The footer reads the runner's four-times-a-second snapshot through
 * `useEngineReadout`, not the metrics store: queues and waits come from the
 * same vehicles the canvas draws, so the queue a viewer counts on screen and
 * the number under it can never be two different simulations. Before the
 * engine has ever published, the cells show an em dash rather than a zero —
 * "nothing measured yet" and "the junction is empty" are different states, and
 * only one of them is true at a time.
 *
 * The last line carries the controller's own explanation of what it is doing.
 * It is the explainability surface of the whole thesis: adaptive control that
 * cannot say why it chose its phase is just a random light with extra steps.
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
  const readout = useEngineReadout()

  const isIdle = status === 'idle'
  const longestQueue = readout === null ? 0 : Math.max(...ARMS.map((arm) => readout.queued[arm]), 0)

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
          <h2 className="truncate text-sm font-medium text-primary">Cruce en vivo</h2>
          <p className="mt-0.5 font-mono text-micro uppercase tracking-widest text-muted">
            Av. Norte × Calle Este · 4 accesos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
          <Badge tone="neutral" dot={false}>
            Motor real
          </Badge>
        </div>
      </header>

      {/* The scene sizes and centres itself; the only job of this box is to
          give it a definite height, which is what makes the junction's container
          queries resolve against it rather than against the viewport. */}
      <div className="relative flex-1 bg-canvas p-4">
        <ThreeCanvas className="size-full" />

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
          {ARMS.map((arm) => {
            const queued = readout === null ? null : readout.queued[arm]
            const wait = readout === null ? null : readout.wait[arm]
            const isWorst = queued !== null && queued > 0 && queued === longestQueue

            return (
              <div
                key={arm}
                className="border-b border-line px-4 py-2.5 last:border-b-0 sm:border-b-0"
              >
                <dt className="font-mono text-micro uppercase tracking-wider text-muted">
                  {ARM_LABEL[arm]}
                </dt>
                <dd className="mt-1 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      'tabular font-mono text-sm',
                      isWorst ? 'text-warning' : 'text-primary',
                    )}
                  >
                    {queued ?? '—'}
                  </span>
                  <span className="font-mono text-micro text-muted">
                    {queued === null ? 'esperando motor' : `· ${wait?.toFixed(0) ?? 0}s`}
                  </span>
                </dd>
              </div>
            )
          })}
        </dl>

        <p className="border-t border-line px-4 py-2 font-mono text-micro text-muted">
          <span className="text-secondary">Regla actual</span>
          <span className="mx-1.5 text-line">·</span>
          {readout?.reason ?? '—'}
        </p>
      </footer>
    </section>
  )
}
