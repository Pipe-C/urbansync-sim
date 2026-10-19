import { create } from 'zustand'

import type { ConnectionState } from '@/types/stream'

/**
 * One-way latency over the recent tick window, in milliseconds.
 *
 * `lastMs` is the tick that just arrived; `p95Ms` is the tail of the last
 * sixty, which is the reading that says whether the console still feels live.
 * Computed in the socket controller, next to the `sentAt` stamps it reads.
 */
export interface LatencyReading {
  lastMs: number
  p95Ms: number
}

/**
 * Whether the live channel is alive, and why it is not.
 *
 * Separate from `simulationStore` because it answers a different question. That
 * store says what the run is doing; this one says whether the numbers on screen
 * are still arriving. They are not the same state and must not share a field: a
 * run can be `running` while the channel is `stale`, and a panel that folded the
 * two together would have to choose which truth to hide.
 *
 * Not persisted, like every other transport state here: a connection that
 * survived a reload would be a claim about a socket that no longer exists.
 */
export interface StreamState {
  connection: ConnectionState
  /** The message the backend refused a run with, if it did. */
  error: string | null
  /** Null until the first tick of the current run arrives. */
  latency: LatencyReading | null

  setConnection: (connection: ConnectionState) => void
  setError: (message: string) => void
  setLatency: (latency: LatencyReading) => void
  reset: () => void
}

export const useStreamStore = create<StreamState>()((set) => ({
  connection: 'idle',
  error: null,
  latency: null,

  setConnection: (connection) => set({ connection }),
  // An error is a connection state: the channel did not work, and the badge says
  // so rather than leaving a stale "live" up beside a message.
  setError: (error) => set({ connection: 'error', error }),
  setLatency: (latency) => set({ latency }),
  // The reading belongs to the run, not the connection: a new run starts with no
  // latency history, and a closed socket must not leave the last one on screen.
  reset: () => set({ connection: 'idle', error: null, latency: null }),
}))
