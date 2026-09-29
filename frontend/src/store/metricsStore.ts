import { create } from 'zustand'

import { MOCK_emptyFrame, MOCK_sample } from '@/services/metrics'
import { HISTORY_LIMIT, TICK_SECONDS, type FlowSample, type MetricsFrame } from '@/types/metrics'

/**
 * The last sample and the series behind the chart.
 *
 * `frame` is replaced wholesale rather than merged field by field. A partial
 * update is how a dashboard ends up showing a wait time from tick 41 next to a
 * queue length from tick 40, and no amount of typing catches that.
 *
 * Like the simulation store, none of this is persisted. Metrics from a run that
 * no longer exists are not history, they are decoration.
 */
export interface MetricsState {
  frame: MetricsFrame
  history: FlowSample[]
  /** True once at least one sample exists, which is what separates the empty
   *  state from a run whose first window happens to read zero. */
  hasRun: boolean
  /**
   * The last tick that reached the history, or 0 if none has.
   *
   * Kept in the store rather than in a `useRef` in the clock hook because the
   * hook unmounts when the operator leaves for `/config` and remounts on return,
   * while the run keeps its state. A ref would come back as `null` and the first
   * effect after remounting would append a second point for a tick already
   * charted — a spurious spike in the series, caused by nothing the viewer did.
   * The run's own memory of what it has already plotted is the only thing that
   * survives both a remount and a page reload.
   */
  lastSampledTick: number

  /** Replaces the current sample and appends to the chart, unless this tick is
   *  already the newest point — in which case it is a no-op. */
  sample: (tick: number, mode: 'adaptive' | 'fixed') => void
  /**
   * Recomputes the current sample under a different policy without touching the
   * history. Switching mode has to move the headline numbers immediately — a
   * toggle that leaves the panel showing the old strategy's readings feels
   * broken — but it must not append a point, because no time passed and the
   * chart would show a vertical jump at the moment of the click.
   */
  rebase: (tick: number, mode: 'adaptive' | 'fixed') => void
  /** Clears everything. Called when the run stops, never on a pause. */
  reset: () => void
}

export const useMetricsStore = create<MetricsState>()((set) => ({
  frame: MOCK_emptyFrame(),
  history: [],
  hasRun: false,
  lastSampledTick: 0,

  sample: (tick, mode) => {
    const frame = MOCK_sample(tick, mode)

    set((state) => {
      // A tick already at the head of the series has been charted. Re-appending
      // it is the remount case, and it would put two points at the same instant
      // on the x-axis with nothing between them.
      if (tick === state.lastSampledTick) {
        return { frame }
      }

      return {
        frame,
        hasRun: true,
        lastSampledTick: tick,
        history: [
          ...state.history,
          {
            t: tick * TICK_SECONDS,
            adaptive: frame.adaptive.throughputPerMinute,
            fixed: frame.fixed.throughputPerMinute,
          },
        ].slice(-HISTORY_LIMIT),
      }
    })
  },

  // Deliberately does not touch `lastSampledTick`: no point was added, so the
  // newest charted tick is still the newest charted tick.
  rebase: (tick, mode) =>
    set((state) => ({
      frame: MOCK_sample(tick, mode),
      hasRun: state.hasRun || tick > 0,
    })),

  reset: () => set({ frame: MOCK_emptyFrame(), history: [], hasRun: false, lastSampledTick: 0 }),
}))
