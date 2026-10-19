import { ARM_LABEL, type Arm } from '@/simulation/core'
import type { PhaseSegment } from '@/hooks/usePhaseSequence'
import { cn } from '@/utils/cn'

/**
 * The junction's recent service sequence.
 *
 * A single lit phase chip answers "what now"; this tape answers "in what
 * order", which is the difference between the adaptive controller and a fixed
 * cycle. The newest segment is on the right and carries the Flow Green marker;
 * the rest are muted records. It is a sequence of states, not a duration chart,
 * because the readout's cadence cannot support a duration claim.
 *
 * `R` is the all-red interval. The abbreviations match the four queue cells
 * directly below the scene, so the tape reads without a legend.
 */

const ARM_SHORT: Record<Arm, string> = {
  north: 'N',
  east: 'E',
  south: 'S',
  west: 'O',
}

export interface PhaseTapeProps {
  segments: PhaseSegment[]
  className?: string
}

export function PhaseTape({ segments, className }: PhaseTapeProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-micro uppercase tracking-wider text-muted">
          Secuencia de fases
        </span>
        <span className="font-mono text-micro uppercase tracking-wider text-muted">
          más reciente →
        </span>
      </div>

      {segments.length === 0 ? (
        <p className="font-mono text-micro text-muted">—</p>
      ) : (
        <ol
          className="flex justify-end gap-0.5 border-b border-line pb-1"
          aria-label="Fases recientes del motor local"
        >
          {segments.map((segment, index) => {
            const isCurrent = index === segments.length - 1
            const label = segment.arm ? `Fase ${ARM_LABEL[segment.arm]}` : 'Todo rojo'

            return (
              <li
                key={segment.id}
                aria-current={isCurrent ? 'true' : undefined}
                className="min-w-0 max-w-10 flex-1"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'relative grid h-6 place-items-center overflow-hidden rounded-sm bg-elevated',
                    'animate-phase-fade font-mono text-micro uppercase',
                    isCurrent ? (segment.arm ? 'text-flow' : 'text-secondary') : 'text-muted',
                  )}
                >
                  {segment.arm ? ARM_SHORT[segment.arm] : 'R'}
                  {isCurrent && (
                    <span
                      className={cn(
                        'absolute inset-x-0 bottom-0 h-0.5',
                        segment.arm ? 'bg-flow' : 'bg-lineStrong',
                      )}
                    />
                  )}
                </span>
                <span className="sr-only">{label}</span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
