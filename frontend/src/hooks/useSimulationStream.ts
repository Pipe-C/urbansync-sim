import { useEffect } from 'react'

import { ensureSimulationStream } from '@/services/socket'

/**
 * Connects the run to the backend algorithm, once for the whole app.
 *
 * There is almost nothing here on purpose. The channel's lifetime is the run's,
 * not a screen's — see `services/socket.ts` — so the controller is a module-level
 * subscription and this hook only makes sure it is installed. It holds no cleanup
 * for the same reason: unmounting a page must not close a socket the run still
 * owns, or every trip to `/config` would restart the simulation on the way back.
 *
 * This is what replaced `useSimulationClock`. The clock used to live in the
 * browser and be sampled into the metrics; now the backend owns the clock and the
 * readings, and this hook is the seam that hands both to the stores.
 */
export function useSimulationStream(): void {
  useEffect(() => {
    ensureSimulationStream()
  }, [])
}
