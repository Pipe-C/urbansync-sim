import type { Approach, StrategyFrame } from '@/types/metrics'

/**
 * The live stream's vocabulary — what the backend actually puts on the socket.
 *
 * Kept apart from `types/metrics.ts` on purpose. That file describes the
 * dashboard's *shape* of a reading (both strategies, a chart series, an empty
 * state); this one describes the *wire* the reading arrives on, field for field
 * as `backend/app/services/simulation/tick_engine.py` emits it. When the two
 * diverge, the mapping between them is `toMetricsFrame` in `services/socket.ts`
 * and nowhere else.
 */

/** One transmitted tick, exactly the payload the backend sends under `tick`. */
export interface TickPayload {
  /**
   * Wall-clock send time, milliseconds since the epoch, stamped by the server's
   * `_emit` on every event. The socket controller reads one-way latency as
   * `Date.now() - sentAt` and publishes the rolling p95 to the stream store.
   */
  sentAt: number
  /** The backend's own tick index, ten a second. */
  tick: number
  /** Simulated seconds since the run started. The run's only clock now. */
  t: number
  /** Both strategies, always: the comparison is a property of the wire. */
  adaptive: StrategyFrame
  fixed: StrategyFrame
  /** Vehicles cleared so far, per strategy — the toggle reads its own total. */
  vehiclesProcessed: Record<'adaptive' | 'fixed', number>
  /** Approximate share of the four approaches over the congestion threshold. */
  congestedShare: number
  /** Queue and mean wait per approach, for the readout beside the canvas. */
  queue: TickQueueRow[]
}

/** One approach's row in a tick. The label is the frontend's, added when mapped. */
export interface TickQueueRow {
  approach: Approach
  queued: number
  meanWaitSeconds: number
}

/** The body of `simulation_status`: the run's liveness, not a reading of it. */
export interface StreamStatus {
  sessionId?: string | null
  /** A run exists for this session (it may still be paused). */
  ticking?: boolean
  paused?: boolean
  connected?: boolean
  /** Present only when the backend refused the request. */
  error?: string
}

/**
 * The connection's state, distinct from the run's transport state.
 *
 * `SimulationStatus` says what the run is doing (idle / running / paused); this
 * says whether the stream carrying it is alive. Both are shown, because a run can
 * be "running" while its numbers are stale — and a panel that could not tell the
 * two apart would let a dead socket keep reporting as if it were live.
 */
export type ConnectionState = 'idle' | 'connecting' | 'live' | 'stale' | 'reconnecting' | 'error'
