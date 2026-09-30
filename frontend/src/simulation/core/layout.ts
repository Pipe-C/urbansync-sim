import { rightOf, type Vec2 } from './vector'

/**
 * The junction, in metres.
 *
 * Everything positional in the simulator is derived from the constants in this
 * file and from nothing else. That is a deliberate inversion of the previous
 * scene, where lane positions were hand-written Tailwind class strings
 * (`left-[38.8%] top-0`) and every geometric relationship had to be re-derived
 * by hand whenever the road moved. A junction is a shape; a shape belongs in
 * code, in one place, expressed once.
 *
 * ### Right-hand traffic
 *
 * Every rule below follows from one decision: traffic drives on the right. On a
 * north–south road, southbound traffic holds the western half and northbound the
 * eastern one; on an east–west road the mirror applies. `rightOf()` in
 * `vector.ts` is where that decision lives, and the lane offsets are measured
 * along it.
 *
 * ### Lane discipline
 *
 * Two lanes per direction, which is what PRODUCT.md commits to, and they are
 * not interchangeable:
 *
 * - **Lane 0, innermost.** Next to the centre line. Left turns and through.
 * - **Lane 1, kerbside.** Next to the kerb. Through and right turns.
 *
 * Restricting turns this way is not decoration. It is what makes the painted
 * lane arrows *mean* something — an arrow in a lane is a statement about which
 * movements that lane can make, and a scene where a car turns right out of the
 * lane marked for left turns contradicts the paint in front of the viewer.
 *
 * ### Right turns land in the kerbside lane of the destination
 *
 * A vehicle turning right crosses the opposing carriageway and arrives on the
 * far side of the road, where the kerb — not the centre line — is the edge it
 * must keep. Left turns do the opposite and arrive on the innermost lane, next
 * to the centre line they are about to cross. Both fall out of the turn targets
 * below rather than being special-cased.
 */

/** Lane width. 3.4 m is a real urban lane; 3.2 m would be tight for a bus. */
export const LANE_WIDTH = 3.4

/** Two per direction, per PRODUCT.md. */
export const LANES_PER_DIRECTION = 2

/** Half the total carriageway: two lanes to each side of the centre line. */
export const ROAD_HALF = LANE_WIDTH * LANES_PER_DIRECTION

/**
 * Half the junction box.
 *
 * Wider than the carriageway, as real junctions are: the corners are filled by
 * the turning radii, not by road. A junction exactly as wide as its approaches
 * would be a crossroads with no room for anyone to turn in.
 */
export const JUNCTION_HALF = 10.4

/**
 * Distance from the stop line back to where vehicles enter the model.
 *
 * Long enough that the entry point sits past `FOG_FAR`, which is the whole
 * point of the number: a vehicle is created somewhere the camera cannot see it
 * and the fog has already swallowed it, so there is no frame in which a car
 * exists at the edge of the world and is therefore no frame in which one can
 * appear out of nowhere.
 */
export const APPROACH_LENGTH = 76

/** Distance from the far edge of the junction box out to where they leave. */
export const EXIT_LENGTH = 84

/**
 * Radius of the rendered ground plane.
 *
 * Chosen so that the spawn and despawn distances above sit *inside* the fog, not
 * inside the frame. A vehicle that is spawned where the camera can see it is a
 * vehicle that appears from nothing, which is the bug this whole model exists to
 * make impossible. Below it, the two guarantees are independent: the vehicle is
 * already at zero contrast against the fog *and* it fades over its first and
 * last few metres. Either alone would do; both together mean a fog change, a
 * camera change or a resize cannot reintroduce a pop.
 */
export const GROUND_RADIUS = 132

/** Where the exponential fog starts eating contrast, and where it is opaque. */
export const FOG_NEAR = 64
export const FOG_FAR = 88

/** Width of a zebra crossing, measured along the road it crosses. */
export const CROSSWALK_WIDTH = 3.2

/** Gap between the stop line and the near edge of the crossing. */
export const CROSSWALK_GAP = 1.6

export type Arm = 'north' | 'east' | 'south' | 'west'
export type Turn = 'through' | 'left' | 'right'
export type LaneIndex = 0 | 1

/** Clockwise from north, as seen from above with `+X` east and `+Z` south. */
export const ARMS: readonly Arm[] = ['north', 'east', 'south', 'west']

/** The arms that face each other. Used for the left-turn conflict test. */
export const OPPOSITE: Record<Arm, Arm> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
}

/**
 * Which arm a vehicle reaches when it turns.
 *
 * Indexed against the clockwise `ARMS` order, and it is worth being careful
 * about because the answer is counterintuitive: a driver coming *down* the
 * screen from the north turns right onto the **west** arm, which is the
 * counter-clockwise neighbour of north, not the clockwise one. Getting this
 * backwards is the single most common way a junction like this ends up with its
 * right turns on the wrong side, and it looks plausible enough in a still to
 * survive a review.
 */
export const RIGHT_TARGET: Record<Arm, Arm> = {
  north: 'west',
  east: 'north',
  south: 'east',
  west: 'south',
}

export const LEFT_TARGET: Record<Arm, Arm> = {
  north: 'east',
  east: 'south',
  south: 'west',
  west: 'north',
}

/** Which arm traffic arrives from while travelling in this direction. */
const INBOUND_AXIS: Record<Arm, Vec2> = {
  north: { x: 0, z: 1 },
  east: { x: -1, z: 0 },
  south: { x: 0, z: -1 },
  west: { x: 1, z: 0 },
}

export const ARM_LABEL: Record<Arm, string> = {
  north: 'Av. Norte',
  east: 'Calle Este',
  south: 'Av. Sur',
  west: 'Calle Oeste',
}

export interface Lane {
  id: string
  arm: Arm
  index: LaneIndex
  /** Unit vector along the direction of travel. */
  axis: Vec2
  /** The lane's constant offset from the junction centre line, as a vector. */
  lateral: Vec2
  /** Where this lane meets the near edge of the junction box. */
  entry: Vec2
  /** Where this lane meets the far edge of the junction box. */
  exit: Vec2
  /** Lanes a vehicle in this lane may take, given the turn discipline above. */
  turns: Turn[]
}

/** Distance of a lane's centre line from the road's centre line. */
function laneOffset(index: LaneIndex): number {
  return LANE_WIDTH * (index + 0.5)
}

function buildLanes(): Lane[] {
  const lanes: Lane[] = []

  for (const arm of ARMS) {
    const axis = INBOUND_AXIS[arm]
    const normal = rightOf(axis)

    for (const index of [0, 1] as LaneIndex[]) {
      const lateral = { x: normal.x * laneOffset(index), z: normal.z * laneOffset(index) }

      lanes.push({
        id: `${arm}-${index}`,
        arm,
        index,
        axis,
        lateral,
        entry: {
          x: lateral.x + axis.x * -JUNCTION_HALF,
          z: lateral.z + axis.z * -JUNCTION_HALF,
        },
        exit: {
          x: lateral.x + axis.x * JUNCTION_HALF,
          z: lateral.z + axis.z * JUNCTION_HALF,
        },
        // The innermost lane cannot turn right without crossing the lane beside
        // it, and the kerbside lane cannot turn left without crossing oncoming
        // traffic from inside the junction. Both restrictions are real, and
        // both are what the painted arrows depict.
        turns: index === 0 ? ['through', 'left'] : ['through', 'right'],
      })
    }
  }

  return lanes
}

export const LANES: readonly Lane[] = buildLanes()

export function laneById(id: string): Lane {
  const lane = LANES.find((candidate) => candidate.id === id)
  if (!lane) {
    throw new Error(`Unknown lane: ${id}`)
  }
  return lane
}

/** The movement a vehicle takes out of its approach and into the junction. */
export interface Movement {
  id: string
  lane: Lane
  turn: Turn
  /** The lane it arrives on, past the junction. */
  destination: Lane
  /** The arm whose approach conflicts with this one: left turns and right turns
   *  both cross it, and it is what the controller tests for before releasing
   *  either. */
  conflictsWith: Arm
  /** True when the movement may only be released into an empty junction. */
  needsClearBox: boolean
  route: Route
}

export function movementId(lane: Lane, turn: Turn): string {
  return `${lane.id}:${turn}`
}

function buildRoute(entry: Vec2, entryAxis: Vec2, exit: Vec2, exitAxis: Vec2): Route {
  // Straight in, straight out, with one connector between them. The connector
  // is a quadratic Bézier whose control point is the intersection of the two
  // tangent lines, which is what makes the car leave the approach square to it
  // and arrive square to the exit. The control point is not "near" the corner,
  // it is exactly on both tangents, and that is the difference between a turn
  // and a diagonal.
  //
  // A straight movement has parallel tangents and so no intersection to find.
  // That is not an error to guard against at runtime: it is the `through` case,
  // and it degenerates cleanly to the entry point itself, which makes the
  // connector a straight line between the two entry points.
  const tangent = tangentParameter(entry, exit, entryAxis, exitAxis)
  const control = tangent === null
    ? { x: entry.x, z: entry.z }
    : { x: entry.x + entryAxis.x * tangent, z: entry.z + entryAxis.z * tangent }

  const samples: RouteSample[] = []
  let travelled = 0
  let previous: Vec2 = {
    x: entry.x + entryAxis.x * -APPROACH_LENGTH,
    z: entry.z + entryAxis.z * -APPROACH_LENGTH,
  }

  pushSample(samples, previous, 0)

  const STEP = 0.45
  const straightIn = Math.ceil(APPROACH_LENGTH / STEP)
  for (let step = 1; step <= straightIn; step += 1) {
    const t = Math.min(step * STEP, APPROACH_LENGTH)
    const point = {
      x: entry.x + entryAxis.x * (-APPROACH_LENGTH + t),
      z: entry.z + entryAxis.z * (-APPROACH_LENGTH + t),
    }
    travelled += pointDistance(previous, point)
    pushSample(samples, point, travelled)
    previous = point
  }

  // The connector, sampled densely. Its length is a chord sum, not the analytic
  // arc length, which is a fraction of a percent low at this density — and it
  // does not matter, because `s` is *defined* as the chord sum. The parameter and
  // the geometry it parameterises are the same number by construction, so there
  // is nothing to drift out of step with.
  const CONNECTOR_STEPS = 72
  let clearedBox = travelled
  for (let step = 1; step <= CONNECTOR_STEPS; step += 1) {
    const t = step / CONNECTOR_STEPS
    const inverse = 1 - t
    const point = {
      x:
        inverse * inverse * entry.x +
        2 * inverse * t * control.x +
        t * t * exit.x,
      z:
        inverse * inverse * entry.z +
        2 * inverse * t * control.z +
        t * t * exit.z,
    }
    travelled += pointDistance(previous, point)
    pushSample(samples, point, travelled)
    previous = point
    clearedBox = travelled
  }

  const straightOut = Math.ceil(EXIT_LENGTH / STEP)
  for (let step = 1; step <= straightOut; step += 1) {
    const t = Math.min(step * STEP, EXIT_LENGTH)
    const point = {
      x: exit.x + exitAxis.x * t,
      z: exit.z + exitAxis.z * t,
    }
    travelled += pointDistance(previous, point)
    pushSample(samples, point, travelled)
    previous = point
  }

  return {
    samples,
    total: travelled,
    /** Front bumper at the stop line. */
    stopS: APPROACH_LENGTH,
    /**
     * Front bumper just clear of the junction box.
     *
     * Read off the sample table rather than computed from a chord approximation.
     * `exitS` is the threshold the controller, the conflict test and the renderer
     * all use to decide whether a vehicle is "in the junction", and an estimate
     * that is a few centimetres out makes the box-clearance interlock release a
     * conflicting movement while a tail is still in the way. It has to be the same
     * number the vehicle's own `s` is measured against, so it comes from the same
     * walk along the route.
     */
    exitS: clearedBox,
  }
}

/** Parameter along the entry tangent at which it meets the exit tangent, or
 *  `null` when the two tangents are parallel and the movement goes straight. */
function tangentParameter(
  entry: Vec2,
  exit: Vec2,
  entryAxis: Vec2,
  exitAxis: Vec2,
): number | null {
  const denominator = entryAxis.x * exitAxis.z - entryAxis.z * exitAxis.x
  if (Math.abs(denominator) < 1e-6) {
    return null
  }
  const deltaX = exit.x - entry.x
  const deltaZ = exit.z - entry.z
  return (deltaX * exitAxis.z - deltaZ * exitAxis.x) / denominator
}

function pointDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

interface RouteSample {
  s: number
  point: Vec2
}

function pushSample(samples: RouteSample[], point: Vec2, s: number): void {
  samples.push({ s, point: { x: point.x, z: point.z } })
}

export interface Route {
  samples: RouteSample[]
  total: number
  stopS: number
  exitS: number
}

/**
 * Position and heading at an arc length along a route.
 *
 * A binary search over a table that is uniform enough that a linear
 * interpolation between the bracketing samples is exact to well under a
 * millimetre. The heading comes from the chord rather than from a tangent, for
 * the same reason, and the vehicle model smooths it again on top — belt,
 * braces, and a chord is already smooth at 0.45 m.
 */
export function sampleRoute(route: Route, s: number): { x: number; z: number; heading: number } {
  const clamped = Math.max(0, Math.min(route.total, s))
  const { samples } = route

  let low = 0
  let high = samples.length - 1
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if ((samples[middle]?.s ?? Infinity) <= clamped) {
      low = middle
    } else {
      high = middle
    }
  }

  const a = samples[low] as RouteSample
  const b = samples[high] ?? a
  const span = b.s - a.s
  const t = span === 0 ? 0 : (clamped - a.s) / span

  const x = a.point.x + (b.point.x - a.point.x) * t
  const z = a.point.z + (b.point.z - a.point.z) * t
  const heading = Math.atan2(b.point.x - a.point.x, b.point.z - a.point.z)

  return { x, z, heading }
}

function buildMovements(): Movement[] {
  const movements: Movement[] = []

  for (const lane of LANES) {
    for (const turn of lane.turns) {
      // Which side of the junction the vehicle leaves on, and which way it is
      // pointing when it gets there. A right turn arrives beside the kerb, a
      // left turn beside the centre line, and going straight keeps the lateral
      // offset the vehicle already had. See the file header for why those three
      // are not the same answer.
      const outboundArm: Arm =
        turn === 'through' ? lane.arm : turn === 'left' ? LEFT_TARGET[lane.arm] : RIGHT_TARGET[lane.arm]
      const destinationIndex: LaneIndex =
        turn === 'through' ? lane.index : turn === 'left' ? 0 : 1

      // The lane a vehicle *joins* is not the lane of the arm it is heading
      // towards, because a lane is defined by the traffic that arrives on it and
      // leaves it. `west-0` is the eastbound carriageway: its entry is the west
      // side of the box and its exit is the east side. So traffic that leaves the
      // junction heading west is the far end of a lane belonging to the *east*
      // arm, and a through movement simply continues along the lane it is
      // already in.
      //
      // Reading `destination` as the lane of the arm being headed towards instead
      // points every turn at a start line behind the car, and the result is a
      // 180° loop through the junction that happens to look like traffic.
      const destination =
        turn === 'through' ? lane : laneById(`${OPPOSITE[outboundArm]}-${destinationIndex}`)
      const route = buildRoute(lane.entry, lane.axis, destination.exit, destination.axis)

      movements.push({
        id: movementId(lane, turn),
        lane,
        turn,
        /** The lane this movement joins at the far side of the junction. */
        destination,
        // Both turns cross the opposing approach. A through movement crosses
        // nothing, because the phase that released it already stopped the road
        // it would have crossed.
        conflictsWith: turn === 'through' ? lane.arm : OPPOSITE[lane.arm],
        // Left turns cut across oncoming traffic from inside the box, so they
        // wait for the opposing approach to be genuinely empty. Right turns
        // cross a road that is already at red, so the cross traffic is stopped
        // at the line and the only thing in the way is a pedestrian who is
        // entitled to be there.
        needsClearBox: turn === 'left',
        route,
      })
    }
  }

  return movements
}

export const MOVEMENTS: readonly Movement[] = buildMovements()

export function movementById(id: string): Movement {
  const movement = MOVEMENTS.find((candidate) => candidate.id === id)
  if (!movement) {
    throw new Error(`Unknown movement: ${id}`)
  }
  return movement
}

/** A zebra crossing, positioned on the approach side of the stop line. */
export interface Crosswalk {
  arm: Arm
  /** Centre of the crossing. */
  centre: Vec2
  /** Unit vector along the direction pedestrians walk across the road. */
  across: Vec2
  /** Unit vector along the road, i.e. the depth of the crossing. */
  along: Vec2
  length: number
}

function buildCrosswalks(): Crosswalk[] {
  return ARMS.map((arm) => {
    const axis = INBOUND_AXIS[arm]
    const distance = -(JUNCTION_HALF + CROSSWALK_GAP + CROSSWALK_WIDTH / 2)

    return {
      arm,
      centre: { x: axis.x * distance, z: axis.z * distance },
      // Pedestrians walk across the carriageway, which is the lateral direction.
      across: rightOf(axis),
      along: axis,
      length: ROAD_HALF * 2,
    }
  })
}

export const CROSSWALKS: readonly Crosswalk[] = buildCrosswalks()
