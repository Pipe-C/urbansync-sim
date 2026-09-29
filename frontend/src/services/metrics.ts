import {
  APPROACH_LABELS,
  TICK_SECONDS,
  type Approach,
  type ControlMode,
  type MetricsFrame,
  type StrategyFrame,
} from '@/types/metrics'

/**
 * The mock traffic generator.
 *
 * Every file in this module is prefixed `MOCK_` and every value it returns is
 * labelled as simulated wherever it reaches the screen. The reason is not
 * squeamishness: a dashboard that cannot tell you which numbers are measured and
 * which are invented is a dashboard that has taught its reader not to believe
 * it, and the first real measurement would arrive already discounted.
 *
 * ### Why it is a pure function of the tick index
 *
 * `sample(tick, mode)` has no state. That buys three things:
 *
 * - **Pause is honest.** Stopping the clock stops the numbers, because there is
 *   no accumulator outside the run to drift on. A generator holding its own state
 *   would need a reset path that nothing would remember to call.
 * - **Replay is free.** Phase 5 exports reports from a session; a pure function
 *   means the export is a loop, not a stored blob.
 * - **It is testable.** The comparison the product claims can be asserted on,
 *   not eyeballed: at every tick, adaptive beats fixed on wait time and on
 *   emergency response, and that is a property of the function rather than a
 *   coincidence of the run.
 *
 * ### Why both strategies are always generated
 *
 * The fixed-cycle line is not a control group bolted on for the chart. A fixed
 * signal has to serve every approach on a timer whether or not anyone is
 * waiting, so its wait time carries the full cost of an approach that is empty
 * while the opposite one backs up. The adaptive controller sees the queue and
 * gives the green to the road that has cars on it. That difference is the whole
 * product, and it falls out of the model below rather than being subtracted in.
 */

/** Deterministic value noise in [0, 1). Hash-based, so it is stateless. */
function MOCK_noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function MOCK_clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function MOCK_round(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/**
 * Demand on the junction, normalised around 1.
 *
 * Two sines at incommensurate periods, so the series swells and eases without
 * repeating on a period a viewer can count. A single sine is visibly a sine; the
 * point of this function is to be mistaken for traffic.
 */
function MOCK_demand(elapsedSeconds: number): number {
  const slow = Math.sin(elapsedSeconds / 74)
  const quick = Math.sin(elapsedSeconds / 23 + 1.7)
  return MOCK_clamp(0.62 + 0.3 * slow + 0.2 * quick, 0.15, 1.25)
}

/**
 * Wait time per strategy.
 *
 * Both rise with demand, but the fixed line rises faster and from a higher
 * floor, because a fixed cycle's wait is dominated by how long the red lasts
 * rather than by how many cars are in the queue. The gap is wide — around 40% at
 * mid demand — which is high for a good junction and defensible for an
 * oversaturated one, and it is the gap the product is built to close.
 */
function MOCK_waits(tick: number, demand: number) {
  const jitter = MOCK_noise(tick * 3.11) - 0.5
  return {
    adaptive: MOCK_clamp(11 + 12 * demand + jitter * 2.4, 7, 34),
    fixed: MOCK_clamp(18 + 20 * demand + jitter * 3.6, 15, 58),
  }
}

/**
 * Emergency response.
 *
 * The widest gap in the model, and the one that is not a matter of degree. Under
 * a fixed cycle an emergency vehicle cannot be served until its approach comes
 * round again, so its response time is bounded below by the cycle length no
 * matter how light the traffic is. Pre-emption exists because of that bound, and
 * a model that gave the fixed cycle a merely worse average would understate the
 * reason the feature is in the product at all.
 */
function MOCK_emergency(tick: number, demand: number) {
  const jitter = MOCK_noise(tick * 7.77) - 0.5
  return {
    adaptive: MOCK_clamp(8 + 9 * demand + jitter * 2.2, 5, 24),
    fixed: MOCK_clamp(26 + 34 * demand + jitter * 5, 20, 74),
  }
}

/**
 * One strategy's reading for one window.
 *
 * Throughput is derived from the wait rather than drawn independently, and the
 * two strategies get different saturation curves because they waste green time
 * differently: a fixed cycle hands green to approaches that are empty while the
 * opposite one backs up, so its capacity is lower and it degrades faster. Two
 * independently generated series would contradict each other — high wait and
 * high throughput at the same time — and a reader who spots that stops trusting
 * the whole panel.
 */
function MOCK_frame(strategy: {
  wait: number
  emergency: number
  tick: number
  saturation: { intercept: number; slope: number }
}): StrategyFrame {
  const { wait, emergency, tick, saturation } = strategy
  const jitter = MOCK_noise(tick * 5.19) - 0.5

  return {
    averageWaitSeconds: MOCK_round(wait, 1),
    throughputPerMinute: MOCK_round(
      MOCK_clamp(saturation.intercept - saturation.slope * wait + jitter * 1.8, 18, 72),
      1,
    ),
    emergencyResponseSeconds: MOCK_round(emergency, 1),
    longestQueue: Math.max(1, Math.round(wait / 5.2 + jitter)),
  }
}

/**
 * The queue on each approach.
 *
 * The four are not equal because a real junction's approaches are not equal, and
 * a readout showing the same number four times reads as a placeholder no matter
 * how plausible the number is.
 */
function MOCK_queue(tick: number, demand: number, meanWait: number) {
  const approaches: Approach[] = ['north', 'south', 'east', 'west']

  return approaches.map((approach, index) => {
    // A per-approach weight, stable for the run, so an approach that is busy
    // stays busy instead of reshuffling every tick and reading as noise.
    const weight = 0.6 + MOCK_noise(index * 31.7) * 0.9
    const wobble = 0.85 + MOCK_noise(tick * 2.3 + index * 9.1) * 0.3
    const queued = Math.max(0, Math.round(demand * weight * wobble * 7))

    return {
      approach,
      label: APPROACH_LABELS[approach],
      queued,
      meanWaitSeconds: MOCK_round(meanWait * weight, 1),
    }
  })
}

/** The saturation curves, kept per strategy: a fixed cycle hands green to empty
 *  approaches, so it wastes capacity and degrades faster than the adaptive one. */
const SATURATION = {
  adaptive: { intercept: 74, slope: 0.5 },
  fixed: { intercept: 68, slope: 0.78 },
} satisfies Record<ControlMode, { intercept: number; slope: number }>

/**
 * One strategy's reading at one tick, with no dependency on any other tick.
 *
 * Extracted from `MOCK_sample` because the cumulative count needs to evaluate a
 * single strategy at every previous tick, and calling the composing function
 * from inside itself to get there would be both circular and unreadable.
 */
function MOCK_strategyAt(tick: number, strategy: ControlMode): StrategyFrame {
  const elapsedSeconds = tick * TICK_SECONDS
  const demand = MOCK_demand(elapsedSeconds)
  const waits = MOCK_waits(tick, demand)
  const emergency = MOCK_emergency(tick, demand)

  return MOCK_frame({
    wait: waits[strategy],
    emergency: emergency[strategy],
    tick,
    saturation: SATURATION[strategy],
  })
}

/**
 * Vehicles cleared since the run started, under one strategy.
 *
 * The integral of the throughput curve, not the current rate multiplied by the
 * elapsed time. Those two agree only when the rate never changed, and a total
 * that silently rewrites its own history every time the flow moves is worse than
 * no total: it is a number that counts up and then, on a slower window, counts
 * down. Integrating is O(tick) and the run is bounded, so the cost is a rounding
 * error against the honesty.
 */
function MOCK_cleared(tick: number, strategy: ControlMode): number {
  let total = 0

  for (let step = 1; step <= tick; step += 1) {
    total += (MOCK_strategyAt(step, strategy).throughputPerMinute / 60) * TICK_SECONDS
  }

  return Math.round(total)
}

/**
 * One tick, for the given elapsed time and the strategy the dashboard treats as
 * live. Both strategies are always returned; `mode` only decides which one
 * `vehiclesProcessed` and `congestedShare` are read from.
 */
export function MOCK_sample(tick: number, mode: 'adaptive' | 'fixed'): MetricsFrame {
  const elapsedSeconds = tick * TICK_SECONDS
  const demand = MOCK_demand(elapsedSeconds)

  const adaptive = MOCK_strategyAt(tick, 'adaptive')
  const fixed = MOCK_strategyAt(tick, 'fixed')

  const active = mode === 'adaptive' ? adaptive : fixed

  return {
    adaptive,
    fixed,
    // Integrated over the run, per strategy, so switching the toggle reads the
    // other policy's own total rather than re-labelling this one's.
    vehiclesProcessed: MOCK_cleared(tick, mode),
    congestedShare: MOCK_round(
      MOCK_queue(tick, demand, active.averageWaitSeconds).filter((q) => q.queued > 5).length / 4,
      2,
    ),
    queue: MOCK_queue(tick, demand, active.averageWaitSeconds),
  }
}

/** The state the dashboard shows before a run has started. */
export function MOCK_emptyFrame(): MetricsFrame {
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
    vehiclesProcessed: 0,
    congestedShare: 0,
    queue: approaches.map((approach) => ({
      approach,
      label: APPROACH_LABELS[approach],
      queued: 0,
      meanWaitSeconds: 0,
    })),
  }
}
