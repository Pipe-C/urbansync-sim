import { create } from 'zustand'

import type { ConnectionState } from '@/types/stream'

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

  setConnection: (connection: ConnectionState) => void
  setError: (message: string) => void
  reset: () => void
}

export const useStreamStore = create<StreamState>()((set) => ({
  connection: 'idle',
  error: null,

  setConnection: (connection) => set({ connection }),
  // An error is a connection state: the channel did not work, and the badge says
  // so rather than leaving a stale "live" up beside a message.
  setError: (error) => set({ connection: 'error', error }),
  reset: () => set({ connection: 'idle', error: null }),
}))
