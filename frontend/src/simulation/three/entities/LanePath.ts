import * as THREE from 'three'

import {
  ARMS,
  CROSSWALKS,
  GROUND_RADIUS,
  JUNCTION_HALF,
  LANES,
  LANE_WIDTH,
  ROAD_HALF,
  type Arm,
  type Lane,
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

/** Zebra geometry. Four bars of 0,4 m with 0,4 m between them fill the 3,2 m
 *  crossing depth with a 0,2 m margin at each kerb, which is what keeps the
 *  stripes off the kerb line they belong to. */
const ZEBRA_BARS = 4
const ZEBRA_BAR = 0.4
const ZEBRA_PITCH = ZEBRA_BAR + ZEBRA_BAR

const KERB_WIDTH = 0.16

const LINE_OPACITY = { dim: 0.5, bright: 0.85, zebra: 0.4 }

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
 * between the two lanes — from the edge of the junction box out to the rim of
 * the world. Two hundred and forty planes, one draw call, because the alternative
 * is two hundred and forty draws for paint that never moves.
 */
function buildDashes(material: THREE.Material): THREE.InstancedMesh {
  const geometry = new THREE.PlaneGeometry(LINE_WIDTH, DASH_LENGTH)
  geometry.rotateX(-Math.PI / 2)

  const offsets = [-LANE_WIDTH, 0, LANE_WIDTH]
  const start = JUNCTION_HALF + 0.6
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

  // Stop lines: one per approach, across that approach's half of the
  // carriageway, hard against the junction box — which is where the model
  // parks a front bumper (`route.stopS`), so the paint and the physics end at
  // the same millimetre.
  for (const arm of ARMS) {
    const { axis, right } = approachFrame(arm)
    layer.add(
      bar({
        centre: plus(
          scalar(-(JUNCTION_HALF + STOP_LINE_WIDTH / 2), axis),
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

  // Zebras, bar by bar. Each crossing sits between the stop line and the
  // junction — exactly where a vehicle on red is standing — and spans the
  // whole carriageway, because a crossing that stops at the centre line is a
  // crossing to the middle of the road.
  for (const crosswalk of CROSSWALKS) {
    for (let index = 0; index < ZEBRA_BARS; index += 1) {
      const offset = (index - (ZEBRA_BARS - 1) / 2) * ZEBRA_PITCH
      layer.add(
        bar({
          centre: plus(crosswalk.centre, scalar(offset, crosswalk.along)),
          along: crosswalk.across,
          lengthAlong: crosswalk.length,
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
