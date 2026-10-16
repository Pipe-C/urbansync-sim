import { create } from 'zustand'

import { useMetricsStore } from '@/store/metricsStore'
import { useSessionsStore } from '@/store/sessionsStore'
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
  /** The backend's tick index for the run. Its clock, not a window count. */
  tickCount: number
  /** When the current run began, ISO. Null until the first start of a run. */
  startedAt: string | null

  start: () => void
  pause: () => void
  /** Stops, rewinds, and files the run in the local session log. */
  stop: () => void
  setMode: (mode: ControlMode) => void
  /** Called by the stream, never by a component: the backend tick and its
   *  simulated second, so the run's clock and its readings move together. */
  applyTick: (tick: number, elapsedSeconds: number) => void
}

export const useSimulationStore = create<SimulationState>()((set, get) => ({
  status: 'idle',
  mode: 'adaptive',
  elapsedSeconds: 0,
  tickCount: 0,
  startedAt: null,

  // Resuming a paused run continues it; starting a stopped one begins over. The
  // two are different intents, but both are just "make it run", and the reset
  // lives in `stop` where it cannot be forgotten. `startedAt` is stamped on the
  // idle-to-running edge, so a pause-resume does not rewrite the run's origin.
  start: () =>
    set((state) => ({
      status: 'running',
      startedAt: state.status === 'idle' ? new Date().toISOString() : state.startedAt,
    })),

  pause: () => set((state) => (state.status === 'running' ? { status: 'paused' } : state)),

  /**
   * Stops, rewinds, files the run, and clears the readings with it.
   *
   * The metrics reset lives here rather than in the button that calls this,
   * because "the run is over, the numbers on screen describe a run that no
   * longer exists" is an invariant of the run, not of one control. A caller that
   * stopped the run without clearing them would leave a dashboard reporting the
   * final tick of a dead simulation as if it were current.
   *
   * The session record is taken *before* the reset, from the same frame the
   * dashboard was showing — and only when the run produced at least one sample,
   * because a run stopped before its first window is a run with nothing to
   * report, and filing it would put a zero-duration session in the history.
   */
  stop: () => {
    const { tickCount, mode, elapsedSeconds, startedAt } = get()
    const metrics = useMetricsStore.getState()

    if (tickCount > 0 && metrics.hasRun) {
      useSessionsStore.getState().record({
        startedAt: startedAt ?? new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationSeconds: elapsedSeconds,
        tickCount,
        mode,
        adaptive: metrics.frame.adaptive,
        fixed: metrics.frame.fixed,
        vehiclesProcessed: metrics.frame.vehiclesProcessed[mode],
      })
    }

    metrics.reset()
    set({ status: 'idle', elapsedSeconds: 0, tickCount: 0, startedAt: null })
  },

  // Switching policy mid-run is allowed and is the point of the toggle: the same
  // traffic, interrogated under a different controller. The generator integrates
  // the vehicle count per strategy, so each policy reads back its own total
  // rather than this one's being relabelled.
  setMode: (mode) => set({ mode }),

  // The backend's own reading of the clock, adopted wholesale. A paused run
  // receives nothing, so the elapsed time freezes with it — which is what makes
  // Pause mean the same thing to the panel as it does to the junction.
  applyTick: (tick, elapsedSeconds) =>
    set((state) => (state.status === 'running' ? { tickCount: tick, elapsedSeconds } : state)),
}))
