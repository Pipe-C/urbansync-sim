import * as THREE from 'three'

import {
  ARMS,
  CROSSWALKS,
  CROSSWALK_WIDTH,
  GROUND_RADIUS,
  JUNCTION_HALF,
  LANES,
  LANE_WIDTH,
  MOVEMENTS,
  ROAD_HALF,
  STOP_LINE_DISTANCE,
  type Arm,
  type Lane,
  type Turn,
  type Vec2,
} from '../../core'

/**
 * The road, built from `layout.ts` and from nothing else.
 *
 * Every number below is either imported from the model or a measurement of
 * paint — dash pitch, stripe width, kerb highlight. There is no lane offset
 * here, no stop-line position and no crossing width that someone chose: the
 * model already owns the geometry of the junction, and a renderer that kept
 * its own copy of it would drift and start lying about where the lanes are.
 * The two definitions of "inside the box" that deadlocked the engine for a
 * whole session were the same failure, one file earlier.
 *
 * The paint is unlit (`MeshBasicMaterial`) while the ground is too. That is not
 * a shortcut: the surface ramp — Console Black asphalt, Surface Navy pavement,
 * a one-step-lighter kerb — has to survive into WebGL as the exact tokens
 * `DESIGN.md` specifies, and a light multiplying them turns near-black into
 * grey-blue. Lit geometry is reserved for things that should read as objects
 * standing on the road: vehicles, walkers, signal posts.
 */

/** Console Black. Asphalt, the background and the fog are the same colour, so
 *  the far end of every road dissolves instead of ending. */
const ASPHALT = '#070B14'
/** Surface Navy — one tonal step up, which is the whole kerb/ramp system. */
const PAVEMENT = '#0D1420'
/** Elevated Slate: the hairline that says where the carriageway stops. */
const KERB = '#131C2B'
/** Secondary Text, dimmed: road markings are visible but never bright. */
const PAINT = '#93A3BC'

/** Paint sits a centimetre above the surface it is on, and the junction box a
 *  centimetre above the two ribbons that cross inside it — three planes that
 *  overlap by construction and must not flicker about which one is in front. */
const ROAD_Y = 0.011
const JUNCTION_Y = 0.021
const MARKING_Y = 0.041

/** The ribbons run to the rim of the ground disc. Their far ends are past the
 *  fog and painted in the fog's own colour, so neither the end cap nor the
 *  horizon can be seen to stop. */
const ROAD_LENGTH = GROUND_RADIUS * 2
const ROAD_HALF_LENGTH = GROUND_RADIUS

/** Lane paint: 2,4 m laid, 3,6 m gap — the urban standard, and long enough
 *  that the rhythm reads as lane paint rather than as a dotted border. */
const DASH_LENGTH = 2.4
const DASH_GAP = 3.6
const DASH_PITCH = DASH_LENGTH + DASH_GAP
const LINE_WIDTH = 0.16
const STOP_LINE_WIDTH = 0.45

/** Lane arrows: positions along the approach where road arrows are painted.
 *
 *  Placed dead-centre in each lane as unified combination or directional markings
 *  (as in standard civil engineering: MUTCD / European 8.2-IC).
 *
 *  We lay two markings per approach lane:
 *  1. Primary arrow (9.5 m behind stop line): legible just behind a 1-2 car queue.
 *  2. Advance confirmation arrow (28 m behind stop line): visible to approaching
 *     traffic before committing to a lane, well within the fog horizon. */
const ARROW_PRIMARY_BACK = STOP_LINE_DISTANCE + 9.5
const ARROW_ADVANCE_BACK = STOP_LINE_DISTANCE + 28.0

/** Zebra geometry, laid the way a continental crossing is.
 *
 *  Each bar runs *along* the road — parallel to the traffic it must be seen
 *  from — and repeats across the carriageway, which is the orientation a driver
 *  reads as a crossing. Bars laid the other way (spanning the road, stacked
 *  toward the driver) read as a ladder lying across the asphalt, and on this
 *  three-quarter camera they came out as a set of horizontal stripes sitting on
 *  a diagonal road. A 0,4 m bar with 0,8 m beside it is the standard pitch. */
const ZEBRA_BAR = 0.4
const ZEBRA_GAP = 0.8
const ZEBRA_PITCH = ZEBRA_BAR + ZEBRA_GAP

/** Turning guides: the dotted line a real junction paints through the box to
 *  say where each turn goes. They are the only paint *inside* the junction, and
 *  they exist because the box is otherwise a blank square — which is exactly how
 *  a turning car came to look like one drifting diagonally across nothing. A
 *  0,9 m dash with 0,6 m between, in the dim guidance tier. */
const GUIDE_DASH = 0.9
const GUIDE_PITCH = 1.5
/** How far inside the box a guide is painted, so it stops at the junction edge
 *  instead of running out onto the approach. */
const GUIDE_INSET = JUNCTION_HALF - 0.9

const KERB_WIDTH = 0.16

/** Paint tiers. Dashes are guidance and stay dim; the markings a driver must
 *  obey — stop lines and crossings — wear the bright tier. A zebra that reads
 *  as fainter than the lane divider beside it is a crossing the eye skips, and
 *  browser verification caught exactly that at the old 0,4. */
const LINE_OPACITY = { dim: 0.5, bright: 0.85, zebra: 0.85 }

export interface ApproachFrame {
  /** Unit vector along the direction of travel on this approach. */
  axis: Vec2
  /** Unit vector pointing at the approaching driver's right hand. */
  right: Vec2
}

/**
 * The approach's frame, read back from a lane rather than re-derived.
 *
 * `layout.ts` measures every lane offset along `rightOf(axis)`, so normalising
 * a lane's lateral recovers exactly that vector — the scene asks the model
 * which side is the driver's right instead of computing an answer of its own
 * that could one day disagree with it.
 */
export function approachFrame(arm: Arm): ApproachFrame {
  const lane = approachLane(arm)
  const magnitude = Math.hypot(lane.lateral.x, lane.lateral.z)

  return {
    axis: lane.axis,
    right: { x: lane.lateral.x / magnitude, z: lane.lateral.z / magnitude },
  }
}

function approachLane(arm: Arm): Lane {
  // `LANES` builds two lanes per arm by construction, so this cannot miss.
  const lane = LANES.find((candidate) => candidate.arm === arm && candidate.index === 0)
  if (!lane) {
    throw new Error(`No lane for arm: ${arm}`)
  }
  return lane
}

interface BarOptions {
  centre: Vec2
  /** Unit vector the bar's length is measured along. */
  along: Vec2
  lengthAlong: number
  widthAcross: number
  y: number
  material: THREE.Material
}

/**
 * One flat rectangle of paint or kerb, lying on the road.
 *
 * The plane is rotated flat once and then yawed so its length axis lands on
 * `along`, which is the only orientation arithmetic in this file — every bar
 * below is a position and two numbers.
 */
function bar(options: BarOptions): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(options.lengthAlong, options.widthAcross)
  geometry.rotateX(-Math.PI / 2)

  const mesh = new THREE.Mesh(geometry, options.material)
  mesh.position.set(options.centre.x, options.y, options.centre.z)
  // Yaw so local +X maps onto `along`: R_y(θ)·(1,0,0) = (cosθ, 0, −sinθ).
  mesh.rotation.y = Math.atan2(-options.along.z, options.along.x)
  return mesh
}

function scalar(value: number, axis: Vec2): Vec2 {
  return { x: axis.x * value, z: axis.z * value }
}

function plus(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, z: a.z + b.z }
}

/**
 * The dashed lane lines, as one instanced draw.
 *
 * Three longitudinal lines per carriageway — the centre line and the divider
 * between the two lanes — from just past the stop line out to the rim of
 * the world. They begin past the stop line rather than at the junction box
 * because between the two sits the crossing, and lane paint under a zebra is
 * paint in the wrong place. Two hundred and forty planes, one draw call,
 * because the alternative is two hundred and forty draws for paint that never
 * moves.
 */
function buildDashes(material: THREE.Material): THREE.InstancedMesh {
  const geometry = new THREE.PlaneGeometry(LINE_WIDTH, DASH_LENGTH)
  geometry.rotateX(-Math.PI / 2)

  const offsets = [-LANE_WIDTH, 0, LANE_WIDTH]
  const start = STOP_LINE_DISTANCE + STOP_LINE_WIDTH + 0.6
  const perDirection = Math.max(0, Math.floor((ROAD_HALF_LENGTH - start) / DASH_PITCH))

  // Two carriageways × three lines × two directions × dashes per direction.
  const count = 2 * offsets.length * 2 * perDirection
  const mesh = new THREE.InstancedMesh(geometry, material, count)

  const eastbound = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
  const northSouth = new THREE.Quaternion()
  const scale = new THREE.Vector3(1, 1, 1)

  const matrix = new THREE.Matrix4()
  let index = 0

  for (const horizontal of [false, true]) {
    for (const offset of offsets) {
      for (const sign of [-1, 1]) {
        for (let dash = 0; dash < perDirection; dash += 1) {
          const along = start + dash * DASH_PITCH + DASH_LENGTH / 2
          const x = horizontal ? sign * along : offset
          const z = horizontal ? offset : sign * along

          matrix.compose(
            new THREE.Vector3(x, MARKING_Y, z),
            horizontal ? eastbound : northSouth,
            scale,
          )
          mesh.setMatrixAt(index, matrix)
          index += 1
        }
      }
    }
  }

  mesh.count = index
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}

/** A lane arrow glyph's outline, in a frame whose `+x` runs forward and whose
 *  `+y` is the driver's left. Counter-clockwise, which is the winding a flat
 *  `ShapeGeometry` needs to face up once it is laid on the road. */
type ArrowKind = 'through' | 'left' | 'right' | 'combo-left' | 'combo-right'

function sampleCubic(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  steps = 8,
): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    const mt = 1 - t
    const x =
      mt * mt * mt * p0[0] +
      3 * mt * mt * t * p1[0] +
      3 * mt * t * t * p2[0] +
      t * t * t * p3[0]
    const y =
      mt * mt * mt * p0[1] +
      3 * mt * mt * t * p1[1] +
      3 * mt * t * t * p2[1] +
      t * t * t * p3[1]
    pts.push([Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000])
  }
  return pts
}

/** 1. Straight Through Arrow outline (Counter-Clockwise). */
function throughOutline(): [number, number][] {
  const tail = -1.9
  const shaftW = 0.12
  const shoulder = 0.8
  const notchX = 0.65
  const headW = 0.46
  const tipX = 2.1

  return [
    [tail, -shaftW],
    [shoulder, -shaftW],
    [notchX, -shaftW - 0.05],
    [notchX, -headW],
    [tipX, 0],
    [notchX, headW],
    [notchX, shaftW + 0.05],
    [shoulder, shaftW],
    [tail, shaftW],
  ]
}

/** 2. Combo Left Arrow (Through + Left Turn) outline (Counter-Clockwise). */
function comboLeftOutline(): [number, number][] {
  const tail = -1.9
  const shaftW = 0.12
  const shoulder = 0.8
  const notchX = 0.65
  const headW = 0.46
  const tipX = 2.1

  const pts: [number, number][] = [
    [tail, -shaftW],
    [shoulder, -shaftW],
    [notchX, -shaftW - 0.05],
    [notchX, -headW],
    [tipX, 0],
    [notchX, headW],
    [notchX, shaftW + 0.05],
    [shoulder, shaftW],
    [0.55, shaftW],
  ]

  // Branch forward curve from stem into left head forward barb
  const branchForwardCurve = sampleCubic(
    [0.55, shaftW],
    [0.6, 0.4],
    [0.62, 0.7],
    [0.52, 0.9],
    8,
  )
  pts.push(...branchForwardCurve)

  // Left arrowhead
  pts.push([0.65, 0.9])
  pts.push([0.28, 1.62])
  pts.push([-0.08, 0.9])
  pts.push([0.05, 0.9])

  // Branch rear curve back into main stem
  const branchRearCurve = sampleCubic(
    [0.05, 0.9],
    [-0.05, 0.55],
    [-0.15, 0.25],
    [-0.45, shaftW],
    8,
  )
  pts.push(...branchRearCurve)

  pts.push([tail, shaftW])
  return pts
}

/** 3. Pure Left Turn Arrow outline (Counter-Clockwise). */
function leftOutline(): [number, number][] {
  const tail = -1.9
  const shaftW = 0.12

  const pts: [number, number][] = [[tail, -shaftW]]

  const outerCurve = sampleCubic(
    [tail, -shaftW],
    [0.0, -shaftW],
    [0.6, -0.05],
    [0.52, 0.9],
    12,
  )
  pts.push(...outerCurve)

  pts.push([0.65, 0.9])
  pts.push([0.28, 1.62])
  pts.push([-0.08, 0.9])
  pts.push([0.05, 0.9])

  const innerCurve = sampleCubic(
    [0.05, 0.9],
    [-0.05, 0.45],
    [-0.25, shaftW],
    [tail, shaftW],
    12,
  )
  pts.push(...innerCurve)

  return pts
}

function mirrorOutline(outline: [number, number][]): [number, number][] {
  return outline.map(([x, y]) => [x, -y] as [number, number]).reverse()
}

function arrowOutline(kind: ArrowKind): [number, number][] {
  switch (kind) {
    case 'through':
      return throughOutline()
    case 'combo-left':
      return comboLeftOutline()
    case 'combo-right':
      return mirrorOutline(comboLeftOutline())
    case 'left':
      return leftOutline()
    case 'right':
      return mirrorOutline(leftOutline())
  }
}

function arrowGeometry(kind: ArrowKind): THREE.ShapeGeometry {
  const shape = new THREE.Shape()
  const points = arrowOutline(kind)
  shape.moveTo(points[0]![0], points[0]![1])
  for (let index = 1; index < points.length; index += 1) {
    const [x, y] = points[index]!
    shape.lineTo(x, y)
  }
  shape.closePath()

  const geometry = new THREE.ShapeGeometry(shape)
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

function laneArrowKind(turns: Turn[]): ArrowKind {
  const hasThrough = turns.includes('through')
  const hasLeft = turns.includes('left')
  const hasRight = turns.includes('right')

  if (hasThrough && hasLeft) {
    return 'combo-left'
  }
  if (hasThrough && hasRight) {
    return 'combo-right'
  }
  if (hasLeft) {
    return 'left'
  }
  if (hasRight) {
    return 'right'
  }
  return 'through'
}

/**
 * The lane arrows.
 *
 * `layout.ts` gives every lane its permitted turns. Authentic urban road markings
 * place unified combination arrows (e.g. through + left in lane 0, through + right in
 * lane 1) directly down the lane's centreline rather than cramped side-by-side.
 *
 * Each approach lane receives two sequential markings:
 * - A primary arrow at 9.5 m behind the stop line.
 * - An advance confirmation arrow at 28.0 m behind the stop line.
 *
 * Rendered as one instanced draw call per arrow kind.
 */
function buildLaneArrows(material: THREE.Material): THREE.InstancedMesh[] {
  const placements: Record<ArrowKind, { position: THREE.Vector3; yaw: number }[]> = {
    through: [],
    left: [],
    right: [],
    'combo-left': [],
    'combo-right': [],
  }

  const distances = [ARROW_PRIMARY_BACK, ARROW_ADVANCE_BACK]

  for (const lane of LANES) {
    const { axis } = approachFrame(lane.arm)
    const yaw = Math.atan2(-axis.z, axis.x)
    const kind = laneArrowKind(lane.turns)

    for (const back of distances) {
      placements[kind].push({
        position: new THREE.Vector3(
          lane.lateral.x + axis.x * -back,
          MARKING_Y,
          lane.lateral.z + axis.z * -back,
        ),
        yaw,
      })
    }
  }

  const up = new THREE.Vector3(0, 1, 0)
  const scale = new THREE.Vector3(1, 1, 1)
  const matrix = new THREE.Matrix4()

  const meshes: THREE.InstancedMesh[] = []

  for (const kind of Object.keys(placements) as ArrowKind[]) {
    const list = placements[kind]
    if (list.length === 0) {
      continue
    }

    const mesh = new THREE.InstancedMesh(arrowGeometry(kind), material, list.length)

    list.forEach(({ position, yaw }, index) => {
      matrix.compose(position, new THREE.Quaternion().setFromAxisAngle(up, yaw), scale)
      mesh.setMatrixAt(index, matrix)
    })

    mesh.instanceMatrix.needsUpdate = true
    meshes.push(mesh)
  }

  return meshes
}

/**
 * The turning guides, dotted through the box.
 *
 * One path per turning movement, sampled straight from that movement's own
 * route, so the paint a driver reads and the curve a car drives are the same
 * geometry — a guide drawn from a separately chosen control point would be a
 * second, quieter definition of the turn, and it would drift from the real one
 * the first time either was tuned. Only the stretch inside the junction box is
 * painted: the approach and the exit already carry a lane line and a second one
 * beside it would read as a lane that is not there.
 *
 * This is the marking that makes a turn legible. Without it the box is a blank
 * square, and a car swung through it reads as one crossing the asphalt on a
 * diagonal — the complaint, in the renderer, was never the turn, it was the
 * absence of anything on the ground saying where the turn goes.
 *
 * Left turns only. A right turn is a tight quarter at the kerb and paints itself
 * in the eye; guiding it as well doubles the arcs and the eight of them together
 * resolve into a rosette — decoration, not guidance. The left is the movement
 * that crosses the box and the one a driver actually needs the dotted line for,
 * which is why it is the only one every junction paints.
 */
function buildTurnGuides(material: THREE.Material): THREE.InstancedMesh {
  const geometry = new THREE.PlaneGeometry(GUIDE_DASH, LINE_WIDTH)
  geometry.rotateX(-Math.PI / 2)

  const placements: { x: number; z: number; yaw: number }[] = []

  for (const movement of MOVEMENTS) {
    if (movement.turn !== 'left') {
      continue
    }

    const { samples } = movement.route
    let travelled = 0
    let next = GUIDE_PITCH / 2

    for (let index = 1; index < samples.length; index += 1) {
      const a = samples[index - 1] as (typeof samples)[number]
      const b = samples[index] as (typeof samples)[number]
      travelled += Math.hypot(b.point.x - a.point.x, b.point.z - a.point.z)
      if (travelled < next) {
        continue
      }
      next += GUIDE_PITCH

      if (Math.abs(b.point.x) > GUIDE_INSET || Math.abs(b.point.z) > GUIDE_INSET) {
        continue
      }

      placements.push({
        x: b.point.x,
        z: b.point.z,
        yaw: Math.atan2(-(b.point.z - a.point.z), b.point.x - a.point.x),
      })
    }
  }

  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, placements.length))
  const up = new THREE.Vector3(0, 1, 0)
  const scale = new THREE.Vector3(1, 1, 1)
  const matrix = new THREE.Matrix4()

  placements.forEach(({ x, z, yaw }, index) => {
    matrix.compose(
      new THREE.Vector3(x, MARKING_Y, z),
      new THREE.Quaternion().setFromAxisAngle(up, yaw),
      scale,
    )
    mesh.setMatrixAt(index, matrix)
  })

  mesh.count = placements.length
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}

/**
 * Builds the whole static ground layer: disc, carriageways, junction box,
 * lane paint, stop lines, zebras and kerbs.
 *
 * Disposal is the scene's job — it traverses whatever it owns — so this hands
 * back a plain group and keeps no bookkeeping of its own.
 */
export function createRoadLayer(): THREE.Group {
  const layer = new THREE.Group()
  layer.name = 'road'

  const asphalt = new THREE.MeshBasicMaterial({ color: ASPHALT })
  const pavement = new THREE.MeshBasicMaterial({ color: PAVEMENT })
  const kerb = new THREE.MeshBasicMaterial({ color: KERB })
  const paintDim = new THREE.MeshBasicMaterial({
    color: PAINT,
    transparent: true,
    opacity: LINE_OPACITY.dim,
  })
  const paintBright = new THREE.MeshBasicMaterial({
    color: PAINT,
    transparent: true,
    opacity: LINE_OPACITY.bright,
  })
  const paintZebra = new THREE.MeshBasicMaterial({
    color: PAINT,
    transparent: true,
    opacity: LINE_OPACITY.zebra,
  })

  // The ground disc. Everything past the roads is pavement, and everything
  // past that is fog.
  const groundGeometry = new THREE.CircleGeometry(GROUND_RADIUS, 96)
  groundGeometry.rotateX(-Math.PI / 2)
  layer.add(new THREE.Mesh(groundGeometry, pavement))

  // The two carriageways, a centimetre apart where they cross so that the
  // overlap cannot resolve by flicker.
  const northSouthGeometry = new THREE.PlaneGeometry(ROAD_HALF * 2, ROAD_LENGTH)
  northSouthGeometry.rotateX(-Math.PI / 2)
  const northSouth = new THREE.Mesh(northSouthGeometry, asphalt)
  northSouth.position.y = ROAD_Y
  layer.add(northSouth)

  const eastWestGeometry = new THREE.PlaneGeometry(ROAD_HALF * 2, ROAD_LENGTH)
  eastWestGeometry.rotateX(-Math.PI / 2)
  const eastWest = new THREE.Mesh(eastWestGeometry, asphalt)
  eastWest.position.y = ROAD_Y + 0.005
  eastWest.rotation.y = Math.PI / 2
  layer.add(eastWest)

  // The junction box. Wider than the carriageway, as `layout.ts` says a real
  // one is: this square is the turning room, and it is what fills the corners
  // between the two ribbons.
  const boxGeometry = new THREE.PlaneGeometry(JUNCTION_HALF * 2, JUNCTION_HALF * 2)
  boxGeometry.rotateX(-Math.PI / 2)
  const box = new THREE.Mesh(boxGeometry, asphalt)
  box.position.y = JUNCTION_Y
  layer.add(box)

  layer.add(buildDashes(paintDim))

  for (const arrows of buildLaneArrows(paintBright)) {
    layer.add(arrows)
  }

  // The turning guides, inside the box. Painted before the stop lines and
  // zebras so those, which sit outside it, cannot overlap them.
  layer.add(buildTurnGuides(paintDim))

  // Stop lines: one per approach, across that approach's half of the
  // carriageway, at the model's own stop position — `route.stopS` sits at
  // `STOP_LINE_DISTANCE` from the junction centre, so the paint and the
  // physics end at the same millimetre. Between the line and the box is the
  // crossing; behind the line is where the queue stands.
  for (const arm of ARMS) {
    const { axis, right } = approachFrame(arm)
    layer.add(
      bar({
        centre: plus(
          scalar(-(STOP_LINE_DISTANCE + STOP_LINE_WIDTH / 2), axis),
          scalar(ROAD_HALF / 2, right),
        ),
        along: axis,
        lengthAlong: STOP_LINE_WIDTH,
        widthAcross: ROAD_HALF,
        y: MARKING_Y,
        material: paintBright,
      }),
    )
  }

  // Zebras, bar by bar. Each crossing sits between the junction box and the
  // stop line — the strip a vehicle on red must keep clear — and spans the
  // whole carriageway, because a crossing that stops at the centre line is a
  // crossing to the middle of the road. The bars run along the road and repeat
  // across it: `crosswalk.length` is the carriageway width, `CROSSWALK_WIDTH`
  // the crossing's depth, and the count that fits the first at the standard
  // pitch is the number of stripes.
  for (const crosswalk of CROSSWALKS) {
    const count = Math.max(1, Math.round(crosswalk.length / ZEBRA_PITCH))
    for (let index = 0; index < count; index += 1) {
      const offset = (index - (count - 1) / 2) * ZEBRA_PITCH
      layer.add(
        bar({
          centre: plus(crosswalk.centre, scalar(offset, crosswalk.across)),
          along: crosswalk.along,
          lengthAlong: CROSSWALK_WIDTH,
          widthAcross: ZEBRA_BAR,
          y: MARKING_Y,
          material: paintZebra,
        }),
      )
    }
  }

  // Kerbs: the hairline around the asphalt. Without it two crossing bands of
  // near-black are a plus sign, not a street — the same sentence the CSS scene
  // wrote about its own edges, and it is true in every medium.
  const edgeSpan = ROAD_HALF_LENGTH - JUNCTION_HALF
  const edgeCentre = JUNCTION_HALF + edgeSpan / 2

  for (const horizontal of [false, true]) {
    for (const edgeSign of [-1, 1]) {
      for (const segmentSign of [-1, 1]) {
        const lateral = edgeSign * (ROAD_HALF + KERB_WIDTH / 2)
        const along = segmentSign * edgeCentre
        layer.add(
          bar({
            centre: horizontal ? { x: along, z: lateral } : { x: lateral, z: along },
            along: horizontal ? { x: 1, z: 0 } : { x: 0, z: 1 },
            lengthAlong: edgeSpan,
            widthAcross: KERB_WIDTH,
            y: MARKING_Y,
            material: kerb,
          }),
        )
      }
    }
  }

  // The four corner stubs where pavement meets the junction box. The road
  // mouths deliberately get no kerb — there is no edge to draw across a place
  // cars drive through.
  const stubSpan = JUNCTION_HALF - ROAD_HALF
  const stubCentre = ROAD_HALF + stubSpan / 2

  for (const horizontal of [false, true]) {
    for (const edgeSign of [-1, 1]) {
      for (const segmentSign of [-1, 1]) {
        const edge = edgeSign * (JUNCTION_HALF + KERB_WIDTH / 2)
        const along = segmentSign * stubCentre
        layer.add(
          bar({
            centre: horizontal ? { x: edge, z: along } : { x: along, z: edge },
            along: horizontal ? { x: 0, z: 1 } : { x: 1, z: 0 },
            lengthAlong: stubSpan,
            widthAcross: KERB_WIDTH,
            y: MARKING_Y,
            material: kerb,
          }),
        )
      }
    }
  }

  return layer
}
