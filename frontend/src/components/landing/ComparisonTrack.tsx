import { useInView } from '@/hooks/useInView'
import { cn } from '@/utils/cn'

type PhaseKind = 'green' | 'amber' | 'allRed'

interface Phase {
  kind: PhaseKind
  /** Column weight. The weights are the shape of the policy, not a measurement. */
  span: number
}

const PHASE_CLASSES: Record<PhaseKind, string> = {
  green: 'bg-flow/70',
  amber: 'bg-warning/70',
  allRed: 'bg-line',
}

/** Two identical cycles: green, amber, all-red, twice. The period is the point. */
const FIXED: Phase[] = [
  { kind: 'green', span: 5 },
  { kind: 'amber', span: 1 },
  { kind: 'allRed', span: 1 },
  { kind: 'green', span: 5 },
  { kind: 'amber', span: 1 },
  { kind: 'allRed', span: 1 },
]

/**
 * The same phases with the green moved toward the approach carrying the queue.
 * A long green for one axis, a short one for the other, then a correction when
 * the pressure crosses back. Irregular on purpose: the whole contrast with the
 * row above is that this row is not periodic.
 */
const ADAPTIVE: Phase[] = [
  { kind: 'green', span: 6.4 },
  { kind: 'amber', span: 1.1 },
  { kind: 'allRed', span: 0.9 },
  { kind: 'green', span: 3.2 },
  { kind: 'amber', span: 1.1 },
  { kind: 'allRed', span: 0.9 },
  { kind: 'green', span: 5.6 },
  { kind: 'amber', span: 1.1 },
  { kind: 'allRed', span: 0.9 },
]

const LEGEND: { kind: PhaseKind; label: string }[] = [
  { kind: 'green', label: 'Verde' },
  { kind: 'amber', label: 'Ámbar' },
  { kind: 'allRed', label: 'Todo rojo' },
]

interface TrackProps {
  phases: Phase[]
  playing: boolean
}

function Track({ phases, playing }: TrackProps) {
  return (
    <div
      aria-hidden="true"
      data-playing={playing ? 'true' : 'false'}
      className="landing-track relative overflow-hidden rounded-sm border border-line bg-canvas"
    >
      <div
        className="grid h-9 gap-px bg-line"
        style={{ gridTemplateColumns: phases.map((phase) => `${phase.span}fr`).join(' ') }}
      >
        {phases.map((phase, index) => (
          <span key={index} className={cn('block', PHASE_CLASSES[phase.kind])} />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="landing-sweep-fill absolute inset-0 bg-primary/5" />
        <span className="landing-playhead absolute inset-y-0 left-0 w-full">
          <span className="absolute inset-y-0 left-0 w-px bg-primary/60" />
        </span>
      </div>
    </div>
  )
}

interface RowProps {
  label: string
  note: string
  phases: Phase[]
  playing: boolean
}

function Row({ label, note, phases, playing }: RowProps) {
  return (
    <div className="grid gap-3 border-t border-line py-6 first:border-t-0 first:pt-0 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-center lg:gap-8">
      <div>
        <h3 className="text-sm font-medium text-primary">{label}</h3>
        <p className="mt-1 text-sm leading-relaxed text-secondary">{note}</p>
      </div>
      <Track phases={phases} playing={playing} />
    </div>
  )
}

export interface ComparisonTrackProps {
  className?: string
}

/**
 * The paired comparison, drawn as a shape rather than quoted as a number.
 *
 * The product's claim is not "the adaptive controller is better"; it is that the
 * same vehicle sequence, played through both controllers, produces a different
 * distribution of green. Two tapes say that in one glance: the fixed one is
 * periodic and indifferent, the adaptive one leans toward whichever approach has
 * the queue. The playhead runs across both so they read as the same tape played
 * twice, which is the actual method.
 *
 * No figure is printed anywhere on this block, and a caption says why. The block
 * shows the form of the difference; the measured difference belongs to the
 * dashboard, where it is computed from a run. Putting an invented percentage
 * beside a picture this persuasive is the exact move PRODUCT.md forbids.
 */
export function ComparisonTrack({ className }: ComparisonTrackProps) {
  const { ref, inView } = useInView<HTMLDivElement>()

  return (
    <div ref={ref} className={className}>
      <Row
        label="Ciclo fijo"
        note="Reparte el verde en porciones iguales, tenga cola el acceso o no."
        phases={FIXED}
        playing={inView}
      />
      <Row
        label="Adaptativo"
        note="Mueve el verde hacia el acceso que acumula presión en cada tick."
        phases={ADAPTIVE}
        playing={inView}
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-5">
        {LEGEND.map((entry) => (
          <span
            key={entry.kind}
            className="flex items-center gap-2 font-mono text-micro text-muted"
          >
            <span
              className={cn('size-2.5 rounded-sm', PHASE_CLASSES[entry.kind])}
              aria-hidden="true"
            />
            {entry.label}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Esquema del mecanismo, no una medición. Las cifras se calculan en el panel del observador,
        sobre una ejecución real.
      </p>
    </div>
  )
}
