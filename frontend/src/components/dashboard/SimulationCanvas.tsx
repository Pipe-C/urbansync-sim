import { ARMS, ARM_LABEL, type Arm } from '@/simulation/core'
import { ThreeCanvas } from '@/components/simulation/ThreeCanvas'
import { Badge, Tooltip } from '@/components/ui'
import { PhaseTape } from './PhaseTape'
import { TransportControls } from './TransportControls'
import { useEngineReadout } from '@/hooks/useEngineReadout'
import { usePhaseSequence } from '@/hooks/usePhaseSequence'
import { useSimulationStore } from '@/store/simulationStore'
import { cn } from '@/utils/cn'

/**
 * The junction viewport, instrumented.
 *
 * Two engines feed this screen and they are named apart on purpose. The scene is
 * the browser's model, stepped by the shared runner and painted at refresh rate;
 * the panel to the right is the backend algorithm's reading. The header says
 * "Motor local", the panel says "Motor del backend", and no number crosses the
 * boundary. That split is the honest description of the product: the junction
 * has to run without a server, and the evidence has to come from the law the
 * backend actually executes.
 *
 * Everything around the scene is read from the runner's snapshot, never from
 * the metrics store: the phase chip, the served total, the longest wait, the
 * queue bars and the phase tape all describe the vehicles the viewer can count
 * on screen. Before the first publish the cells show an em dash rather than a
 * zero — "nothing measured yet" and "the junction is empty" are different
 * states, and only one of them is true at a time.
 *
 * The transport sits here, directly under the header, because it starts the
 * run this panel is about. The policy toggle lives with the readings instead:
 * it selects which of two already-running strategies is headlined, and putting
 * it next to Start would imply it changes the junction.
 *
 * Motion is state-driven and finite. A phase change fades the chip, moves the
 * 2px active marker and appends a segment to the tape; an emergency mounts the
 * blue badge; the reason line fades when the controller says something new.
 * The bars step with the readout and never tween: the printed number is the
 * bar's truth, and a bar still travelling to a value it has already left is a
 * second, quieter lie.
 */

const QUEUE_SCALE_FLOOR = 12

function queueWidth(queued: number, scale: number): number {
  if (queued <= 0 || scale <= 0) {
    return 0
  }

  // A two-percent floor keeps a real, small queue from disappearing into a
  // one-pixel bar. Only non-zero values get it, so zero stays empty.
  return Math.max(Math.min(1, queued / scale) * 100, 2)
}

/** The current service state, over the scene's top-left corner. */
function PhaseChip({ arm, hasReadout }: { arm: Arm | null; hasReadout: boolean }) {
  const label = !hasReadout ? '—' : arm ? ARM_LABEL[arm] : 'Todo rojo'

  return (
    <div
      className={cn(
        'pointer-events-none flex items-center gap-2 rounded-sm border border-line bg-canvas/90 px-2.5 py-1.5',
        'animate-phase-fade',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 shrink-0 rounded-full', arm ? 'bg-flow' : 'bg-muted')}
      />
      <span className="font-mono text-micro uppercase tracking-wider text-muted">Fase</span>
      <span className="font-mono text-xs text-primary">{label}</span>
    </div>
  )
}

/** The local engine's live load. Hidden on the narrowest screens, where the
 *  queue bank below already carries the state worth reading. The total is the
 *  sum of the four cells below, so the scene's summary and its breakdown agree;
 *  throughput is the backend panel's claim, not this one. */
function SceneReadout({
  queued,
  longestWait,
}: {
  queued: number | null
  longestWait: number | null
}) {
  return (
    <div className="pointer-events-none hidden flex-col divide-y divide-line rounded-sm border border-line bg-canvas/90 sm:flex">
      <div className="flex items-baseline justify-between gap-4 px-2.5 py-1.5">
        <span className="font-mono text-micro uppercase tracking-wider text-muted">En cola</span>
        <span className="tabular font-mono text-sm text-primary">{queued ?? '—'}</span>
      </div>
      <div className="flex items-baseline justify-between gap-4 px-2.5 py-1.5">
        <span className="font-mono text-micro uppercase tracking-wider text-muted">
          Espera máx.
        </span>
        <span className="tabular font-mono text-sm text-primary">
          {longestWait === null ? '—' : `${Math.round(longestWait)} s`}
        </span>
      </div>
    </div>
  )
}

/** Four L-shaped marks that frame the scene as an instrument, not a video. */
function CornerTicks() {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2 top-2 size-3 border-l border-t border-line"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-2 size-3 border-r border-t border-line"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2 left-2 size-3 border-b border-l border-line"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2 right-2 size-3 border-b border-r border-line"
      />
    </>
  )
}

export interface SimulationCanvasProps {
  className?: string
}

export function SimulationCanvas({ className }: SimulationCanvasProps) {
  const status = useSimulationStore((state) => state.status)
  const readout = useEngineReadout()
  const segments = usePhaseSequence(readout)

  const isIdle = status === 'idle'
  const preemption = readout?.preemption ?? false
  const longestQueue = readout === null ? 0 : Math.max(...ARMS.map((arm) => readout.queued[arm]), 0)
  const queueScale = Math.max(QUEUE_SCALE_FLOOR, Math.ceil(longestQueue / 4) * 4)
  const phaseKey = readout === null ? 'none' : (readout.activeArm ?? 'all-red')

  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-line bg-surface',
        className,
      )}
      aria-label="Vista de la intersección"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-primary">Cruce en vivo</h2>
          <p className="mt-0.5 font-mono text-micro uppercase tracking-widest text-muted">
            Av. Norte × Calle Este · 4 accesos
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {preemption && (
            <Badge tone="emergency" className="animate-phase-fade">
              Emergencia
            </Badge>
          )}
          <Tooltip
            content="La escena corre en el navegador. Las lecturas del panel vienen del backend."
            side="bottom"
            align="end"
          >
            <Badge tone="neutral" dot={false} tabIndex={0}>
              Motor local
            </Badge>
          </Tooltip>
        </div>
      </header>

      <div className="border-b border-line px-4 py-2">
        <TransportControls />
      </div>

      <div className="relative min-h-[18rem] flex-1 bg-canvas">
        <ThreeCanvas className="size-full" />
        <CornerTicks />

        <div className="absolute left-4 top-4">
          <PhaseChip
            key={phaseKey}
            arm={readout?.activeArm ?? null}
            hasReadout={readout !== null}
          />
        </div>

        <div className="absolute right-4 top-4">
          <SceneReadout
            queued={
              readout === null ? null : ARMS.reduce((total, arm) => total + readout.queued[arm], 0)
            }
            longestWait={readout === null ? null : readout.longestWait}
          />
        </div>

        {/* The local engine runs before a measured run exists, so the idle note
            names the preview instead of claiming the readings are stopped. */}
        {isIdle && (
          <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-sm border border-line bg-canvas/90 px-2.5 py-1.5">
            <span className="font-mono text-micro uppercase tracking-wider text-muted">
              Vista local
            </span>
            <span className="hidden text-xs text-secondary sm:inline">
              Inicia para medir el cruce.
            </span>
          </div>
        )}
      </div>

      <footer className="border-t border-line">
        <div className="flex items-baseline justify-between gap-3 px-4 pt-2.5">
          <p className="font-mono text-micro uppercase tracking-wider text-muted">
            Cola por acceso
          </p>
          <p className="font-mono text-micro text-muted">escala 0–{queueScale}</p>
        </div>

        <dl className="mt-1 grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
          {ARMS.map((arm) => {
            const queued = readout === null ? null : readout.queued[arm]
            const wait = readout === null ? null : readout.wait[arm]
            const isWorst = queued !== null && queued > 0 && queued === longestQueue
            const isActive = readout !== null && readout.activeArm === arm

            return (
              <div
                key={arm}
                className="relative border-b border-line px-4 py-2.5 last:border-b-0 sm:border-b-0"
              >
                {/* The active-phase marker: the one 2px border in the system. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-x-0 top-0 h-0.5 transition-colors duration-200 ease-signal',
                    isActive ? 'bg-flow' : 'bg-transparent',
                  )}
                />

                <dt className="flex items-center gap-1.5 font-mono text-micro uppercase tracking-wider text-muted">
                  {ARM_LABEL[arm]}
                  {isActive && <span className="sr-only">, fase activa</span>}
                </dt>

                <dd className="mt-1">
                  <div className="flex items-baseline gap-1.5">
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
                  </div>

                  <span
                    aria-hidden="true"
                    className="mt-1.5 block h-1 overflow-hidden rounded-full bg-elevated"
                  >
                    <span
                      className={cn(
                        'block h-full rounded-full',
                        isWorst ? 'bg-warning' : 'bg-secondary/60',
                      )}
                      style={{ width: `${queued === null ? 0 : queueWidth(queued, queueScale)}%` }}
                    />
                  </span>
                </dd>
              </div>
            )
          })}
        </dl>

        <div className="border-t border-line px-4 py-2">
          <PhaseTape segments={segments} />
        </div>

        <p className="border-t border-line px-4 py-2 font-mono text-micro text-muted">
          <span className="text-secondary">Regla actual</span>
          <span className="mx-1.5 text-line">·</span>
          <span key={readout?.reason ?? 'none'} className="animate-phase-fade">
            {readout?.reason ?? '—'}
          </span>
        </p>
      </footer>
    </section>
  )
}
