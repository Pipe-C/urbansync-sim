import * as THREE from 'three'

import {
  ARMS,
  CROSSWALKS,
  GROUND_RADIUS,
  JUNCTION_HALF,
  LANES,
  LANE_WIDTH,
  ROAD_HALF,
  STOP_LINE_DISTANCE,
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

/** Lane arrows: how far behind the stop line the glyph's centre sits, and how
 *  far off the lane centre each of the lane's two glyphs stands.
 *
 *  Eight metres back puts the whole arrow (2,9 m) clear of the queue that
 *  stands at the line and still well inside the fog, on the stretch a driver
 *  reads before committing. The two glyphs share the lane: a turn arrow on the
 *  side it turns towards, a through arrow on the other, so the pair states the
 *  lane's discipline — lane 0 turns left, lane 1 turns right — in the paint
 *  itself. */
const ARROW_BACK = STOP_LINE_DISTANCE + 8
const ARROW_OFFSET = 0.6

/** The glyph itself: a 2,9 m arrow with a 1,1 m head. The tail and shoulder
 *  anchor it in a frame whose `+x` runs forward, and the head is either the
 *  straight point or a 45° veer, which is how a turn arrow keeps its shaft in
 *  the lane while the head says which way the lane goes. */
const ARROW_TAIL = -1.4
const ARROW_SHOULDER = 0.5
const ARROW_SHAFT = 0.12
const ARROW_HEAD = 0.55
const ARROW_REACH = 1.0

/** Zebra geometry. Four bars of 0,4 m with 0,4 m between them fill the 3,2 m
 *  crossing depth with a 0,2 m margin at each kerb, which is what keeps the
 *  stripes off the kerb line they belong to. */
const ZEBRA_BARS = 4
const ZEBRA_BAR = 0.4
const ZEBRA_PITCH = ZEBRA_BAR + ZEBRA_BAR

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
type ArrowTurn = 'through' | 'left' | 'right'

function arrowOutline(turn: ArrowTurn): [number, number][] {
  if (turn === 'right') {
    // The right glyph is the left one mirrored. Mirroring flips the winding, so
    // the list is reversed as well to keep the outline counter-clockwise.
    return arrowOutline('left')
      .map(([x, y]) => [x, -y] as [number, number])
      .reverse()
  }

  const outline: [number, number][] = [
    [ARROW_TAIL, -ARROW_SHAFT],
    [ARROW_SHOULDER, -ARROW_SHAFT],
  ]

  if (turn === 'through') {
    outline.push(
      [ARROW_SHOULDER, -ARROW_HEAD],
      [ARROW_SHOULDER + ARROW_REACH, 0],
      [ARROW_SHOULDER, ARROW_HEAD],
      [ARROW_SHOULDER, ARROW_SHAFT],
    )
  } else {
    const diagonal = Math.SQRT1_2
    outline.push(
      // The head's base passes through the shoulder, and the shaft's far edge
      // meets it exactly one shaft-half back — the point the outline leaves the
      // shaft on its way to the tip.
      [ARROW_SHOULDER, 0],
      [ARROW_SHOULDER + ARROW_HEAD * diagonal, -ARROW_HEAD * diagonal],
      [ARROW_SHOULDER + ARROW_REACH * diagonal, ARROW_REACH * diagonal],
      [ARROW_SHOULDER - ARROW_HEAD * diagonal, ARROW_HEAD * diagonal],
      [ARROW_SHOULDER - ARROW_SHAFT, ARROW_SHAFT],
    )
  }

  outline.push([ARROW_TAIL, ARROW_SHAFT])
  return outline
}

function arrowGeometry(turn: ArrowTurn): THREE.ShapeGeometry {
  const shape = new THREE.Shape()
  const points = arrowOutline(turn)
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

/**
 * The lane arrows.
 *
 * `layout.ts` gives every lane its turns and says the painted arrows are what
 * make that discipline legible — an arrow in a lane is a statement about which
 * movements the lane may make. Until now nothing painted them, so the innermost
 * lane that may only turn left looked exactly like one that may only go
 * straight. Each approach lane now wears two glyphs: the turn the lane allows,
 * on the side it turns towards, and a through arrow beside it.
 *
 * The turn is read from `lane.turns` rather than from the lane's index, so a
 * renumbering in the model repaints the road instead of contradicting it. One
 * instanced draw per glyph shape, like the dashes.
 */
function buildLaneArrows(material: THREE.Material): THREE.InstancedMesh[] {
  const placements: Record<ArrowTurn, { position: THREE.Vector3; yaw: number }[]> = {
    through: [],
    left: [],
    right: [],
  }

  for (const lane of LANES) {
    const { axis, right } = approachFrame(lane.arm)
    const yaw = Math.atan2(-axis.z, axis.x)
    const turn = lane.turns.find((candidate) => candidate !== 'through') ?? 'through'
    // `right` points at the approaching driver's right hand, so a left turn
    // stands at −1 of it and a right turn at +1; the through glyph takes the
    // other side. They share the lane without touching: at 0,6 m off centre the
    // pair spans 2,1 m of a 3,4 m lane.
    const side = turn === 'left' ? -1 : 1

    for (const [glyph, offset] of [
      [turn, side * ARROW_OFFSET],
      ['through', -side * ARROW_OFFSET],
    ] as [ArrowTurn, number][]) {
      placements[glyph].push({
        position: new THREE.Vector3(
          lane.lateral.x + axis.x * -ARROW_BACK + right.x * offset,
          MARKING_Y,
          lane.lateral.z + axis.z * -ARROW_BACK + right.z * offset,
        ),
        yaw,
      })
    }
  }

  const up = new THREE.Vector3(0, 1, 0)
  const scale = new THREE.Vector3(1, 1, 1)
  const matrix = new THREE.Matrix4()

  return (Object.keys(placements) as ArrowTurn[]).map((turn) => {
    const list = placements[turn]
    const mesh = new THREE.InstancedMesh(arrowGeometry(turn), material, list.length)

    list.forEach(({ position, yaw }, index) => {
      matrix.compose(position, new THREE.Quaternion().setFromAxisAngle(up, yaw), scale)
      mesh.setMatrixAt(index, matrix)
    })

    mesh.instanceMatrix.needsUpdate = true
    return mesh
  })
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
