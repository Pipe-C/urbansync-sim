import { create } from 'zustand'

import { useMetricsStore } from '@/store/metricsStore'
import type { ControlMode, SimulationStatus } from '@/types/metrics'

/**
 * The run's transport state: is it going, and under which policy.
 *
 * Deliberately not persisted. A traffic simulation that resumed itself mid-run on
 * reload, with metrics from a clock that stopped when the tab closed, would be
 * reporting numbers it could not account for. Reopening the console gives you a
 * stopped run, which is the truth.
 */
export interface SimulationState {
  status: SimulationStatus
  mode: ControlMode
  /** Simulated seconds since the run started. Advances only while running. */
  elapsedSeconds: number
  /** Completed sample windows. The generator's input, and the only clock there is. */
  tickCount: number

  start: () => void
  pause: () => void
  /** Stops and rewinds. The next `start` begins a new run from zero. */
  stop: () => void
  setMode: (mode: ControlMode) => void
  /** Called by the ticker, never by a component. */
  advance: (seconds: number) => void
}

export const useSimulationStore = create<SimulationState>()((set) => ({
  status: 'idle',
  mode: 'adaptive',
  elapsedSeconds: 0,
  tickCount: 0,

  // Resuming a paused run continues it; starting a stopped one begins over. The
  // two are different intents, but both are just "make it run", and the reset
  // lives in `stop` where it cannot be forgotten.
  start: () => set({ status: 'running' }),

  pause: () => set((state) => (state.status === 'running' ? { status: 'paused' } : state)),

  /**
   * Stops and rewinds, and clears the readings with it.
   *
   * The metrics reset lives here rather than in the button that calls this,
   * because "the run is over, the numbers on screen describe a run that no
   * longer exists" is an invariant of the run, not of one control. A caller that
   * stopped the run without clearing them would leave a dashboard reporting the
   * final tick of a dead simulation as if it were current.
   */
  stop: () => {
    useMetricsStore.getState().reset()
    set({ status: 'idle', elapsedSeconds: 0, tickCount: 0 })
  },

  // Switching policy mid-run is allowed and is the point of the toggle: the same
  // traffic, interrogated under a different controller. The generator integrates
  // the vehicle count per strategy, so each policy reads back its own total
  // rather than this one's being relabelled.
  setMode: (mode) => set({ mode }),

  advance: (seconds) =>
    set((state) =>
      state.status === 'running'
        ? {
            elapsedSeconds: state.elapsedSeconds + seconds,
            tickCount: state.tickCount + 1,
          }
        : state,
    ),
}))
