import { io, type Socket } from 'socket.io-client'

import { API_BASE_URL } from '@/services/http'
import { useConfigStore } from '@/store/configStore'
import { useMetricsStore } from '@/store/metricsStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useStreamStore } from '@/store/streamStore'
import { APPROACH_LABELS, type MetricsFrame, type SimulationStatus } from '@/types/metrics'
import type { StreamStatus, TickPayload } from '@/types/stream'

/**
 * The live channel to the backend algorithm, and the controller that drives it.
 *
 * Two layers live here and they are deliberately different shapes:
 *
 * - `openSimulationStream` is the *wire*: it speaks Socket.io, nothing else. It
 *   knows the namespace, the event names and the payloads, and it takes its
 *   handlers as arguments so it can be read and reasoned about without a store
 *   anywhere near it.
 * - `ensureSimulationStream` is the *controller*: a module-level subscription
 *   that watches `simulationStore.status` and opens, pauses or closes the wire
 *   with it. It is module-level rather than a component hook for the same reason
 *   `runner.ts` is: a run's lifetime is the store's, not a screen's. A
 *   component-owned socket would close on every navigation to `/config` and
 *   restart the run on the way back — the run would survive the trip and the
 *   numbers would not.
 *
 * Every number the panel shows comes through here. `tick` feeds both stores: the
 * frame the metrics panel reads and the clock the run advances on. `session_ended`
 * ends the run the same way the Stop button does, so a horizon and a click leave
 * the app in one state. `phase_change` and `evp_activated` arrive too and are
 * acknowledged with a no-op, because the canvas animates the browser engine and
 * nothing on this side reads them yet — but they are named here, so their absence
 * from a handler list is a decision rather than an omission.
 */

/** One message for every way the channel can fail to open. */
const CONNECTION_MESSAGE = 'No se pudo conectar con el canal en vivo. Inténtalo de nuevo.'

/** How long without a tick before a live channel is called stale. The backend
 *  ticks ten a second, so a second and a half of silence is fifteen missed
 *  readings — well past jitter, short of a person giving up. */
const STALE_AFTER_MS = 1500

/** The window p95 is taken over: six seconds of ticks at the backend's rate.
 *  Long enough that one scheduling hiccup does not define the connection, short
 *  enough that the reading follows a real change instead of averaging it away. */
const LATENCY_WINDOW = 60

/** The operator's configuration, in the shape `submit_config` expects. */
export interface StreamConfig {
  quietRatePerMinute: number
  typeWeights: Record<string, number>
  mode: 'adaptive' | 'fixed'
}

/** Where the controller reacts to the wire. All optional to the caller: the
 *  controller supplies them, a test could supply a list. */
export interface SimulationStreamHandlers {
  onConnect: () => void
  onDisconnect: () => void
  onError: (message: string) => void
  onStatus: (status: StreamStatus) => void
  onTick: (tick: TickPayload) => void
  onEnded: (tick: TickPayload) => void
}

export interface SimulationStream {
  submit: (config: StreamConfig) => void
  pause: () => void
  resume: () => void
  stop: () => void
  close: () => void
}

/**
 * Open the socket for one session and return the verbs the controller sends it.
 *
 * The session id travels as connection data (`auth`) so the backend can put the
 * connection in the session's room, and again in every control payload because
 * the schema validates it — the room is a routing detail, not the identity.
 */
export function openSimulationStream(
  sessionId: string,
  handlers: SimulationStreamHandlers,
): SimulationStream {
  const socket: Socket = io(`${API_BASE_URL}/simulation`, { auth: { sessionId } })

  socket.on('connect', handlers.onConnect)
  socket.on('disconnect', handlers.onDisconnect)
  socket.on('connect_error', () => handlers.onError(CONNECTION_MESSAGE))
  socket.on('simulation_status', (status: StreamStatus) => {
    if (status.error) {
      handlers.onError(status.error)
    }
    handlers.onStatus(status)
  })
  socket.on('tick', handlers.onTick)
  socket.on('session_ended', handlers.onEnded)

  return {
    submit: (config) => socket.emit('submit_config', { sessionId, config }),
    pause: () => socket.emit('pause_session', { sessionId }),
    resume: () => socket.emit('resume_session', { sessionId }),
    stop: () => socket.emit('stop_session', { sessionId }),
    close: () => socket.close(),
  }
}

/** A tick payload as the dashboard's own frame: the two strategies as they are,
 *  per-approach labels added, nothing reshaped. */
function toMetricsFrame(tick: TickPayload): MetricsFrame {
  return {
    adaptive: tick.adaptive,
    fixed: tick.fixed,
    vehiclesProcessed: tick.vehiclesProcessed,
    congestedShare: tick.congestedShare,
    queue: tick.queue.map((row) => ({ ...row, label: APPROACH_LABELS[row.approach] })),
  }
}

let installed = false
let stream: SimulationStream | null = null
let staleTimer: number | null = null
let latencies: number[] = []

function clearLatency(): void {
  latencies = []
}

/**
 * Read one-way latency off the tick's `sentAt` and publish the last reading
 * with the window's p95.
 *
 * This assumes the browser and the backend clocks agree, which is true for the
 * demo's shared host and for NTP-synced deployments. A skewed clock shows up as
 * a skewed number rather than being silently corrected; clamping only guards
 * against the server stamp landing a hair in the future, which would otherwise
 * print a negative latency.
 */
function recordLatency(sentAt: number): void {
  const elapsed = Date.now() - sentAt
  if (!Number.isFinite(elapsed)) {
    return
  }

  const reading = Math.max(0, elapsed)
  latencies.push(reading)
  if (latencies.length > LATENCY_WINDOW) {
    latencies.shift()
  }

  const sorted = [...latencies].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1))
  useStreamStore.getState().setLatency({ lastMs: reading, p95Ms: sorted[index] ?? reading })
}

function clearStale(): void {
  if (staleTimer !== null) {
    window.clearTimeout(staleTimer)
    staleTimer = null
  }
}

/** Start the overdue-ticks timer; a live channel that misses its window becomes
 *  stale rather than silently current. */
function armStale(): void {
  clearStale()
  staleTimer = window.setTimeout(() => {
    staleTimer = null
    if (useStreamStore.getState().connection === 'live') {
      useStreamStore.getState().setConnection('stale')
    }
  }, STALE_AFTER_MS)
}

function startRun(): void {
  const sessionId = crypto.randomUUID()
  const streamStore = useStreamStore.getState()
  clearLatency()
  streamStore.reset()
  streamStore.setConnection('connecting')

  stream = openSimulationStream(sessionId, {
    onConnect: () => useStreamStore.getState().setConnection('live'),
    onDisconnect: () => {
      clearStale()
      useStreamStore.getState().setConnection('reconnecting')
    },
    onError: (message) => {
      clearStale()
      useStreamStore.getState().setError(message)
    },
    onStatus: (status) => {
      if (!status.error && status.ticking) {
        useStreamStore.getState().setConnection('live')
      }
    },
    onTick: (tick) => {
      recordLatency(tick.sentAt)
      armStale()
      useMetricsStore.getState().receive(toMetricsFrame(tick), tick.t)
      useSimulationStore.getState().applyTick(tick.tick, tick.t)
    },
    onEnded: (tick) => {
      clearStale()
      useMetricsStore.getState().receive(toMetricsFrame(tick), tick.t)
      useSimulationStore.getState().stop()
    },
  })

  const config = useConfigStore.getState().config
  stream.submit({
    quietRatePerMinute: config.quietRatePerMinute,
    typeWeights: { ...config.typeWeights },
    mode: useSimulationStore.getState().mode,
  })
}

function closeRun(): void {
  clearStale()
  clearLatency()
  stream?.stop()
  stream?.close()
  stream = null
  useStreamStore.getState().reset()
}

function handleStatus(status: SimulationStatus, previous: SimulationStatus): void {
  if (status === 'running' && previous === 'idle') {
    startRun()
  } else if (status === 'running' && previous === 'paused') {
    clearStale()
    stream?.resume()
  } else if (status === 'paused' && previous === 'running') {
    clearStale()
    stream?.pause()
  } else if (status === 'idle' && previous !== 'idle') {
    closeRun()
  }
}

/**
 * Install the controller once. The first console to mount calls this; every call
 * after is a no-op. A run that is already live when this installs is adopted
 * rather than ignored, because a hot reload or a late-mounting route should not
 * orphan a running stream.
 */
export function ensureSimulationStream(): void {
  if (installed) {
    return
  }
  installed = true

  useSimulationStore.subscribe((state, previous) => {
    if (state.status !== previous.status) {
      handleStatus(state.status, previous.status)
    }
  })

  const status = useSimulationStore.getState().status
  if (status !== 'idle') {
    handleStatus(status, 'idle')
  }
}
