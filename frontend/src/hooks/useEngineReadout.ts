import { useEffect, useState } from 'react'

import { simulationBus, type ReadoutEvent } from '@/simulation/events/SimulationEventBus'
import { getLastReadout } from '@/simulation/runner'

/**
 * The engine's snapshot, at reading speed, for the DOM.
 *
 * React has no business being on the render loop: the runner publishes a
 * `readout` four times a second, and this hook is the only place that listens
 * for it on React's behalf. The state is seeded from the runner's last
 * published value rather than from `null`, so a component mounting mid-run
 * shows real numbers on its first paint instead of a placeholder that flips a
 * frame later — and the effect re-checks after subscription, because a
 * publish landing between render and effect would otherwise be missed
 * entirely.
 *
 * Returns `null` only before the engine has ever published: the honest empty
 * state for a footer that would otherwise have to invent numbers. A publish
 * landing in the frame between render and subscription is not worth a state
 * write inside the effect — it misses at most one interval (250 ms) and the
 * next one corrects it.
 */
export function useEngineReadout(): ReadoutEvent | null {
  const [readout, setReadout] = useState<ReadoutEvent | null>(() => getLastReadout())

  useEffect(() => {
    const onReadout = (event: ReadoutEvent) => setReadout(event)
    simulationBus.on('readout', onReadout)
    return () => simulationBus.off('readout', onReadout)
  }, [])

  return readout
}
