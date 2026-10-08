/**
 * The simulation model.
 *
 * Nothing in this folder imports from `three/`, and nothing in `three/` reaches
 * around it. The barrell is the boundary: a renderer can read the model's state
 * and nothing else, and the model can be run — and checked — with no WebGL
 * context in the process.
 */

export {
  APPROACH_LENGTH,
  ARMS,
  ARM_LABEL,
  CROSSWALKS,
  CROSSWALK_GAP,
  CROSSWALK_WIDTH,
  STOP_LINE_DISTANCE,
  STOP_LINE_GAP,
  EXIT_LENGTH,
  FOG_FAR,
  FOG_NEAR,
  GROUND_RADIUS,
  JUNCTION_HALF,
  LANES,
  LANE_WIDTH,
  MOVEMENTS,
  OPPOSITE,
  ROAD_HALF,
  type Arm,
  type Crosswalk,
  type Lane,
  type LaneIndex,
  type Movement,
  type Turn,
} from './layout'

export {
  ORDINARY_KINDS,
  VEHICLE_SPECS,
  Random,
  type Paint,
  type VehicleKind,
  type VehicleSpec,
} from './fleet'

export {
  ALL_RED,
  AMBER,
  MAX_GREEN,
  MIN_GREEN,
  SignalController,
  armName,
  pressureOf,
  type Aspect,
  type ControllerState,
} from './controller'

export { WalkerField, type Walker } from './pedestrians'

export {
  DEFAULT_BASE_RATE,
  DEFAULT_PEAK_RATE,
  IntersectionWorld,
  TIMING,
  conflictTableFor,
  type VehicleState,
  type WorldOptions,
  type WorldSummary,
} from './world'

export { headingOf, type Vec2 } from './vector'
