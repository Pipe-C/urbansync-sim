import mitt from 'mitt'

import type { Arm, IntersectionWorld } from '../core'

/**
 * The event bus between the engine, the renderer and React.
 *
 * Three participants with three different clocks want the same data: the runner
 * steps the model, the scene paints it at 60 FPS, and React reads a throttled
 * slice of it a few times a second. Wiring them to each other directly would
 * give the scene a dependency on the store and the store one on WebGL, and the
 * boundary `core/` exists to protect would be gone from both ends. So nobody
 * calls anybody: the runner emits, and whoever is listening listens.
 *
 * Two events, deliberately:
 *
 * - `frame` is the render tick. It carries the world itself rather than a copy
 *   of the vehicles, because a copy at 60 FPS is sixty allocations a second of
 *   data that is already sitting in the model — and because handing over the
 *   reference is what lets the scene notice a reset: a new world is a new
 *   reference, and every pooled mesh is rebuilt from it.
 * - `readout` is the same model at reading speed. React has no business
 *   re-rendering sixty times a second, and a footer that updates four times a
 *   second reads as live without ever being the reason a frame was dropped.
 *
 * The engine never imports this file. It is renderer-facing surface, which is
 * why it lives outside `core/` with the rest of the budget that forbids DOM,
 * `three` and `process`.
 */

/** One rendered frame, straight off the runner's `requestAnimationFrame`. */
export interface FrameEvent {
  /** The live world. A different reference after Stop rewound the model. */
  world: IntersectionWorld
  /** Real seconds since the previous frame. Zero on the first frame after a
   *  mount, so nothing can jump-start an animation on scene construction. */
  delta: number
  /** Seconds the world has spent stepping since it was last created. Drives
   *  the only looping visuals in the scene — the emergency flash and the
   *  preemption pulse — and freezes with Pause, because a paused simulation
   *  that keeps flashing teaches the viewer that Pause is decorative. */
  time: number
}

/** A snapshot of the junction at reading speed, for the DOM. */
export interface ReadoutEvent {
  /** Vehicles queued on each approach, from the model's own definition. */
  queued: Record<Arm, number>
  /** Longest a vehicle has stood still on each approach, in seconds. */
  wait: Record<Arm, number>
  /** Vehicles that have crossed the junction since the model started. */
  served: number
  /** Longest wait anywhere on the junction, in seconds. */
  longestWait: number
  /** True while an emergency vehicle holds or is asking for preemption. */
  preemption: boolean
  /** The controller's own explanation of its current state. */
  reason: string
  /** The arm being served, or `null` during an all-red. */
  activeArm: Arm | null
}

// A type alias, not an interface: mitt constrains its map to
// `Record<EventType, unknown>`, and only object *type* literals receive the
// implicit index signature that satisfies it.
export type SimulationEventMap = {
  frame: FrameEvent
  readout: ReadoutEvent
}

export const simulationBus = mitt<SimulationEventMap>()
