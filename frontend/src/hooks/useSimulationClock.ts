import { useEffect } from 'react'

import { useMetricsStore } from '@/store/metricsStore'
import { useSimulationStore } from '@/store/simulationStore'
import { TICK_SECONDS } from '@/types/metrics'

/**
 * The run's only clock.
 *
 * Mounted once, by the dashboard, and it is the sole `setInterval` in the app.
 * That is not tidiness — it is the reason Pause is trustworthy. Two tickers, or
 * one ticker plus a component that samples on its own, would let the metrics and
 * the elapsed clock drift apart, and a dashboard whose two numbers disagree is
 * worse than one that updates slowly.
 *
 * The interval is torn down when the run is not running rather than left running
 * and ignored. A paused tab should not be doing work, and on a laptop on battery
 * that is the difference between a demo that lasts an afternoon and one that
 * does not.
 *
 * ### Why this hook holds no memory of the run
 *
 * The obvious design keeps a `useRef` of the last tick sampled and compares
 * against it. It is wrong here, because this hook unmounts whenever the operator
 * navigates to `/config` while the run keeps its state in the store — and a ref
 * resets to `null` on the way. The first effect after coming back would then read
 * "I have never sampled" and append a duplicate for a tick the chart already
 * holds, producing a spike caused entirely by navigation. The store's
 * `lastSampledTick` is the memory that survives the round trip, so the
 * de-duplication lives next to the data it protects.
 */
export function useSimulationClock(): void {
  const status = useSimulationStore((state) => state.status)
  const tickCount = useSimulationStore((state) => state.tickCount)
  const mode = useSimulationStore((state) => state.mode)

  useEffect(() => {
    if (status !== 'running') {
      return
    }

    const id = window.setInterval(() => {
      useSimulationStore.getState().advance(TICK_SECONDS)
    }, TICK_SECONDS * 1000)

    return () => window.clearInterval(id)
  }, [status])

  useEffect(() => {
    const metrics = useMetricsStore.getState()

    // A stopped run has no window to report, and the store's own counter was
    // cleared with it, so the next run's first tick samples rather than rebases.
    if (tickCount === 0) {
      return
    }

    // Same window, new policy. Recompute the readings but leave the series
    // alone: no time passed, and appending here would put a vertical spike in
    // the chart at the exact moment of the click.
    if (tickCount === metrics.lastSampledTick) {
      metrics.rebase(tickCount, mode)
      return
    }

    // `sample` is idempotent for an already-charted tick, so a remount mid-run
    // refreshes the readings without adding a second point.
    metrics.sample(tickCount, mode)
  }, [tickCount, mode])
}
