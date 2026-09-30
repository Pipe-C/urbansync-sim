/**
 * Two-dimensional vectors, in metres.
 *
 * The world is flat: the junction is modelled in the XZ plane and Y is only ever
 * the height above the asphalt. So there is no `Vector3` here, and the renderer's
 * own vector type is not allowed to leak into this directory. That separation is
 * the point of `core/` existing at all — the model that decides where a car is
 * has to be runnable, and checkable, without a WebGL context in the process.
 *
 * Axes follow the renderer's screen mapping, because a top-down junction that
 * disagrees with its own camera is a bug that only shows up on screen:
 *
 * ```
 *            -Z  north
 *             |
 *             |
 *  -W west ---+--- east  +X
 *             |
 *             |
 *            +Z  south
 * ```
 *
 * `+X` is east and `+Z` is south, so a viewer looking down the `Y` axis sees a
 * map rather than a mirror of one.
 */

export interface Vec2 {
  x: number
  z: number
}

export function vec2(x: number, z: number): Vec2 {
  return { x, z }
}

export const ZERO: Readonly<Vec2> = { x: 0, z: 0 }

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, z: a.z + b.z }
}

export function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, z: a.z - b.z }
}

export function scale(a: Vec2, factor: number): Vec2 {
  return { x: a.x * factor, z: a.z * factor }
}

export function length(a: Vec2): number {
  return Math.hypot(a.x, a.z)
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/** Rotates a vector a quarter turn clockwise as seen from above, in this axis
 *  convention that is the direction a driver's right hand points.
 *
 *  Heading south `(0, 1)` — down the screen — and this returns `(-1, 0)`, west.
 *  A driver travelling south has west on their right, which is what right-hand
 *  traffic means and it is the one fact the whole lane layout is derived from. */
export function rightOf(a: Vec2): Vec2 {
  return { x: -a.z, z: a.x }
}

export function normalize(a: Vec2): Vec2 {
  const magnitude = Math.hypot(a.x, a.z)
  return magnitude === 0 ? { x: 0, z: 0 } : { x: a.x / magnitude, z: a.z / magnitude }
}

export function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
}

/** Heading in radians, measured so that 0 points east and increases clockwise on
 *  screen. A mesh built pointing down `+Z` is rotated by this to face `dir`, and
 *  the convention is the same one the 2D scene used, so the two do not need
 *  reconciling when one of them goes away. */
export function headingOf(dir: Vec2): number {
  return Math.atan2(dir.x, dir.z)
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/** Shortest signed angular difference, wrapped to `(-π, π]`. Used to ease a
 *  vehicle's heading toward its path tangent: without the wrap, a car crossing
 *  due south would be told to turn through 350° instead of 10°, and the
 *  interpolation would send it the long way round the junction. */
export function angleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) {
    delta -= Math.PI * 2
  }
  if (delta <= -Math.PI) {
    delta += Math.PI * 2
  }
  return delta
}
