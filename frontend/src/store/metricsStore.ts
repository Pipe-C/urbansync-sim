import { create } from 'zustand'

import {
  APPROACH_LABELS,
  HISTORY_LIMIT,
  TICK_SECONDS,
  type Approach,
  type FlowSample,
  type MetricsFrame,
  type StrategyFrame,
} from '@/types/metrics'
import type { MetricSample } from '@/types/report'

/**
 * The last reading and the series behind the chart.
 *
 * Fed by the live stream now, not by a generator: `receive` is called from
 * `services/socket.ts` with a frame the backend algorithm actually produced, and
 * the store's only job is to hold it and decide when it becomes a new chart point.
 *
 * `frame` is replaced wholesale rather than merged field by field. A partial
 * update is how a dashboard ends up showing a wait time from tick 41 next to a
 * queue length from tick 40, and no amount of typing catches that.
 *
 * None of this is persisted. Metrics from a run that no longer exists are not
 * history, they are decoration.
 */

/** Evidence rows kept per run: an hour of two-second windows. Far below the
 *  backend's 20 000-row batch limit, so a flush is always a single request. */
const SAMPLE_LIMIT = 3_600

/** The state before any reading has arrived: zeros, and a queue of four empty
 *  approaches. Not a measurement — the panel renders dashes until `hasRun`. */
function emptyFrame(): MetricsFrame {
  const blank: StrategyFrame = {
    averageWaitSeconds: 0,
    throughputPerMinute: 0,
    emergencyResponseSeconds: 0,
    longestQueue: 0,
  }

  const approaches: Approach[] = ['north', 'south', 'east', 'west']

  return {
    adaptive: blank,
    fixed: blank,
    vehiclesProcessed: { adaptive: 0, fixed: 0 },
    congestedShare: 0,
    queue: approaches.map((approach) => ({
      approach,
      label: APPROACH_LABELS[approach],
      queued: 0,
      meanWaitSeconds: 0,
    })),
  }
}

export interface MetricsState {
  frame: MetricsFrame
  history: FlowSample[]
  /**
   * The evidence rows the run has accumulated: two per sample window, one per
   * strategy. Captured at the **chart** cadence (one window every
   * `TICK_SECONDS`), not at the tick cadence: a ten-minute run at ten ticks a
   * second would be 12 000 rows of near-identical readings, and a report is
   * evidence, not a trace.
   *
   * The cap is 3 600 rows — an hour of windows. It is deliberately far below the
   * backend's 20 000-row batch limit, so a flush is always one request.
   */
  samples: MetricSample[]
  /** True once at least one reading exists, which is what separates the empty
   *  state from a run whose first window happens to read zero. */
  hasRun: boolean
  /**
   * The last sample window that reached the history, or 0 if none has.
   *
   * Kept in the store rather than anywhere near the consumer because the stream
   * keeps arriving across a navigation to `/config` and back, while a component
   * does not. The run's own memory of what it has already plotted is the only
   * thing that survives both a remount and a page reload.
   */
  lastSampledTick: number

  /**
   * Take one live reading: replace the frame, and append a chart point and its
   * evidence rows when the reading crosses into a new sample window.
   *
   * The backend ticks ten times a second; the chart is drawn from one point every
   * `TICK_SECONDS`, so the headline numbers move fast while the series stays
   * readable. `lastSampledTick` holds the window index, not the backend tick, so
   * the two cadences stay separate.
   *
   * `tick` is the backend's tick index for this reading. It is stamped onto the
   * evidence rows so a report can be joined back to the run's own clock; when it
   * is absent the window index stands in, which is unique per window but a
   * different unit — callers either always pass it or never do.
   */
  receive: (frame: MetricsFrame, elapsedSeconds: number, tick?: number) => void
  /** Clears everything. Called when the run stops, never on a pause. */
  reset: () => void
}

/** One strategy's row of a window's evidence, in the API's own field names. */
function toSamples(frame: MetricsFrame, tick: number, t: number): MetricSample[] {
  return (['adaptive', 'fixed'] as const).map((strategy) => ({
    tick,
    t,
    strategy,
    averageWaitSeconds: frame[strategy].averageWaitSeconds,
    throughputPerMinute: frame[strategy].throughputPerMinute,
    emergencyResponseSeconds: frame[strategy].emergencyResponseSeconds,
    longestQueue: frame[strategy].longestQueue,
  }))
}

export const useMetricsStore = create<MetricsState>()((set) => ({
  frame: emptyFrame(),
  history: [],
  samples: [],
  hasRun: false,
  lastSampledTick: 0,

  receive: (frame, elapsedSeconds, tick) => {
    const window = Math.floor(elapsedSeconds / TICK_SECONDS)

    set((state) => {
      // Same window: the numbers advance, the series does not. Appending here
      // would put several points at the same instant on the x-axis, and several
      // rows of the same window into a report.
      if (window === state.lastSampledTick) {
        return { frame, hasRun: true }
      }

      const sampledAt = window * TICK_SECONDS

      return {
        frame,
        hasRun: true,
        lastSampledTick: window,
        history: [
          ...state.history,
          {
            t: sampledAt,
            adaptive: frame.adaptive.throughputPerMinute,
            fixed: frame.fixed.throughputPerMinute,
          },
        ].slice(-HISTORY_LIMIT),
        samples: [...state.samples, ...toSamples(frame, tick ?? window, sampledAt)].slice(
          -SAMPLE_LIMIT,
        ),
      }
    })
  },

  reset: () =>
    set({
      frame: emptyFrame(),
      history: [],
      samples: [],
      hasRun: false,
      lastSampledTick: 0,
    }),
}))
