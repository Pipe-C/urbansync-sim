import { useEffect, useRef, useState } from 'react'

import type { Arm } from '@/simulation/core'
import type { ReadoutEvent } from '@/simulation/events/SimulationEventBus'

/**
 * The junction's recent service sequence, as phase segments.
 *
 * The readout already carries the phase *now*; this keeps the last few changes
 * so the tape under the canvas can show the shape of the controller's choices
 * rather than a single lit cell. It is deliberately a sequence, not a timing
 * chart: the readout arrives four times a second, which is enough to know the
 * order of phases and not enough to claim how long each one lasted.
 *
 * `activeArm` changes are the only thing that appends. `reason` changes inside
 * a phase (a left-turn interlock, a preemption request) update the reason line
 * without inventing a new segment.
 *
 * The local engine runs whether or not the backend run is open, so this tape
 * is not cleared by Stop: stopping ends the measured session, not the scene.
 */

export interface PhaseSegment {
  /** Monotonic within one mount. Stable as a React key. */
  id: number
  /** The arm being served, or `null` during all-red. */
  arm: Arm | null
}

/** Segments kept. Twelve is roughly a minute of adaptive service, which is
 *  enough to see the irregular pattern without turning the tape into a chart. */
const LIMIT = 12

export function usePhaseSequence(readout: ReadoutEvent | null): PhaseSegment[] {
  const [segments, setSegments] = useState<PhaseSegment[]>([])
  const nextId = useRef(0)
  const lastArm = useRef<Arm | null | undefined>(undefined)

  useEffect(() => {
    if (readout === null) {
      return
    }

    const arm = readout.activeArm

    if (lastArm.current === undefined) {
      lastArm.current = arm
      setSegments([{ id: nextId.current++, arm }])
      return
    }

    if (arm === lastArm.current) {
      return
    }

    lastArm.current = arm
    const segment = { id: nextId.current++, arm }
    setSegments((previous) => [...previous, segment].slice(-LIMIT))
  }, [readout])

  return segments
}
