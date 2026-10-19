import { useEffect, useState } from 'react'

import { AmbientIntersection } from '@/components/simulation/AmbientIntersection'
import { ThreeCanvas } from '@/components/simulation/ThreeCanvas'
import { useEngineReadout } from '@/hooks/useEngineReadout'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { ARM_LABEL, ARMS } from '@/simulation/core'
import { acquireSimulationRunner } from '@/simulation/runner'
import { cn } from '@/utils/cn'

function detectWebGL(): boolean {
  try {
    const probe = document.createElement('canvas')
    return probe.getContext('webgl2') !== null || probe.getContext('webgl') !== null
  } catch {
    return false
  }
}

interface ReadoutCellProps {
  label: string
  value: string
}

function ReadoutCell({ label, value }: ReadoutCellProps) {
  return (
    <div className="border-b border-line px-4 py-3 last:border-b-0 sm:border-b-0">
      <dt className="font-mono text-micro uppercase tracking-wider text-muted">{label}</dt>
      <dd className="tabular mt-1 font-mono text-sm text-primary">{value}</dd>
    </div>
  )
}

export interface HeroJunctionProps {
  className?: string
}

const CORNERS = [
  'left-3 top-3 border-l border-t',
  'right-3 top-3 border-r border-t',
  'bottom-3 left-3 border-b border-l',
  'bottom-3 right-3 border-b border-r',
]

/**
 * The junction the whole page is about.
 *
 * This is the dashboard's own scene — the same `IntersectionScene`, stepped by
 * the same runner — seated in a bezel and read by the same instrument strip. The
 * point of the landing is to argue that the control is real, and the strongest
 * form of that argument is not a picture of the junction but the junction, running
 * before anyone has clicked anything.
 *
 * It degrades on purpose. Without a WebGL context, or when the visitor has asked
 * for reduced motion, the live canvas is replaced by `AmbientIntersection`, whose
 * reduced-motion contract already resolves to a legible still frame. The header
 * says which one is on screen rather than implying the same thing in both cases.
 *
 * The readings are the engine's, not the page's: `Fase`, `Servidos`, the longest
 * wait and the deepest queue all come from the runner's snapshot, and `Regla
 * actual` is the controller's own sentence about why it is doing what it is
 * doing. Nothing here is computed for the landing, which is the only reason it
 * can be believed.
 */
export function HeroJunction({ className }: HeroJunctionProps) {
  const [webgl] = useState(detectWebGL)
  const prefersReduced = usePrefersReducedMotion()
  const readout = useEngineReadout()

  const live = webgl && !prefersReduced

  // The readings are the engine's, so the engine has to be running even when the
  // canvas is not. The live canvas joins the runner itself; this covers the one
  // case where it does not — the reduced-motion fallback, whose whole purpose is
  // a legible still frame, not an empty instrument strip beside it. The numbers
  // still describe a real junction; only the picture is held still.
  useEffect(() => {
    if (live) {
      return
    }
    return acquireSimulationRunner()
  }, [live])

  const activeLabel =
    readout === null ? '—' : readout.activeArm === null ? 'Todo rojo' : ARM_LABEL[readout.activeArm]
  const maxQueue = readout === null ? null : Math.max(...ARMS.map((arm) => readout.queued[arm]))

  return (
    <figure
      className={cn('overflow-hidden rounded-lg border border-line bg-surface', className)}
      aria-label="Intersección en directo"
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
        <span className="flex items-center gap-2 font-mono text-micro uppercase text-muted">
          <span
            aria-hidden="true"
            className={cn('size-1.5 rounded-full', live ? 'bg-accent' : 'bg-muted')}
          />
          {live ? 'En vivo' : 'Vista estática'}
        </span>
        <span className="font-mono text-micro uppercase text-muted">
          Av. Norte &times; Calle Este
        </span>
      </div>

      <div className="relative h-[clamp(18rem,46vh,34rem)] border-b border-line bg-canvas">
        {live ? (
          <ThreeCanvas className="size-full" />
        ) : (
          <AmbientIntersection className="size-full" />
        )}

        {CORNERS.map((corner) => (
          <span
            key={corner}
            aria-hidden="true"
            className={cn('pointer-events-none absolute size-3 border-line', corner)}
          />
        ))}
      </div>

      <dl className="grid grid-cols-2 divide-line border-b border-line sm:grid-cols-4 sm:divide-x">
        <ReadoutCell label="Fase" value={activeLabel} />
        <ReadoutCell label="Servidos" value={readout === null ? '—' : String(readout.served)} />
        <ReadoutCell
          label="Espera máx."
          value={readout === null ? '—' : `${readout.longestWait.toFixed(0)} s`}
        />
        <ReadoutCell label="Cola máx." value={maxQueue === null ? '—' : String(maxQueue)} />
      </dl>

      <figcaption className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2.5 font-mono text-micro text-muted">
        <span className="text-secondary">Regla actual</span>
        <span aria-hidden="true" className="text-line">
          ·
        </span>
        <span key={readout?.reason ?? 'idle'} className="animate-phase-fade text-primary/90">
          {readout?.reason ?? 'Esperando al motor…'}
        </span>
      </figcaption>
    </figure>
  )
}
