import {
  DEFAULT_BASE_RATE,
  DEFAULT_PEAK_RATE,
  IntersectionWorld,
  LANES,
  type Arm,
  type VehicleKind,
  type WorldOptions,
} from './core'
import { simulationBus, type FrameEvent, type ReadoutEvent } from './events/SimulationEventBus'
import { useConfigStore } from '@/store/configStore'
import { useSimulationStore } from '@/store/simulationStore'
import type { SimulationConfig } from '@/types/config'
import type { SimulationStatus } from '@/types/metrics'

/**
 * The runner: one `requestAnimationFrame` loop, one world, no second clock.
 *
 * Everything hard about this file is a boundary statement:
 *
 * - **The renderer reads; the runner steps; `core/` decides.** The model owns
 *   the physics and clamps its own `dt` to 1/20 s, so a backgrounded tab that
 *   hands back a delta of thirty seconds advances the junction by fifty
 *   milliseconds and not by a pile-up. This loop's only arithmetic on time is
 *   the clamp it needs to speak seconds at all.
 * - **One loop for the whole app.** React components mount and unmount — the
 *   canvas lives on the dashboard and the observer route, and StrictMode mounts
 *   everything twice in development — so the loop is reference-counted rather
 *   than owned by a component. The world, meanwhile, outlives its mounts:
 *   navigating away stops painting, and coming back resumes the same junction
 *   instead of silently starting a new one behind the operator's back.
 * - **Preview at idle, freeze at pause.** The junction is already running when
 *   the console opens, which is the argument the login screen makes: a scene
 *   that only moves after you press Start cannot show you what Start is for.
 *   Pause is the one state that means "stop the world", and Stop — which is
 *   only reachable once a run has happened — rewinds it: crossing back into
 *   `idle` replaces the world with a fresh one, on the same seed and the
 *   operator's current configuration, so the next run begins from the same
 *   junction the first one did, under the parameters now on screen.
 * - **Two cadences.** `frame` goes out at refresh rate because the scene paints
 *   at refresh rate; `readout` goes out four times a second because the DOM
 *   does not, and a footer re-rendering sixty times a second is a dropped frame
 *   waiting to happen. The model is identical in both — there is exactly one
 *   source of truth, sampled at two speeds.
 */

/** How often the DOM-facing snapshot is published, in seconds. */
const READOUT_INTERVAL = 0.25

/** Ceiling on the delta passed to the model, in seconds. The world clamps
 *  harder still (1/20 s); this only bounds the value the render animations see. */
const MAX_FRAME_DELTA = 0.25

let world: IntersectionWorld | null = null
let lastReadout: ReadoutEvent | null = null

let handle: number | null = null
let lastFrameAt = 0
let previousStatus: SimulationStatus = 'idle'
let time = 0
let readoutIn = 0
let mounts = 0

/**
 * The operator's quiet-point rate becomes the model's whole demand curve.
 *
 * One slider describes the junction at its calmest, and the peak follows by the
 * fleet's own quiet-to-peak relationship (`DEFAULT_PEAK_RATE` over
 * `DEFAULT_BASE_RATE` in `core/`), because the model never runs at a single
 * rate — pinning one would give the operator a number the junction only briefly
 * obeys. Police are deliberately absent: their share of the stream is the
 * fleet's, not the operator's.
 */
function toWorldOptions(config: SimulationConfig): WorldOptions {
  const quietPerLane = config.quietRatePerMinute / 60 / LANES.length
  const peakRatio = DEFAULT_PEAK_RATE / DEFAULT_BASE_RATE
  const typeWeights: Partial<Record<VehicleKind, number>> = { ...config.typeWeights }

  return {
    baseRate: quietPerLane,
    peakRate: quietPerLane * peakRatio,
    typeWeights,
  }
}

/** A fresh junction on the configuration as it stands right now. */
function buildWorld(): IntersectionWorld {
  time = 0
  return new IntersectionWorld(toWorldOptions(useConfigStore.getState().config))
}

// A saved configuration rebuilds an idle junction immediately, and a running
// one on the next stop — which already rebuilds from the current config. The
// subscription lives at module scope rather than in a component, because the
// operator edits the configuration on `/config` while no canvas is mounted,
// and the world that comes back has to be the new one.
let watchedConfigRevision = useConfigStore.getState().revision
useConfigStore.subscribe((state) => {
  if (state.revision === watchedConfigRevision) {
    return
  }
  watchedConfigRevision = state.revision

  if (world !== null && useSimulationStore.getState().status === 'idle') {
    world = buildWorld()
    publishReadout(world)
  }
})

/**
 * Joins the loop, and returns the handle that leaves it.
 *
 * The first mount starts the loop and publishes the junction as it stands, so
 * a consumer that subscribes a moment later still gets a first reading on the
 * next interval rather than staring at an empty footer. The last unmount stops
 * it: a tab that is not showing the junction has no business stepping one.
 */
export function acquireSimulationRunner(): () => void {
  mounts += 1

  if (handle === null) {
    lastFrameAt = 0
    previousStatus = useSimulationStore.getState().status
    publishReadout(ensureWorld())
    handle = requestAnimationFrame(tick)
  }

  return () => {
    mounts = Math.max(0, mounts - 1)
    if (mounts === 0 && handle !== null) {
      cancelAnimationFrame(handle)
      handle = null
    }
  }
}

/** The most recent snapshot, for a consumer whose state outlives its
 *  subscription — React state initialised before the runner's first publish. */
export function getLastReadout(): ReadoutEvent | null {
  return lastReadout
}

/**
 * The junction as it stands, as one frame, for a scene mounting between them.
 *
 * While the world is paused the loop keeps running but publishes nothing, so a
 * canvas that mounts at that moment — navigating to the observer route with a
 * paused run — would wait for a frame that is never coming. This is the
 * catch-up: same world, zero delta, so the one-off paint cannot advance
 * anything.
 */
export function getRunnerFrame(): FrameEvent | null {
  if (world === null) {
    return null
  }
  return { world, delta: 0, time }
}

function ensureWorld(): IntersectionWorld {
  if (world === null) {
    world = buildWorld()
  }
  return world
}

function tick(now: number): void {
  handle = requestAnimationFrame(tick)

  const status = useSimulationStore.getState().status
  const delta = lastFrameAt === 0 ? 0 : Math.min((now - lastFrameAt) / 1000, MAX_FRAME_DELTA)
  lastFrameAt = now

  // Stop rewinds. The transition is detected here rather than in the store's
  // `stop` action because the reset belongs to the thing that owns the model:
  // a store action that reached into the simulation would make the store a
  // second writer of simulation state, and there is only supposed to be one.
  if (status === 'idle' && previousStatus !== 'idle') {
    world = buildWorld()
    publishReadout(world)
  }
  previousStatus = status

  if (status !== 'paused') {
    world = ensureWorld()
    world.step(delta)
    time += delta
    simulationBus.emit('frame', { world, delta, time })
  }

  readoutIn -= delta
  if (readoutIn <= 0) {
    readoutIn = READOUT_INTERVAL
    publishReadout(ensureWorld())
  }
}

/**
 * Publishes the junction at reading speed.
 *
 * `summary()` already answers for the queues and the controller's message; the
 * per-approach wait is derived here from the same vehicles, using the same
 * `s < stopS` test the queue count uses, so the two numbers in one footer cell
 * can never disagree about which vehicles they are describing.
 */
function publishReadout(current: IntersectionWorld): void {
  const summary = current.summary()
  const wait: Record<Arm, number> = { north: 0, east: 0, south: 0, west: 0 }

  for (const vehicle of current.vehicles) {
    if (vehicle.s < vehicle.movement.route.stopS && vehicle.waited > wait[vehicle.lane.arm]) {
      wait[vehicle.lane.arm] = vehicle.waited
    }
  }

  lastReadout = {
    queued: summary.queued,
    wait,
    served: summary.served,
    longestWait: summary.longestWait,
    preemption: summary.preemption,
    reason: summary.reason,
    activeArm: summary.activeArm,
  }

  simulationBus.emit('readout', lastReadout)
}
