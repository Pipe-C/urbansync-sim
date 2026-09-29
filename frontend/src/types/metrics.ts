/**
 * The measured quantities the dashboard reports.
 *
 * Every field here is a claim the product makes about traffic, so each one is
 * modelled per control strategy rather than as a single value. The product's
 * thesis is that adaptive control beats a fixed cycle, and a dashboard that
 * reported one number at a time would hide the only comparison that matters.
 */

/** Which policy is driving the junction right now. */
export type ControlMode = 'adaptive' | 'fixed'

/** Transport state of the run itself, independent of `ControlMode`. */
export type SimulationStatus = 'idle' | 'running' | 'paused'

export type Approach = 'north' | 'south' | 'east' | 'west'

/**
 * What one strategy is doing over one sample window.
 *
 * These four move together and are modelled together on purpose: a controller
 * that shortens the wait by letting the queue grow has not improved anything,
 * and generating them independently would produce exactly that lie.
 */
export interface StrategyFrame {
  /** Mean seconds a vehicle spends stationary, across all four approaches. */
  averageWaitSeconds: number
  /** Vehicles cleared per minute. */
  throughputPerMinute: number
  /** Seconds from an emergency vehicle arriving at the stop line to clearing. */
  emergencyResponseSeconds: number
  /** Longest single queue, in vehicles, on any approach. */
  longestQueue: number
}

/** One sample of the run, for the flow chart. */
export interface FlowSample {
  /** Seconds since the run started. */
  t: number
  adaptive: number
  fixed: number
}

/** Queue length and mean wait per approach, for the readout beside the canvas. */
export interface ApproachQueue {
  approach: Approach
  label: string
  queued: number
  meanWaitSeconds: number
}

/**
 * One tick's worth of everything.
 *
 * Both strategies are always present. The mode toggle does not generate a
 * different world; it changes which of the two readings the dashboard treats as
 * the live one, which is what makes the toggle worth having — the same traffic,
 * interrogated under a different policy.
 */
export interface MetricsFrame {
  adaptive: StrategyFrame
  fixed: StrategyFrame
  /** Vehicles cleared since the run started, under the active strategy. */
  vehiclesProcessed: number
  /** Share of approaches currently holding more than five vehicles. */
  congestedShare: number
  queue: ApproachQueue[]
}

export const APPROACH_LABELS: Record<Approach, string> = {
  north: 'Av. Norte',
  south: 'Av. Sur',
  east: 'Calle Este',
  west: 'Calle Oeste',
}

/** Sample window. Matches the report cadence a control room would actually use. */
export const TICK_SECONDS = 2

/** Points kept in the chart. 40 samples is 80 seconds of run, which is the window
 *  long enough to show the fixed cycle's peak-and-trough rhythm and the adaptive
 *  controller flattening it, and short enough that the axis stays readable. */
export const HISTORY_LIMIT = 40
