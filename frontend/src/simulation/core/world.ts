import {
  ALL_RED,
  AMBER,
MAX_GREEN,
  MIN_GREEN,
  REACTION_SECONDS,
  SignalController,
  pressureOf,
  type Aspect,
} from './controller'
import {
  ARMS,
  CROSSWALKS,
  JUNCTION_HALF,
  LANES,
  MOVEMENTS,
  OPPOSITE,
  RIGHT_TARGET,
  sampleRoute,
  type Arm,
  type Lane,
  type Movement,
  type Route,
  type Turn,
} from './layout'
import {
  ORDINARY_KINDS,
  Random,
  VEHICLE_SPECS,
  type Paint,
  type VehicleKind,
  type VehicleSpec,
} from './fleet'
import { WalkerField, type Walker } from './pedestrians'
import type { Vec2 } from './vector'

/**
 * The junction model.
 *
 * This is the file that replaced a stylesheet. Everything the previous scene
 * tried to express with `animation-delay` — queue order, discharge headway, who
 * goes next, who is allowed into the box — is decided here, once per frame, from
 * the positions of the vehicles themselves.
 *
 * ### Why the order bug cannot come back
 *
 * The scene it replaces gave every vehicle an independent CSS animation whose
 * phase was a hand-tuned delay. Nothing in that arrangement *enforced* the
 * order of a queue: the third car went before the second because its delay
 * happened to be signed the other way. And because each vehicle teleported
 * between keyframes off-stage, one that was recycled out of order reappeared
 * where it had started, which is what read as a ghost car arriving from
 * nowhere.
 *
 * Here, a vehicle's position is a single number advanced by physics, and it is
 * clamped by two rules it cannot break:
 *
 * ```
 * gap = distance to the leader − (their length + mine) / 2 − MIN_GAP
 * v   = min(freeSpeed, √(2 · decel · max(0, gap)))
 * s   = min(s + v · dt, leaderS − leaderLength − MIN_GAP)   // the hard one
 * ```
 *
 * The last line is not a model, it is a constraint. A vehicle's arc length is
 * *assigned* a ceiling derived from the vehicle in front, so overtaking is not
 * merely unlikely, it is unrepresentable. There is no number in this file whose
 * sign or ordering could reintroduce it, which is a stronger guarantee than
 * three tuned delays that happen to agree.
 *
 * And nothing teleports. A vehicle is created at the far edge of an approach,
 * driven the whole way, and deleted at the far edge of the exit. There is no
 * wrap, no recycle-to-start, and therefore no frame in which a car exists in two
 * places or in neither.
 *
 * ### The layers
 *
 * `core/` imports nothing from `three/`, and the renderer imports everything
 * from here. The model is runnable — and checkable — without a WebGL context,
 * which is the only reason the two could be argued about separately and the only
 * reason a future move to a canvas would not be a rewrite.
 */

/** The gap kept between bumpers when stationary. A car's mirrors are wider than
 *  its body, so this is the distance at which two cars in a queue are visibly
 *  close but not interpenetrating. */
const MIN_GAP = 1.35

/** Why a vehicle is being held, and by what.
 *
 *  Every rule in this file that can stop a vehicle can also explain itself, and the
 *  explanation is collected here rather than logged, because this module is
 *  renderer-agnostic and Node-free by contract: it does not read `process` and has
 *  no business knowing whether it is running in a browser, a worker, or a test. So
 *  the trace is switched on by the caller and drained by the caller, rather than by
 *  an environment variable.
 *
 *  The cost in a normal run is zero. This is false until a caller asks, every block
 *  guarded by it is behind a test, and so a default simulation records nothing and
 *  allocates no strings. A caller that does want the trace turns it on and drains
 *  `takeTrace()` as it goes; `takeTrace` hands over the buffer and installs a fresh
 *  one, so a drainer that keeps up cannot grow it.
 *
 *  This is part of the engine, not scaffolding left over from a bug hunt. Three of
 *  the defects closed in `CONTINUIDAD.md` were found by reading these traces, and
 *  none of them was visible from the outside: in every case `served` simply stopped
 *  rising and the junction read as being at capacity. The scripts in
 *  `frontend/scripts/` are the interface, and the ones that matter most are
 *  `overlap-seeds` and `overlap-pairs` (do bodies ever share a square metre, and
 *  which pair) and `stall` and `stranded` (is the junction refusing to discharge,
 *  or refusing because it is full, and who is holding the box).
 */
let TRACE_BODY = false

/** Switch the body-conflict and integration traces on or off. */
export function setBodyTrace(on: boolean): void {
  TRACE_BODY = on
}

/** Which vehicle id the per-frame integration trace is about; -1 for none. */
let TRACE_VEHICLE = -1

/** Focus the per-frame integration trace on a single vehicle by id. */
export function setTraceVehicle(id: number): void {
  TRACE_VEHICLE = id
}

/** Comfortable standstill gap used by the safe-speed law, on top of `MIN_GAP`. */
const STANDSTILL_GAP = 0.6

/** How long a vehicle's own waiting counts for, when it is competing for a green.
 *
 *  Past this point every vehicle in a saturated queue is in the same state — still
 *  there, still blocked — so the differences between them are no longer information
 *  about how badly traffic is doing, they are just how long ago each one arrived.
 *  Left uncapped, that ordering is self-reinforcing: the longest-waiting vehicle
 *  exerts the most pressure, is therefore served first, and the vehicles behind it
 *  never accumulate enough pressure to be served at all. Capping it makes the
 *  comparison one about the present, and lets `age` in the controller — which does
 *  rotate — decide among vehicles that are equally stuck.
 *
 *  Two minutes is long enough that a genuinely under-served approach still outranks
 *  one that was served thirty seconds ago, and short enough that the junction cannot
 *  be captured by a single vehicle.
 */
const PRESSURE_HORIZON = 120

/** Below this speed a vehicle counts as standing rather than rolling.
 *
 *  Used where the question is "is this stream coming at us" rather than "is this
 *  vehicle in the way": a vehicle touching this is either stopped at a signal or
 *  stationary in a queue, and neither is a flow. Bodies that are both standing are
 *  ordered by `holdForBodyConflict` and `boxConflict`, which is the test that
 *  belongs to them. */
const ROLLING_SPEED = 0.5

/** How far a body must reach into the junction before it counts as occupying it.
 *
 *  A vehicle stopped at its stop line has its nose exactly on the boundary of the
 *  junction square, and touching the boundary is not being in the place. The
 *  tolerance is what separates a queue waiting to enter from traffic that has
 *  entered, and the two are not interchangeable: if a car at the line counts as
 *  an occupant then it blocks the conflicting movement, that movement's queue
 *  blocks it, and the grid locks with every lane full and nothing moving.
 *
 *  Kept an order of magnitude above the invariant checker's own 2 cm tolerance, so
 *  that "deep enough to count" and "deep enough to be a collision" cannot
 *  disagree about the same pair of vehicles. */
const BOX_INTRUSION = 0.15

/** Metres over which a vehicle fades at each end of its route. The spawn point
 *  is already deep inside the fog, so this is a second, independent guarantee
 *  that no vehicle can ever be seen arriving. */
const FADE_LENGTH = 7

export interface VehicleState {
  id: number
  spec: VehicleSpec
  kind: VehicleKind
  paint: Paint
  /** `s` is the front bumper's arc length along the route. The rendered centre
   *  is half a length behind it, and getting that wrong is what makes a queue
   *  look like it is braking short of the line. */
  s: number
  v: number
  /** Smoothed body heading, eased toward the path tangent. */
  heading: number
  position: Vec2
  lane: Lane
  movement: Movement
  /** Seconds spent essentially stationary, and the input to the control law. */
  waited: number
  opacity: number
  emergency: boolean
  /** Set while the vehicle is inside the junction box. */
  inBox: boolean
}

export interface WorldSummary {
  /** Vehicles queued on each approach, by lane. */
  queued: Record<Arm, number>
  /** Longest wait on any approach, in seconds. */
  longestWait: number
  /** Vehicles that have crossed the junction since the model started. */
  served: number
  /** True while an emergency vehicle holds or is asking for preemption. */
  preemption: boolean
  /** The controller's explanation of its current state. */
  reason: string
  /** The arm currently being served, or `null` during an all-red. */
  activeArm: Arm | null
}

const LANE_IDS = LANES.map((lane) => lane.id)

export interface WorldOptions {
  seed?: number
  /** Vehicles per second per lane, at the quietest point of the demand cycle. */
  baseRate?: number
  /** Vehicles per second per lane, at the busiest. */
  peakRate?: number
}

export class IntersectionWorld {
  readonly vehicles: VehicleState[] = []
  readonly walkers: Walker[]
  readonly controller = new SignalController()

  private random: Random
  private nextId = 1
  private clock = 0
  private served = 0
  private baseRate: number
  private peakRate: number

  /** Time until the next arrival on each lane. */
  private nextArrival = new Map<string, number>()
  private walkers_field: WalkerField

  private emergencyTimer: number
  private emergencyPending: VehicleState | null = null
  private emergencyActive = false

  constructor(options: WorldOptions = {}) {
    this.random = new Random(options.seed ?? 20260929)
    this.baseRate = options.baseRate ?? 0.115
    this.peakRate = options.peakRate ?? 0.29
    this.walkers_field = new WalkerField({ seed: (options.seed ?? 20260929) ^ 0x5bf03635 })
    this.walkers = this.walkers_field.walkers

    for (const lane of LANES) {
      this.nextArrival.set(lane.id, this.random.range(0, 3))
    }

    // Pre-fill the approaches so the junction is already in steady state on the
    // first frame. A scene that starts empty spends its first fifteen seconds
    // looking broken, and the first thing anyone concludes is that the traffic
    // generator does not work.
    this.warmUp()

    this.emergencyTimer = this.random.range(26, 44)
  }

  private warmUp(): void {
    for (const lane of LANES) {
      // Two or three vehicles per approach, at the spacing a real queue holds.
      const count = 2 + (lane.arm === 'north' ? 1 : 0)

      // Draw every vehicle first, then lay the queue out so its rearmost tail
      // sits just inside the route start and everyone ahead of it has room.
      // Placing one vehicle off the previous tail - but that tail is at the fog
      // edge - shoves the second and third cars out the back of the world, and
      // `sampleRoute` clamps their centres to the route-start point, which puts
      // two vehicles on top of one another from the very first frame.
      const picks: { kind: VehicleKind; spec: VehicleSpec; atS: number }[] = []
      let tail = MIN_GAP
      for (let index = 0; index < count; index += 1) {
        const kind = this.random.weighted(
          Object.fromEntries(
            ORDINARY_KINDS.map((candidate) => [candidate, VEHICLE_SPECS[candidate].weight]),
          ),
        ) as VehicleKind
        const spec = VEHICLE_SPECS[kind]
        // Front bumper `s` is one length ahead of the tail being laid.
        picks.push({ kind, spec, atS: tail + spec.length })
        tail += spec.length + MIN_GAP
      }

      // `place` only admits a vehicle behind everything already on the lane, so
      // insert front-of-queue first and each subsequent pick sits one gap back.
      for (const { kind, spec, atS } of picks.reverse()) {
        if (!this.place(lane, kind, spec, false, atS)) {
          break
        }
      }
    }
  }

  // --- the frame -------------------------------------------------------------

  step(delta: number): void {
    // A backgrounded tab hands back a delta measured in seconds, and integrating
    // it would teleport every vehicle across the junction in one step. Clamping
    // is the difference between a tab that was hidden for a minute returning to
    // a running junction and one returning to a pile-up.
    const dt = Math.min(Math.max(delta, 0), 1 / 20)
    if (dt === 0) {
      return
    }

    this.clock += dt

    const aspects = this.controller.aspects()

    this.controller.step(dt, {
      pressure: this.pressure(),
      leftPressure: this.leftPressure,
      leftWorst: this.leftWorstWait,
      preemption: this.preemptionRequest(),
      crossingBlocked: this.walkers_field.anyoneCrossing(),
      crossingArm: this.walkers_field.occupiedCrossing(),
      boxBlocked: this.boxOccupied(),
      leftReady: this.leftReady,
    })

    const permittedCrossings = new Set<Arm>()
    for (const arm of ARMS) {
      if (aspects[arm] === 'red') {
        permittedCrossings.add(arm)
      }
    }
    this.walkers_field.step(dt, permittedCrossings)

    this.updateArrivals(dt)
    this.updateEmergency(dt)
    this.updateVehicles(dt)
  }

  summary(): WorldSummary {
    const queued: Record<Arm, number> = { north: 0, east: 0, south: 0, west: 0 }
    let longestWait = 0

    for (const vehicle of this.vehicles) {
      if (vehicle.s < vehicle.movement.route.stopS) {
        queued[vehicle.lane.arm] += 1
        longestWait = Math.max(longestWait, vehicle.waited)
      }
    }

    const state = this.controller.current

    return {
      queued,
      longestWait,
      served: this.served,
      preemption: this.emergencyActive,
      reason: state.reason,
      activeArm: state.kind === 'allRed' ? null : state.arm,
    }
  }

  // --- arrivals --------------------------------------------------------------

  /**
   * Demand over time.
   *
   * Two sines at incommensurate periods, so the traffic swells and eases without
   * repeating on an interval a viewer can count. A single sine is visibly a
   * sine, and a visibly periodic junction stops being traffic and becomes a loop
   * with cars in it — which is exactly the criticism the previous scene earned.
   */
  private demand(): number {
    const slow = Math.sin(this.clock / 61)
    const quick = Math.sin(this.clock / 19 + 1.7)
    const unit = 0.5 + 0.34 * slow + 0.16 * quick
    return this.baseRate + (this.peakRate - this.baseRate) * Math.min(1, Math.max(0, unit))
  }

  private updateArrivals(dt: number): void {
    const rate = this.demand()
    const interval = 1 / rate

    for (const laneId of LANE_IDS) {
      const remaining = (this.nextArrival.get(laneId) ?? 0) - dt
      if (remaining > 0) {
        this.nextArrival.set(laneId, remaining)
        continue
      }

      const lane = LANES.find((candidate) => candidate.id === laneId)!
      const vehicle = this.spawn(lane)

      // A spawn that had to wait for room is retried next frame rather than
      // pushed a whole interval into the future, so a momentary tail-back costs
      // one vehicle's delay and not a gap in the stream.
      this.nextArrival.set(laneId, vehicle ? interval : dt)
    }
  }

  private spawn(lane: Lane): VehicleState | null {
    const kind = this.random.weighted(
      Object.fromEntries(ORDINARY_KINDS.map((candidate) => [candidate, VEHICLE_SPECS[candidate].weight])),
    ) as VehicleKind

    return this.place(lane, kind, VEHICLE_SPECS[kind], false)
  }

  /**
   * Put a vehicle on a lane, at the entry end, if there is room for it.
   *
   * Returns null rather than clamping when the approach is backed up. Clamping
   * would drop the car on top of the queue it was supposed to join, which is
   * precisely the failure this model was written to eliminate; refusing to spawn
   * is invisible, an overlap is not.
   */
  private place(
    lane: Lane,
    kind: VehicleKind,
    spec: VehicleSpec,
    emergency: boolean,
    atS = spec.length,
  ): VehicleState | null {
    const movement = this.chooseMovement(lane, spec)
    const route = movement.route

    // Room at the entry, measured tail-to-nose across the pair. `s` is the front
    // bumper, so the rearmost vehicle's tail is one length back from its own `s`,
    // and the new vehicle's nose is at `atS`.
    let rearmostTail = Infinity
    for (const vehicle of this.vehicles) {
      if (vehicle.movement.lane.id === lane.id) {
        const tail = vehicle.s - vehicle.spec.length
        if (tail < rearmostTail) {
          rearmostTail = tail
        }
      }
    }

    // Only meaningful when the approach already holds something: with an empty
    // lane `rearmostTail` is Infinity and the comparison below is always false.
    // The new vehicle's nose is at `atS` and it is *behind* everything already on
    // the lane, so it fits only if its nose is a full gap short of the
    // rearmost vehicle's tail. The comparison is `>` and not `>=` so that
    // `warmUp`, which places each vehicle exactly one gap back, is admitted.
    if (rearmostTail !== Infinity && atS > rearmostTail - MIN_GAP) {
      return null
    }

    // s = 0 is the route's start, already past the fog, so parking the tail there
    // means a car fades in from the edge of the world rather than materialising
    // on the first visible metre of tarmac.
    const centre = sampleRoute(route, atS - spec.length / 2)
    const vehicle: VehicleState = {
      id: this.nextId++,
      spec,
      kind,
      paint: this.random.pick(spec.paints),
      s: atS,
      v: spec.maxSpeed * 0.72,
      heading: centre.heading,
      position: { x: centre.x, z: centre.z },
      lane,
      movement,
      waited: 0,
      opacity: 0,
      emergency,
      inBox: false,
    }

    this.vehicles.push(vehicle)
    return vehicle
  }

  /**
   * Which movement this vehicle will make, decided here rather than on arrival.
   *
   * A vehicle picks its lane on the approach and holds it, so the turn it will
   * make is fixed the moment it appears. Deciding it later, at the stop line,
   * would mean a lane change in the last twenty metres, which is the one thing
   * a vehicle in this scene must never be seen to do.
   */
  private chooseMovement(lane: Lane, spec: VehicleSpec): Movement {
    const options = lane.turns.filter((turn) => spec.length < 8 || turn !== 'left')
    const [straight, turn] = options
    const chosen: Turn = turn !== undefined && this.random.next() < 0.26 ? turn : (straight ?? 'through')

    return MOVEMENTS.find(
      (movement) => movement.lane.id === lane.id && movement.turn === chosen,
    ) as Movement
  }

  // --- emergency -------------------------------------------------------------

  /**
   * Preemption is demonstrated, not simulated: the model spawns an ambulance on
   * a random approach every half minute or so and hands its arm to the
   * controller as a preemption request until it has cleared the box.
   *
   * The point of showing it here is that it is the product's one asymmetry. A
   * fixed-cycle signal cannot serve an emergency vehicle faster than its own
   * cycle length, no matter how light the traffic is, and the whole argument for
   * preemption rests on that bound. An ambulance waiting behind a red while an
   * empty road waits behind a green is the clearest possible statement of it,
   * and it costs one vehicle.
   */
  private updateEmergency(dt: number): void {
    this.emergencyTimer -= dt

    if (this.emergencyPending) {
      if (!this.occupiesBox(this.emergencyPending)) {
        this.emergencyPending = null
        this.emergencyActive = false
      }
      return
    }

    if (this.emergencyTimer > 0) {
      return
    }

    this.emergencyTimer = this.random.range(34, 58)

    const lane = this.random.pick(LANES)
    const spec = VEHICLE_SPECS.ambulance
    const vehicle = this.place(lane, 'ambulance', spec, true)

    if (vehicle) {
      this.emergencyPending = vehicle
      this.emergencyActive = true
    }
  }

  /**
   * Is anyone still inside the junction box?
   *
   * Tested by geometry rather than by the route's own `exitS`, because the
   * question the controller is asking is "is the middle of the junction
   * occupied", and the middle of the junction is a place, not an arc length. A
   * vehicle long enough to still be in the box after its front has passed the far
   * edge is exactly the one this has to catch.
   */
  private boxOccupied(): boolean {
    return this.vehicles.some((vehicle) => this.occupiesBox(vehicle))
  }

  private preemptionRequest(): Arm | null {
    if (!this.emergencyPending) {
      return null
    }
    // Until the ambulance is past the junction it wants green. Afterwards the
    // controller goes back to choosing on pressure, and the next green belongs
    // to whichever approach has been waiting longest.
    return this.occupiesBox(this.emergencyPending) ? this.emergencyPending.lane.arm : null
  }

  // --- the model -------------------------------------------------------------

  /**
   * Pressure from everyone queued, and pressure from the left-turners alone.
   *
   * The second figure is what the controller uses to decide whether a protected
   * left phase is worth the cycle time it costs. Reporting them separately is
   * the whole point: a junction with three cars waiting to go straight and one
   * waiting to turn left has a genuinely different right answer than one with
   * four cars waiting to go straight, and a single number cannot tell them apart.
   */
  /**
   * Left-turner pressure from the last `pressure()` call.
   *
   * Written by `pressure()` rather than computed twice, because the controller
   * is stepped with both figures on the same frame and a second walk over the
   * vehicle list would be a second chance to disagree with the first.
   */
  private leftPressure: Record<Arm, number> = { north: 0, east: 0, south: 0, west: 0 }
  private leftWorstWait = 0
  private leftReady: Record<Arm, boolean> = {
    north: true,
    east: true,
    south: true,
    west: true,
  }

  private pressure(): Record<Arm, number> {
    const waiting: Record<Arm, number[]> = { north: [], east: [], south: [], west: [] }
    const lefts: Record<Arm, number[]> = { north: [], east: [], south: [], west: [] }

    for (const vehicle of this.vehicles) {
      // `stopS + 0,05`, not `stopS`. The model already has one definition of
      // "at the line" — `boxConflict`, `holdForBodyConflict` and `holdAt` all use
      // it — and this loop used a stricter one, which made a vehicle stopped
      // exactly on its stop line invisible to the controller. That is not a
      // rounding detail: it is the whole reason the protected left phase never
      // ran. The starved car is the one holding the line, so the one car that
      // most needed a green was the one the controller could not see, and the
      // measured wait reached 592 s.
      //
      // `waited` is capped so that pressure is a measure of how badly traffic is
      // doing *now*, not a measure of how long one unlucky vehicle has been
      // standing there. Uncapped, waiting is self-reinforcing: the longer a
      // vehicle waits, the more pressure it exerts, the more likely it is to be
      // served, and the queue behind it — which has had no part in the wait —
      // never gets a turn. Past this horizon the vehicles are all in the same
      // state, so what remains is decided by `age`, which does rotate.
      if (vehicle.s < vehicle.movement.route.stopS + 0.05) {
        const waited = Math.min(vehicle.waited, PRESSURE_HORIZON)
        waiting[vehicle.lane.arm].push(waited)
        if (vehicle.movement.turn === 'left') {
          lefts[vehicle.lane.arm].push(waited)
        }
      }
    }

    const result = {} as Record<Arm, number>

    for (const arm of ARMS) {
      result[arm] = pressureOf(waiting[arm])
    }

    this.leftPressure = {
      north: pressureOf(lefts.north),
      east: pressureOf(lefts.east),
      south: pressureOf(lefts.south),
      west: pressureOf(lefts.west),
    }

    let worst = 0
    for (const arm of ARMS) {
      for (const waited of lefts[arm]) {
        if (waited > worst) {
          worst = waited
        }
      }
    }
    this.leftWorstWait = worst

    // Which arms' left-turning queues can physically reach their stop line.
    //
    // Lane 0 carries left turns *and* through movements, so a left-turner is
    // queued behind the through traffic sharing its lane — and `gapAhead` makes
    // it wait for that traffic whatever the signal says. A through vehicle
    // standing on the line is therefore a blocker the arrow cannot get past,
    // because the arrow is also what holds that vehicle there. Granting it in
    // that state is a livelock rather than a stall: the arrow empties nothing,
    // times out, and is granted again on the next cycle, and because an arrow
    // keeps being granted the through phase never comes round either.
    //
    // Readiness is read off the vehicles rather than the lane naming, so it stays
    // correct if the lane discipline in `layout.ts` is ever renumbered. A through
    // vehicle still a metre short of its line is not yet a blocker — it is
    // discharging, and the arrow will be reconsidered once it stops.
    const blockedLanes = new Set<string>()
    for (const vehicle of this.vehicles) {
      if (vehicle.movement.turn !== 'through' || vehicle.v > 0.5) {
        continue
      }
      if (vehicle.s < vehicle.movement.route.stopS - 1) {
        continue
      }
      blockedLanes.add(vehicle.lane.id)
    }

    this.leftReady = {} as Record<Arm, boolean>
    for (const arm of ARMS) {
      this.leftReady[arm] = true
    }
    for (const vehicle of this.vehicles) {
      if (vehicle.movement.turn === 'left' && blockedLanes.has(vehicle.lane.id)) {
        this.leftReady[vehicle.lane.arm] = false
      }
    }

    return result
  }

  private updateVehicles(dt: number): void {
    const aspects = this.controller.aspects()

    // In-place compaction rather than `filter`. Forty vehicles a frame is
    // nothing, but this runs on the login page on whatever machine happens to
    // have opened it, and a scene that allocates a fresh array sixty times a
    // second for the privilege of being tidy is a scene that shows up in a
    // profile eventually.
    let write = 0

    for (let read = 0; read < this.vehicles.length; read += 1) {
      const vehicle = this.vehicles[read]
      if (!vehicle) {
        continue
      }

      this.integrate(vehicle, dt, aspects)

      if (vehicle.s >= vehicle.movement.route.total) {
        if (!vehicle.emergency) {
          this.served += 1
        }
        continue
      }

      this.vehicles[write] = vehicle
      write += 1
    }

    this.vehicles.length = write
  }

  private integrate(vehicle: VehicleState, dt: number, aspects: Record<Arm, Aspect>): void {
    const spec = vehicle.spec
    const route = vehicle.movement.route
    // A left-turner is judged on the protected left phase, not on its own
    // approach's through green. That distinction is the entire safety argument:
    // on a through green a left-turner has to decide whether to race an opposing
    // through movement, and on a left phase there is nothing to race because the
    // opposing through is at red.
    const aspect = vehicle.movement.turn === 'left'
      ? this.controller.aspectForLeft(vehicle.lane.arm)
      : aspects[vehicle.lane.arm]

    // Committed, or permitted to go.
    //
    // A vehicle is committed only while it is actually clearing the junction —
    // still rolling in, or already inside the box. Crossing the stop line is not
    // itself the commitment: a car that crossed on the last second of a green and
    // then stopped short of the box is a queue at the line, and honouring its
    // earlier crossing would re-arm it the moment its destination cleared, driving
    // it through a red at speed. That is how a left turner ends up sharing the box
    // with an oncoming car it was shown as waiting for.
    const committed = this.clearingJunction(vehicle)
    const released = committed || (aspect === 'green' && this.mayRelease(vehicle, aspect))

    // Where, if anywhere, this vehicle has to come to a halt. `null` means the
    // road ahead is open to it.
    let holdAt: number | null = null

    if (!released) {
      if (aspect === 'red') {
        holdAt = route.stopS
} else if (aspect === 'amber') {
        // The dilemma zone. Far enough out to stop comfortably, a driver stops;
        // too close, stopping is the more dangerous of the two options, so the
        // car goes. Every real signal is tuned around this and every imitation
        // of one forgets it, and the forgetting looks like a car running an
        // amber it had every chance to obey.
        //
        // Perception-reaction is a *time*, so it has to be paid as distance
        // proportional to speed: at 5 m/s the old flat 2.5 m is exactly right,
        // which is presumably where it came from. As a flat constant it was
        // charged to vehicles that had already reacted, and a vehicle at rest
        // has a braking distance of zero and can always stop. Handing those
        // vehicles 2.5 m of phantom stopping distance put a stopped queue
        // inside a dilemma zone it was not in, and every amber discharged whole
        // platoons that had stopped in perfect order.
        //
        // It is not a small correction. A bus that had waited four seconds on a
        // green, for a car it could see sitting in the path of its right turn,
        // set off the instant the amber appeared, reached the box before the red,
        // and was by then committed — and a committed vehicle cannot be stopped
        // for anything, including the car it was waiting for. The amber was
        // releasing a vehicle that had not moved, straight through the conflict
        // that the green had correctly refused to release it into.
        const reactionDistance = vehicle.v * REACTION_SECONDS
        const stoppingDistance = (vehicle.v * vehicle.v) / (2 * spec.decel) + reactionDistance
        const cannotStop = vehicle.v > 0 && route.stopS - vehicle.s < stoppingDistance
        if (cannotStop) {
          holdAt = null
        } else {
          holdAt = route.stopS
        }
      } else {
        holdAt = route.stopS
      }
    }

    if (released && !committed && this.mustYield(vehicle)) {
      holdAt = route.stopS
    }

    // A long vehicle turning through the junction may need the space in front of
    // this one's stop line, even though the two paths never cross. Applied before
    // the signal does, because a vehicle held at a red is a vehicle that can be
    // hit by a bus it had no way to avoid, and the bus that hit it is committed
    // and cannot stop for it.
    const bodyHold = this.holdForBodyConflict(vehicle)
    if (bodyHold !== null && (holdAt === null || bodyHold < holdAt)) {
      holdAt = bodyHold
    }

    // A turning vehicle that has entered the box but not yet reached the point
    // where it would meet oncoming traffic still yields, and it yields *there*.
    //
    // This is the permissive left turn, and it exists for turns that are NOT
    // protected — right turns into a crossing, and any left that is being run off
    // its own approach's through green.
    //
    // A left being served on its protected phase is skipped, deliberately. The
    // opposing through movement is at red for the whole of that phase, so there is
    // no oncoming traffic to yield to, and asking anyway is what starved the
    // left-turners: they were given a green, crossed the line, and then sat in the
    // junction holding position against a stream that was stopped at the line.
    // Measured at 170 s of wait for a car that had a green the entire time.
    if (
      released &&
      committed &&
      vehicle.movement.turn !== 'through' &&
      !(vehicle.movement.turn === 'left' && this.controller.leftOpen(vehicle.lane.arm))
    ) {
      const conflict = this.holdAtConflict(vehicle)
      if (conflict !== null) {
        holdAt = conflict
      }
    }

    // The free speed: what the road would allow with nobody in the way.
    let free = spec.maxSpeed

    if (vehicle.movement.turn === 'right') {
      // A turning car gives way at the kerb, and the thing it gives way to is a
      // person already in the carriageway. Cheaper to model than to animate and
      // it is the reason the crossing is drawn across the turn's path at all.
      const destination = RIGHT_TARGET[vehicle.lane.arm]
      if (this.crossingOccupied(destination)) {
        free = Math.min(free, 2.2)
      }
    }

    // The signal at the far end of the junction. A vehicle already inside the
    // box is committed, but one that has only just entered it still has to
    // account for the road it is about to reach.
    //
    // `destination.arm` is the arm whose signal *governs* the lane being joined,
    // not the arm the vehicle is driving towards, and the two differ for every
    // turn: a car turning right from the north ends up in the westbound
    // carriageway, which the east arm's signal controls. Reading it the other way
    // round makes cars brake for a red they are never subject to.
    if (released && !vehicle.inBox) {
      const downstream = aspects[vehicle.movement.destination.arm]
      if (downstream === 'red' && vehicle.s - vehicle.spec.length < route.exitS - 4) {
        free = Math.min(free, 6)
      }
    }

    // Car following. The gap to the leader is the physical gap between bumpers
    // minus the standstill margin; the safe speed is the fastest speed from which
    // the vehicle could still stop in that gap.
    const gap = this.gapAhead(vehicle)
    const target = Math.min(free, Math.sqrt(2 * spec.decel * Math.max(0, gap - STANDSTILL_GAP)))

    const delta = target - vehicle.v
    const change = Math.max(-spec.decel * dt, Math.min(spec.accel * dt, delta))
    vehicle.v = Math.max(0, vehicle.v + change)

    if (holdAt !== null) {
      const distance = holdAt - vehicle.s
      // Two brakes at once: the comfort model above, and a hard one that cannot
      // be argued with. The hard brake is what turns "very unlikely to overrun"
      // into "cannot overrun", and it is also what stops a vehicle from
      // creeping through a red at a metre a second because the comfort model is
      // asymptotic at the line.
vehicle.v = Math.min(vehicle.v, Math.sqrt(Math.max(0, 2 * spec.decel * Math.max(0, distance))))
    }

    if (TRACE_BODY && vehicle.id === TRACE_VEHICLE) {
      this.trace(
        `INTEGRATE id=${vehicle.id} s=${vehicle.s.toFixed(2)} v=${vehicle.v.toFixed(2)} holdAt=${holdAt}` +
          ` gap=${gap.toFixed(2)} free=${free.toFixed(2)} target=${target.toFixed(2)}` +
          ` released=${released} committed=${committed} inBox=${vehicle.inBox}`,
        vehicle,
        vehicle,
        {},
      )
    }

    // The hold, applied to the step rather than to the position afterwards.
    //
    // `√(2·decel·d)` reaches zero only as `d` does, so the last step is taken at
    // whatever speed the gap still allows and `s` lands *past* `holdAt`. Measured
    // over ten simulated minutes, that is what every one of the stop-line
    // violations was: sixty-two crossings at between 0.02 and 0.14 m/s, overshooting
    // by at most a millimetre. Not a driver — a rounding artefact of a comfort
    // model asked to stop something that has already stopped. The alternative
    // reading, that a queue discharges through a red at walking pace, is not what
    // the numbers say, but "cannot overrun" is a claim and an asymptote does not
    // make it true.
    //
    // So the step is bounded by the metres actually left to the hold point, which
    // is the same shape as the leader ceiling below and the reason it is written
    // this way rather than as a correction to `s` after the fact. Both of the
    // obvious corrections are worse than the bug, and this is worth writing down
    // because either of them reads like the fix:
    //
    // - `s = min(s, holdAt)` pulls a vehicle that has already stopped *backwards*
    //   to the line it overshot. That is reverse motion, the exact defect the hard
    //   ceiling below exists to make unrepresentable.
    // - `s = max(s, holdAt)` — clamping while the hold point is still ahead — is a
    //   teleport. A car twenty metres back from a red is assigned `s = stopS` on
    //   its first frame, every queue collapses onto its own stop line, and the
    //   junction starts full of overlapping vehicles. It also reports *zero* red
    //   crossings, because every vehicle is standing exactly on its line and none
    //   of them ever crosses one: the metric goes to zero and the simulation stops
    //   being a simulation.
    //
    // Bounding the advance is the one form that is monotone. It cannot move a
    // vehicle backwards, it cannot move one forwards faster than it is travelling,
    // and it makes "cannot overrun" a structural property rather than a measurement.
    let advance = vehicle.v * dt
    if (holdAt !== null) {
      const room = holdAt - vehicle.s
      if (TRACE_BODY) {
        this.traceLines.push(
          `CLAMP [${vehicle.movement.id} s=${vehicle.s.toFixed(2)}]` +
            `  holdAt=${holdAt.toFixed(2)}  room=${room.toFixed(2)}` +
            `  advance=${advance.toFixed(3)}  v=${vehicle.v.toFixed(2)}`,
        )
      }
      if (room > 0 && advance > room) {
        advance = room
        vehicle.v = 0
      }
    }
    vehicle.s += advance

    // The constraint. Not a model — a ceiling. Whatever the comfort model above
    // decided, this vehicle's position is now bounded by the one in front of it.
    const limit = this.leaderLimit(vehicle)
    if (vehicle.s > limit) {
      vehicle.s = limit
      vehicle.v = 0
    }

    const half = spec.length / 2
    const centre = sampleRoute(route, vehicle.s - half)
    vehicle.position = { x: centre.x, z: centre.z }
    vehicle.heading = easeHeading(vehicle.heading, centre.heading, dt)
    vehicle.inBox = this.occupiesBox(vehicle)
    vehicle.waited = vehicle.v < 0.4 ? vehicle.waited + dt : 0

    vehicle.opacity = edgeOpacity(vehicle.s, route.total)
  }

  /**
   * The gap to whatever is in front, in metres, or `Infinity` if the road ahead
   * is clear.
   *
   * Two separate groups, because a vehicle belongs to two different lanes over
   * the course of its journey and conflating them is how a following model ends
   * up braking for traffic that is on a different part of the junction entirely.
   */
  private gapAhead(vehicle: VehicleState): number {
    const laneQ = project(vehicle.position, vehicle.lane.axis)
    let gap = Infinity

    // Vehicles on the identical route share an arc coordinate for their whole
    // journey, so `s` is a comparable ordinate everywhere — including inside the
    // box, where neither lane projection below applies. A lead vehicle that
    // slows to negotiate a conflict inside the junction must not collect the
    // queue behind it, so the following model has to reach through the box too.
    for (const other of this.vehicles) {
      if (other === vehicle || other.movement.id !== vehicle.movement.id) {
        continue
      }
      if (other.s > vehicle.s + 0.05) {
        gap = Math.min(gap, other.s - vehicle.s - bumperGap(vehicle, other))
      }
    }

    // On the approach, the leader is the vehicle ahead in the same lane. The test
    // stops at the junction box: a car that has turned away curves off this axis
    // and stops being a leader, and continuing to count it would hold up traffic
    // behind a queue for a vehicle that is no longer in the way.
    if (laneQ <= -JUNCTION_HALF + 0.25) {
      for (const other of this.vehicles) {
        if (
          other === vehicle ||
          other.movement.lane.id !== vehicle.lane.id ||
          other.movement.id === vehicle.movement.id
        ) {
          continue
        }
        const otherQ = project(other.position, vehicle.lane.axis)
        if (otherQ > laneQ + 0.05) {
          gap = Math.min(gap, otherQ - laneQ - bumperGap(vehicle, other))
        }
      }
    }

    // The leader that turns away, and the leader this vehicle is about to catch up
    // with at the point where the lane splits. Same rule as the hard ceiling, one
    // branch lower: the ceiling is what makes the collision impossible, and this
    // is what makes the vehicle arrive at it having braked for it rather than
    // being found stopped against it.
    for (const other of this.vehicles) {
      if (other === vehicle) {
        continue
      }
      const limit = this.sharedLaneLeaderLimit(vehicle, other)
      if (Number.isFinite(limit)) {
        gap = Math.min(gap, limit - vehicle.s + bumperGap(vehicle, other))
      }
    }

    // Past the box, the leader is the vehicle ahead on the lane being joined.
    const destinationQ = project(vehicle.position, vehicle.movement.destination.axis)
    if (destinationQ >= JUNCTION_HALF) {
      for (const other of this.vehicles) {
        if (
          other === vehicle ||
          other.movement.destination.id !== vehicle.movement.destination.id ||
          other.movement.id === vehicle.movement.id
        ) {
          continue
        }
        const otherQ = project(other.position, vehicle.movement.destination.axis)
        if (otherQ > destinationQ + 0.05) {
          gap = Math.min(gap, otherQ - destinationQ - bumperGap(vehicle, other))
        }
      }
    }

    return gap
  }

  /**
   * The ceiling imposed by a vehicle that left this one's lane but has not yet
   * left its road.
   *
   * Two movements out of one lane — a left and a through — are the pair the rest
   * of this file is most conspicuous in ignoring. Their centrelines never cross,
   * so the conflict table has nothing to say about them, and they are not the
   * same movement, so the identical-route leader above cannot see them either.
   * That leaves the stretch where the two share lane markings and nothing
   * watching it, and it is watched badly in practice: a car that has entered the
   * box behind a left turner finds no leader in front of it, accelerates, and
   * arrives at the point where the lane splits exactly as the turner's tail is
   * still across it. The two paths are a metre and a half apart there. The
   * vehicles are not.
   *
   * The constraint is the ordinary one — my front bumper stops at the leader's
   * rear bumper — and it is stated in `s` because for as long as the two are on
   * the shared part of the lane, `s` is one ordinate that both of them still
   * mean the same thing. It is released the moment the leader's rear passes the
   * divergence arc, and not before, because past that point the leader is on
   * different road and clamping to its tail would drag a following car backwards
   * for the length of the turn.
   *
   * This is deliberately *not* a swept-body test. A swept body overlaps anything
   * whose route it passes, and both of these routes are the same route until the
   * split, so a sweep would report every queued pair on the approach as a
   * conflict and the junction would refuse to discharge. What has to be stopped
   * is a car running into the back of the car in front of it, and that is a
   * longitudinal fact about one pair of bumpers, not a geometric one.
   */
  private sharedLaneLeaderLimit(vehicle: VehicleState, other: VehicleState): number {
    if (other.lane.id !== vehicle.lane.id || other.movement.id === vehicle.movement.id) {
      return Infinity
    }
    if (other.s <= vehicle.s + 0.05) {
      // Behind, or abreast. Abreat vehicles are not leaders; ordering them is
      // the divergence interlock's job, not this one's.
      return Infinity
    }
    const split = DIVERGENCE.get(other.movement.id)?.get(vehicle.movement.id)
    if (split === undefined) {
      return Infinity
    }
    if (other.s - other.spec.length > split) {
      // The leader's tail has left the shared road. From here the two are on
      // separate paths and there is nothing left to follow.
      return Infinity
    }
    return other.s - other.spec.length - MIN_GAP
  }

  /**
   * The hard ceiling on this vehicle's arc length, on the approach.
   *
   * Returned rather than applied inline because it is the single most important
   * line in the file, and a reader looking for the rule that makes queue order
   * inevitable should find it in one place, named, with nothing around it.
   *
   * Approach only, and only for vehicles in the same lane. That is a deliberate
   * limit on the rule's scope rather than an oversight: it is the one case where
   * both vehicles count distance from the same origin along the same line, which
   * is the precondition for comparing arc lengths at all. The exit leg — where
   * two approaches merge into one lane and the distances are not comparable — is
   * handled by refusing entry instead, in `exitBlocked`.
   */
  private leaderLimit(vehicle: VehicleState): number {
    const laneQ = project(vehicle.position, vehicle.lane.axis)
    let limit = Infinity

    // Identical-route vehicles constrain each other through the whole journey,
    // box included. The lane projection used below measures distance towards the
    // junction, which stops meaning anything the moment the junction is entered;
    // `s` is the one ordinate that both vehicles still share on the far side of
    // the stop line, so it is the one the hard ceiling can be stated in.
    for (const other of this.vehicles) {
      if (other === vehicle || other.movement.id !== vehicle.movement.id) {
        continue
      }
      if (other.s > vehicle.s + 0.05) {
        limit = Math.min(limit, other.s - other.spec.length - MIN_GAP)
      }
    }

    if (laneQ <= -JUNCTION_HALF + 0.25) {
      for (const other of this.vehicles) {
        if (
          other === vehicle ||
          other.movement.lane.id !== vehicle.lane.id ||
          other.movement.id === vehicle.movement.id
        ) {
          continue
        }
        const otherQ = project(other.position, vehicle.lane.axis)
        if (otherQ > laneQ + 0.05) {
          limit = Math.min(limit, other.s - other.spec.length - MIN_GAP)
        }
      }
    }

    // The leader that turns away. Scoped to the shared stretch of lane, so this
    // reaches inside the junction and stops there — the moment the leader's tail
    // is past the point where the two part company, the constraint is lifted and
    // the follower is left to its own path.
    for (const other of this.vehicles) {
      if (other === vehicle) {
        continue
      }
      limit = Math.min(limit, this.sharedLaneLeaderLimit(vehicle, other))
    }

    return limit
  }

  /**
   * Is the lane this vehicle is joining too full to take it?
   *
   * Every approach here has a straight-through movement into the innermost
   * destination lane, and every turning movement has one into the same innermost
   * lane, so the far side of the junction is a genuine merge: four lanes become
   * one. Two vehicles that want the same metres have to be ordered, and the only
   * place to do that honestly is *before* they arrive, because once they are both
   * in the box their arc lengths are measured from different origins and no
   * arithmetic can relate them.
   *
   * The alternative — clamping a follower to a leader's tail once both are in the
   * box — produces a negative correction the moment the leader is long and only
   * just ahead, because a bus whose *centre* is 10 cm in front has its tail five
   * metres behind. That correction is applied to arc length, so it drags the
   * follower backwards, and the scene shows vehicles reversing out of a junction
   * and driving through one another. Refusing to enter is invisible; that is not.
   */
  private exitBlocked(vehicle: VehicleState): boolean {
    if (vehicle.s >= vehicle.movement.route.stopS) {
      return false
    }

    const destination = vehicle.movement.destination
    // Only vehicles that have reached the junction count. Someone still a
    // hundred metres back on an approach is not in anybody's way, and treating
    // them as though they were holds the box shut for ever.
    const required = vehicle.spec.length + MIN_GAP

    for (const other of this.vehicles) {
      if (other === vehicle || other.movement.destination.id !== destination.id) {
        continue
      }
      const otherQ = project(other.position, destination.axis)
      if (otherQ <= -JUNCTION_HALF) {
        continue
      }
      if (otherQ - other.spec.length / 2 - required < JUNCTION_HALF) {
        return true
      }
    }

    return false
  }

  /**
   * Is any vehicle in the box on a path that crosses this one's?
   *
   * The pair that matters here is a left turn against opposing through traffic,
   * and the reason it needs handling at all is a consequence of the phase plan:
   * this junction runs two phases, so west and east are green *at the same time*,
   * and a car turning left out of the east approach therefore meets a car driving
   * straight through from the west. That is a permissive left turn, and the real
   * answer is not a protected phase — adding one would double the cycle length
   * and change the product — it is gap acceptance: turn when the road is clear
   * enough to get across, and wait when it is not.
   *
   * So the rule is asymmetric in a way that is easy to get backwards. A left
   * turn yields to opposing through traffic, always, because it has to. A through
   * movement does *not* yield to a left turner, because the left turner is the one
   * that accepted the risk of being there. Making both yield deadlocks the phase;
   * making neither produce two vehicles in the same place.
   */
  private boxConflict(vehicle: VehicleState): boolean {
    if (vehicle.s >= vehicle.movement.route.stopS + 0.05) {
      return false
    }

    // Gap acceptance for a turner, asked once rather than once per oncoming
    // vehicle, because the question is about the *stream* and not about the first
    // car in it. See `opposingStreamBlocks`.
    if (vehicle.movement.turn !== 'through' && this.opposingStreamBlocks(vehicle)) {
      return true
    }

    for (const other of this.vehicles) {
      if (other === vehicle) {
        continue
      }
      const centres = routesConflict(vehicle.movement, other.movement)
      const bodies = !centres && this.bodyConflict(vehicle, other)
      if (!centres && !bodies) {
        continue
      }

      // Something already occupying the shared space, or that has crossed its own
      // stop line and is on its way in. The second case closes the race: a turner
      // that commits half a second before its opponent reaches the box is not yet
      // in `crossingNow`'s box test, but it is in the box as far as the law that
      // says two vehicles cannot occupy the same metres goes. Blocking once either
      // side is committed serialises entry on routes that cross, which is the
      // whole of the safety argument for a two-phase junction.
      if (
        this.crossingNow(other) ||
        (other.s > other.movement.route.stopS + 0.05 && other.v > 0.5 && this.occupiesBox(other))
      ) {
        return true
      }

      // A turner yields to a vehicle still on its approach; a through movement
      // does not, because the turner is the one that accepted the risk of being
      // in the box. Making both yield would deadlock the phase.
      //
      // Restricted to pairs that actually cross, because for a pair that only
      // meets body to body there is nothing to yield *to*: neither vehicle is on
      // anybody's path, and the rule would serialise two lanes that are free to
      // run together. Those pairs are ordered in `holdForBodyConflict` instead.
      if (centres && this.divergeBlocked(vehicle, other)) {
        return true
      }

      if (bodies && this.sweptOverAStoppedBody(vehicle, other)) {
        return true
      }
    }

    return false
  }

  /**
   * Would this vehicle's body swing across a lane in which a vehicle is standing?
   *
   * The missing half of `holdForBodyConflict`, and the one that closes the last
   * of the overlaps.
   *
   * That rule orders a body-only pair by length: the shorter vehicle gives way,
   * by standing `MIN_GAP` short of the arc at which the longer one's body can
   * reach it. The order is arithmetic and it is correct, and it is still not
   * enough, because an order is only worth anything to a vehicle that can carry
   * it out. The give-way point for a car beside a bus turning right sits
   * *behind* the car's own stop line — measured at 72,45 against a line at
   * 76,00, two and a half metres short of it — so the car is told to wait at a
   * place it has already passed. The clamp in `integrate` cannot put it back
   * without being reverse motion, which this file treats as unrepresentable, and
   * the car sits on its line and is taken out by the tail sweeping across the
   * lane beside it. Measured over eight seeds at demand default: 58 overlaps, all
   * of them this pair, and in every one of them the shorter vehicle was stopped
   * while the longer one was moving.
   *
   * So the deferral cannot be the whole of it. What makes the pair a conflict is
   * not that a short body is in the way of a long one — it is that a long body
   * *swings* — and only one of the two can do anything about that. The car at the
   * line is there because the signal put it there, and it cannot leave: it is
   * waiting for an arrow. The bus at its own line is there because a queue let it
   * get that far, and it can perfectly well stay there for another three seconds.
   * Asymmetry is not a preference here, it is the only ordering of the pair that
   * both halves of it can execute.
   *
   * Two things keep this from being a junction that stops. It asks about the
   * vehicle's *body* and not about its movement, so a through movement in the
   * kerbside lane never triggers it — a straight body never leaves its lane, and
   * the band for that pair is empty, so the geometry decides and not this rule.
   * And it asks about the standing vehicle's ability to *leave*, not about its
   * presence: a vehicle that is already past the band is not in the way, and one
   * that is still far enough back to stop before it will never be.
   *
   * The "far enough back to stop" is the same braking law the followers model and
   * the red-line clamp use, and it is used here for the same reason: it is a fact
   * about one vehicle and its own road, so unlike a race between two arrival times
   * it cannot come out differently depending on which of the two is asked. A car
   * thirty metres back doing ten metres a second needs twelve and a half metres to
   * stop and can do it in the gap; a car four metres back doing the same cannot,
   * and the bus has to wait. What the car cannot do, the model does not pretend it
   * can.
   */
  private sweptOverAStoppedBody(vehicle: VehicleState, other: VehicleState): boolean {
    // The band on the *other* vehicle's own route: the stretch of its road over
    // which this vehicle's body can reach it. `bodyConflict` has already asked the
    // mirror of this question and found a band, so the answer here is a lookup.
    const band = bodyOverlapSpan(other.movement, other.spec, vehicle.movement, vehicle.spec)
    if (band === null) {
      return false
    }

    // Past the far end of the band, it is out of the way and will stay out of it.
    if (other.s > band.end) {
      return false
    }

    // Short of the band, but able to pull up before it. The point it would have to
    // stop at is the one `holdForBodyConflict` orders it to, so the two halves of
    // the rule agree on the same metre rather than each inventing one.
    const giveWay = band.start - MIN_GAP
    const brakeRoom = (other.v * other.v) / (2 * other.spec.decel)
    if (TRACE_BODY) {
      this.traceLines.push(
        `SWEEP [${vehicle.movement.id} s=${vehicle.s.toFixed(2)} L=${vehicle.spec.length}]` +
          `  vs [${other.movement.id} s=${other.s.toFixed(2)} v=${other.v.toFixed(2)}]` +
          `  banda ${band.start.toFixed(2)}..${band.end.toFixed(2)}` +
          `  giveWay=${giveWay.toFixed(2)} brakeRoom=${brakeRoom.toFixed(2)}` +
          `  => ${other.s + brakeRoom <= giveWay ? 'NO' : 'BLOQUEA'}`,
      )
    }
    if (other.s + brakeRoom <= giveWay) {
      return false
    }

    return true
  }

  /**
   * Is the shared entry lane ahead of this vehicle still being used up?
   *
   * The case the centreline table cannot express, because it is deliberately not
   * in it. Two movements out of the same lane — a left and a through — share
   * their entry and then diverge, and their centrelines never cross, so the table
   * has nothing to say about them. Their *bodies* do overlap, briefly, at the
   * point where the shared lane splits: a follower that reaches the split while
   * the leader is still straddling it clips the leader's outside corner.
   *
   * The remedy is a divergence interlock. The follower waits until the leader's
   * rear has passed the arc at which the two paths are a car-width apart, which
   * is early — the divergence happens at the entrance to the box, not in the
   * middle of it — so a leader that is turning does not hold up the traffic
   * behind it for the length of the turn. It only holds it for the moment in
   * which the two vehicles are genuinely in the same piece of road.
   *
   * Through traffic is not made to yield to a turner, which is the asymmetry the
   * rest of this file depends on: the leader here is ahead, and being ahead is
   * the whole of the claim.
   */
  private divergeBlocked(vehicle: VehicleState, other: VehicleState): boolean {
    if (other.lane.id !== vehicle.lane.id) {
      return false
    }
    // Only the vehicle behind is gated. `s` is comparable between two vehicles on
    // a shared lane for as long as they are on the shared part of it, which is
    // exactly the region this interlock is about.
    if (other.s <= vehicle.s + 0.05) {
      return false
    }
    const split = DIVERGENCE.get(other.movement.id)?.get(vehicle.movement.id)
    if (split === undefined) {
      return false
    }
    return other.s - other.spec.length < split + MIN_GAP
  }

  /**
   * Is the opposing stream going to arrive at this turner's crossing while the
   * turner is still in it?
   *
   * This is the permissive left turn, and the honest form of it asks about the
   * whole opposing stream rather than about the vehicle nearest to the stop
   * line. The earlier version of this test measured the distance to that one
   * vehicle and compared it with a figure generous enough to cover the turner's
   * own crossing — which is right when the opposing approach is free-flowing and
   * badly wrong when it is a queue twenty vehicles deep, because the car behind
   * the one being measured arrives a second later and the turner is still in the
   * junction. Under a queue the turner was being handed a gap that was never
   * there, and the collisions it produced were all in the same place: the corner
   * where the two paths cross, at a few centimetres' depth.
   *
   * So the turner is timed against every vehicle that will reach its crossing,
   * using the speed the opposing lane will reach rather than the speed it happens
   * to have — a car stopped in a queue is not arriving at all, and a car stopped
   * in a queue at a green is arriving at about the speed of the queue. The turner
   * proceeds only if the whole stream will be past the crossing, or not yet at
   * it, for as long as it is in the crossing itself.
   *
   * The consequence under saturation is a left turner that waits, which is what a
   * left turner does. It is not a defect of the model to say so: a junction with
   * a permanently full opposing approach has no gap to accept, and pretending
   * otherwise is what puts two cars in the same corner.
   */
  private opposingStreamBlocks(turner: VehicleState): boolean {
    // A left-turner being released from its own protected left phase is not
    // permissive and does not yield. The opposing through movement is at red for
    // the whole of that phase, so there is no stream to yield to, and asking the
    // question anyway would be asking a question whose premise the signal has
    // already answered.
    //
    // This is the line between the two designs. With it, the left phase is
    // protected and the collision cannot be constructed. Without it, we are back
    // to timing arithmetic, and the arithmetic is what failed five times.
    if (
      turner.movement.turn === 'left' &&
      this.controller.leftOpen(turner.lane.arm)
    ) {
      return false
    }

    const table = CONFLICTS.get(turner.movement.id)
    if (!table || table.size === 0) {
      return false
    }

    // How long this turner needs from where it is now to being entirely past the
    // crossing. Judged from rest at a speed it will actually attain, because
    // `turner.v` is zero at the moment the decision is made and a window
    // computed from a stationary vehicle is a window of zero length.
    //
    // A turn speed, not a road speed. 5.5 m/s is an acceleration on a straight
    // road and never happens in a turn: the geometry holds a turner to about
    // 3 m/s. Understating your own occupancy is the one error that hands you a gap
    // that is not there — the turner believes it needs 3.5 s for a crossing it
    // takes five, and commits on the strength of it.
    const launch = 5.5
    const MARGIN = 0.8

    for (const [otherId, arc] of table) {
      const otherArc = CONFLICTS.get(otherId)?.get(turner.movement.id)
      if (otherArc === undefined) {
        continue
      }
      const clearing = (arc - turner.s + turner.spec.length) / launch + MARGIN

      for (const other of this.vehicles) {
        if (other.movement.id !== otherId) {
          continue
        }
        const rear = other.s - other.spec.length
        if (rear > otherArc) {
          // Entirely past its side of the crossing. It cannot come back.
          continue
        }
        if (this.arrivalTime(other, otherArc) < clearing) {
          return true
        }
      }
    }

    return false
  }

  /**
   * When will this vehicle's rear reach a given arc on its own route?
   *
   * The obvious answer — distance over current speed — is unusable at a green
   * start, which is when the question is actually asked. Every opposing vehicle
   * is stationary at that moment, so the answer is `Infinity` for all of them,
   * the turner is handed the whole opposing approach, and the collision lands
   * three seconds later at the corner where the two paths meet. Substituting a
   * cruise speed for the stationary one does not fix it, it inverts it: reading a
   * queued car as though it were already doing thirty kilometres an hour says it
   * will be at the crossing sooner than it can possibly manage, so the gap is
   * reported as clear while the queue is still discharging into it.
   *
   * So the answer is the *earliest* time this vehicle could possibly be at the
   * arc: it holds full acceleration the whole way, and once it reaches its own
   * top speed it holds that. That is a bound in the only direction that is safe.
   * Every caller asks "can that vehicle reach this arc before I am clear of it",
   * so a bound that is too *late* does not merely wait a moment — it reports a
   * gap that does not exist and lets two vehicles into the same square metres.
   *
   * This was written as the maximum of two terms, "accelerating from rest" and
   * "cruising at top speed", on the reasoning that the truth is the later of the
   * two. That reasoning is right about a stationary vehicle and quietly wrong
   * about a moving one, and it was the cause of the corner clip in the inner
   * lane. `fromRest` answers a question about a vehicle that is not moving, so
   * applying it to one that is doing 6,5 m/s reports an eleven-metre bus as taking
   * 4,8 s to cover 11,5 m when at that speed it takes 1,8 s — and because the
   * callers compare *their* time against *this* one, a bus inflated threefold is
   * a bus reported as safe to ignore. The car waiting at the line is handed a gap
   * of two thirds of a second that does not exist, crosses, and is taken out by
   * the tail sweeping across the lane beside it.
   *
   * The two terms were never equally valid; they were valid in different
   * regimes. Integrated properly there is a single curve, and it reduces to
   * `fromRest` exactly when the vehicle is stationary, which is the case the
   * original was written for and the one that motivated it.
   */
  private arrivalTime(vehicle: VehicleState, arc: number): number {
    const distance = Math.max(0, arc - (vehicle.s - vehicle.spec.length))
    if (distance === 0) {
      return 0
    }
    const spec = vehicle.spec
    const v0 = Math.max(0, vehicle.v)
    // Distance needed to reach this vehicle's own top speed, and zero if it is
    // already at or above it.
    const toTop = (Math.max(0, spec.maxSpeed ** 2 - v0 ** 2)) / (2 * spec.accel)
    if (distance <= toTop) {
      // Still accelerating: v² = v0² + 2as, so the time is the speed it gains
      // over the acceleration it has. From rest this is exactly sqrt(2d/a).
      return (Math.sqrt(v0 * v0 + 2 * spec.accel * distance) - v0) / spec.accel
    }
    return (Math.max(0, spec.maxSpeed - v0)) / spec.accel + (distance - toTop) / spec.maxSpeed
  }


  /**
   * Where to wait, short of the stop line, for a long vehicle to swing past.
   *
   * The case `boxConflict` cannot reach, and the one that produces the collision
   * a twelve-metre bus makes on a four-metre car. The car is not trying to enter
   * the junction: it is stopped at its own line on a red, doing everything right,
   * and the bus — committed, mid-turn, unable to stop — sweeps its tail across
   * the lane beside it. Refusing entry does nothing for a vehicle that is not
   * entering.
   *
   * So the car is asked to wait a little further back, and the distance it is
   * asked to give up is not a fudge factor: it is the arc on this vehicle's own
   * route at which its body would first meet the other one's swept body, minus
   * the standing gap. The car therefore stops exactly where the bus's tail stops
   * reaching, which is where a driver who had seen the bus coming would have
   * stopped.
   *
   * Only ever the shorter vehicle, and only ever for a partner that is imminent.
   * Both halves of that are load-bearing. A longer vehicle that deferred to a
   * shorter one would be stopping a bus for a car it could have gone around; a
   * deferral to a bus forty metres back would hold the lane open for traffic that
   * is not coming. The tie-break on equal lengths is arbitrary and exists only
   * so that two buses abreast cannot each conclude that the other was going to
   * wait — which is a deadlock dressed up as politeness.
   */
  private holdForBodyConflict(vehicle: VehicleState): number | null {
    if (vehicle.s >= vehicle.movement.route.stopS + 0.05) {
      return null
    }

    let earliest: number | null = null

    for (const other of this.vehicles) {
      if (other === vehicle) {
        continue
      }
      if (routesConflict(vehicle.movement, other.movement)) {
        if (TRACE_BODY) {
          this.trace('routesConflict -> continue', vehicle, other, {})
        }
        continue
      }
      const bodies = this.bodyConflict(vehicle, other)
      const rank = bodies ? this.outranked(vehicle, other) : false
      if (!bodies || !rank) {
        if (TRACE_BODY) {
          this.trace(
            `continue: bodyConflict=${bodies} outranked=${rank}`,
            vehicle,
            other,
            {},
          )
        }
        continue
      }

      // Where the follower's own body can be touched at all, along its whole
      // possible journey. Used only to find *where to stand*: the front of that
      // band is the last place ahead of this vehicle that is not in the way.
      const span = bodyOverlapSpan(vehicle.movement, vehicle.spec, other.movement, other.spec)
      if (span === null) {
        if (TRACE_BODY) {
          this.trace('continue: span null', vehicle, other, {})
        }
        continue
      }
      const holdAt = Math.max(0, span.start - MIN_GAP)

      // The other vehicle's journey, tested against every place *this* one might
      // come to a stop between the hold point and its own line. Not against the
      // hold point alone: the follower is released to advance as soon as the
      // other can no longer reach where it is standing, and if the release is
      // computed from a single point then a follower standing well back is told
      // the road is clear and drives the last three metres into a bus that is
      // still crossing the lane it is driving into. Not against this vehicle's
      // whole route either, for the reason the other side of the pair gives: a car
      // waiting at a line is not a car that will travel its route, and the arcs
      // beyond the junction are the ones it will never occupy.
      const pinned = pinnedBodySpan(vehicle, holdAt, vehicle.movement.route.stopS, other)
      if (pinned === null) {
        if (TRACE_BODY) {
          this.trace('continue: pinned null', vehicle, other, { holdAt })
        }
        continue
      }
      if (other.s - other.spec.length > pinned.end) {
        if (TRACE_BODY) {
          this.trace(
            `continue: ya no alcanza (rear ${(other.s - other.spec.length).toFixed(2)} > pinned.end ${pinned.end.toFixed(2)})`,
            vehicle,
            other,
            { holdAt, pinned },
          )
        }
        continue
      }
      // Still in reach. Whether the follower waits or commits is now a question
      // about time, and it is only a fair question for the vehicle at the head of
      // its queue.
      const outruns = this.outrunsTheSweep(vehicle, other, pinned.start)
      if (TRACE_BODY) {
        this.trace(
          outruns
            ? `PASA: outrunsTheSweep = true (se cree con tiempo)`
            : `RETENIDO en ${holdAt.toFixed(2)}`,
          vehicle,
          other,
          {
            holdAt,
            pinned,
            outruns,
            myTime: (vehicle.movement.route.exitS - vehicle.s) / 5.5 + 0.8,
            at: this.arrivalTime(other, pinned.start),
          },
        )
      }
      if (!outruns) {
        if (earliest === null || holdAt < earliest) {
          earliest = holdAt
        }
      }
    }

    return earliest
  }

  /** The decisions taken since the last `takeTrace()`. Empty unless `setBodyTrace`
   *  was called: the guarded callers check before building any string, so in a
   *  default run this stays empty rather than holding stale diagnostics. */
  private traceLines: string[] = []

  /** Hand over the buffered decisions and start a new buffer. */
  takeTrace(): string[] {
    const out = this.traceLines
    this.traceLines = []
    return out
  }

  private trace(why: string, vehicle: VehicleState, other: VehicleState, extra: Record<string, unknown>): void {
    this.traceLines.push(
      `[${vehicle.movement.id} s=${vehicle.s.toFixed(2)} v=${vehicle.v.toFixed(2)} L=${vehicle.spec.length}` +
        `  vs  ${other.movement.id} s=${other.s.toFixed(2)} v=${other.v.toFixed(2)} L=${other.spec.length}]` +
        `  ${why}` +
        Object.entries(extra)
          .filter(([, v]) => typeof v === 'number')
          .map(([k, v]) => `  ${k}=${(v as number).toFixed(3)}`)
          .join(''),
    )
  }

  /**
   * Can this vehicle be out of the junction before that one reaches the arc where
   * their bodies would meet?
   *
   * Two questions have to be answered together, and the first one is a matter of
   * eligibility rather than arithmetic.
   *
   * A vehicle with another of its own kind in front of it cannot answer for
   * itself. Its clearance time is not its own: it is stationary behind a vehicle
   * that is stationary behind a vehicle that is stationary, and a time computed
   * from its nose as though it were alone on the road is fiction. An earlier
   * version of this rule made exactly that mistake and the consequence was a queue
   * that crept forward into the swept band while the arithmetic said it had time,
   * arriving at the stop line a metre inside a bus's tail. So a vehicle that is
   * not at the head of its queue always waits, and only the head of the queue is
   * allowed to run the race.
   *
   * The head of the queue can run it honestly. Its clearance time is measured to
   * the exit arc at a speed it will actually attain — not its current speed,
   * which is zero at the moment the question is asked and would make the window
   * vanish — and the other vehicle's arrival is measured with the same honest
   * bound `arrivalTime` uses everywhere else, so a bus still standing at a red is
   * read as accelerating away from the line rather than as sitting in the road
   * for ever. The margin is deliberate: the estimate is a launch speed, not a
   * prediction, and the cost of being wrong is a collision in the corner where
   * two paths meet.
   */
private outrunsTheSweep(vehicle: VehicleState, other: VehicleState, theirArc: number): boolean {
    if (this.queuedBehind(vehicle)) {
      return false
    }
    const launch = 5.5
    const myTime = (vehicle.movement.route.exitS - vehicle.s) / launch + 0.8
    return this.arrivalTime(other, theirArc) > myTime
  }

  /**
   * Is there a vehicle in front of this one that it cannot get past?
   *
   * Both ways of being in front count. The same movement is the ordinary queue,
   * compared in `s`, which is the one ordinate they still share once the junction
   * is entered. The same lane is the case the conflict table ignores — a left
   * turner in the box with a car behind it on the same lane but a different
   * movement, which shares no arc length with the follower and can only be found
   * by projecting both onto the lane axis.
   */
  private queuedBehind(vehicle: VehicleState): boolean {
    const laneQ = project(vehicle.position, vehicle.lane.axis)
    for (const other of this.vehicles) {
      if (other === vehicle) {
        continue
      }
      if (other.movement.id === vehicle.movement.id && other.s > vehicle.s + 0.05) {
        return true
      }
      if (other.movement.lane.id !== vehicle.lane.id) {
        continue
      }
      if (project(other.position, vehicle.lane.axis) > laneQ + 0.05) {
        return true
      }
    }
    return false
  }

  /**
   * Would these two routes put a bus and a car into the same square metres?
   *
   * The centreline table above answers "do the paths cross", and for a bus whose
   * front is in the box the answer is yes while the geometry says otherwise: a
   * long body rotates across the lanes beside it, and the two centrelines never
   * come within a vehicle's width of each other. The rear of a bus turning right
   * out of the outer lane crosses the inner lane's path with a metre and a half
   * to spare, and no amount of care about crossing arcs will see it.
   *
   * So the question is asked of the bodies, at the sizes the two vehicles
   * actually are. That is the point of doing it at runtime rather than
   * precomputing a design-vehicle table: the same pair of movements is a
   * conflict between a bus and a van and emphatically not a conflict between a
   * van and a car, and a table could only answer for one of those.
   *
   * It has to stay cheap, because it is asked per vehicle per frame. The answer
   * depends only on the two movements and the two sizes, so it is computed once
   * and remembered; four sizes across twenty-four movements is a few thousand
   * possible pairs, of which the live model touches the handful that share a
   * green.
   */
  private bodyConflict(vehicle: VehicleState, other: VehicleState): boolean {
    // Two arms on different axes are never green together, so a body overlap
    // between them is not a conflict to arbitrate — it is two vehicles crossing
    // at different times, and the centreline table owns the case where the
    // clearance windows do overlap. Same arm and opposing arm are the two
    // cases that share a green.
    const arm = vehicle.lane.arm
    if (other.lane.arm !== arm && other.lane.arm !== OPPOSITE[arm]) {
      return false
    }
    // Same lane, or same lane being joined: the followers model and the merge
    // interlock own those, for the same reason the centreline table skips them.
    if (
      vehicle.lane.id === other.lane.id ||
      vehicle.movement.destination.id === other.movement.destination.id
    ) {
      return false
    }
    return bodiesConflict(vehicle.movement, vehicle.spec, other.movement, other.spec)
  }

  /**
   * Does the other vehicle outrank this one for the shared body?
   *
   * Ordered strictly, so that two vehicles on a body-only pair can never each
   * decide the other is the one that waits. Length decides it, on the grounds
   * that a vehicle whose body is the thing in the way cannot be asked to give
   * way without being stopped in the middle of a movement it has started.
   *
   * Movement id is the tie-break for equal lengths, and it is arbitrary: nothing
   * about a northbound left turn gives it a claim on the box ahead of a
   * northbound right turn. It is here only to make the relation a total order.
   */
  private outranked(vehicle: VehicleState, other: VehicleState): boolean {
    const TIE = 0.25
    if (other.spec.length > vehicle.spec.length + TIE) {
      return true
    }
    return (
      Math.abs(other.spec.length - vehicle.spec.length) <= TIE && other.movement.id < vehicle.movement.id
    )
  }

  /**
   * Where this turner must halt, if anywhere, to let the crossing empty.
   *
   * Returns `null` when the road is clear, which is the common case and the one
   * that must stay cheap. Otherwise the arc before which this vehicle must not go
   * uncommitted — past that point it is in the crossing with oncoming traffic and
   * cannot stop.
   *
   * The arc is geometric: the earliest point on this route at which it meets a
   * conflicting lane, backed off by the turner's own half width so that stopping
   * there leaves the whole body short of the crossing rather than a bumper
   * resting on it. The *decision* to go is not geometric, and this method used to
   * get that wrong in a way that showed up as collisions in the same corner
   * every time: it released the turner as soon as the oncoming vehicle nearest
   * the stop line had passed. Under a queue that is the leader of a platoon, and
   * the second car — two seconds behind, already committed and accelerating —
   * arrived at the crossing while the turner was still in it. The turner had
   * been cleared for traffic that had not gone by.
   *
   * So the release is now the same question the turner was asked before it left
   * the stop line, asked again from where it now stands, and answered about the
   * whole stream: `opposingStreamBlocks` requires that no vehicle on a
   * conflicting movement will reach its crossing for as long as this turner
   * needs to be out of the way. Asking it twice is not redundant. The first
   * question is asked from a standstill at the line and the second from a
   * standstill at the yield point, and the stream is a different length of road
   * away each time — a gap that was real at the first crossing may be gone by the
   * time the turner has crept up to the second.
   */
  private holdAtConflict(vehicle: VehicleState): number | null {
    if (vehicle.movement.turn === 'through') {
      return null
    }
    const table = CONFLICTS.get(vehicle.movement.id)
    if (!table) {
      return null
    }

    // The commitment point: the earliest crossing still live, on any conflicting
    // movement that has a vehicle in it. A vehicle whose rear is past its own side
    // of the crossing cannot arrive here again and is not counted, so an empty
    // opposing approach costs nothing.
    let commit: number | null = null
    for (const [otherId, arc] of table) {
      if (arc <= vehicle.s) {
        continue
      }
      if (!this.stillApproaching(otherId, vehicle.movement.id)) {
        continue
      }
      if (commit === null || arc < commit) {
        commit = arc
      }
    }
    if (commit === null) {
      return null
    }
    if (!this.opposingStreamBlocks(vehicle)) {
      return null
    }

    // Short of the crossing, backed off by the turner's own half width — and
    // never past its own stop line.
    //
    // The commitment arc sits well inside the junction: north-0:left holds at
    // 79,7 with its line at 76,0, and that point is three metres past the line.
    // A turner parked there is a turner standing in the box, and in the box both
    // `boxConflict` and `holdForBodyConflict` have already returned early, so
    // nothing arbitrates it any more. That is why making the wait longer made the
    // overlaps worse rather than better: every extra second of holding was a
    // second spent inside that exemption. Waiting short of the line gives up the
    // creep towards the crossing and gets the arbitration back.
    const yieldPoint = commit - vehicle.spec.width / 2 - 0.8
    const shortOfLine = vehicle.movement.route.stopS - vehicle.spec.length - 0.3
    return Math.min(yieldPoint, shortOfLine)
  }

  /**
   * Is there a vehicle on this movement that has not yet cleared the crossing it
   * shares with us?
   *
   * The question is asked about the movement rather than about a vehicle found in
   * the loop, because the answer it needs is "is that lane occupied at all" and
   * the first vehicle on it is as good a witness as any other. It is deliberately
   * not the same question as `threatens` used to ask. That one wanted vehicles
   * that were *moving*, and so reported an opposing queue as harmless precisely
   * when it was about to discharge; this one wants vehicles that are *short of*
   * the crossing, which is a statement about position and holds for a stationary
   * queue as honestly as for a car in mid-stream.
   */
  private stillApproaching(otherId: string, mineId: string): boolean {
    const otherCrossing = CONFLICTS.get(otherId)?.get(mineId)
    for (const other of this.vehicles) {
      if (other.movement.id !== otherId) {
        continue
      }
      // The far side of the crossing, measured on the *other* vehicle's own route,
      // which is the only one of the two arcs at which "has got past it" means
      // "cannot come back". The turner's arc says where they meet, not where the
      // other vehicle leaves.
      const limit = otherCrossing === undefined ? other.movement.route.exitS : otherCrossing
      if (other.s - other.spec.length > limit) {
        continue
      }

      // Short of the crossing is necessary but no longer sufficient, because a
      // stream stopped at a red on the far side of the junction is short of the
      // crossing and always will be. Asking only where a stream is therefore
      // reports a standing queue as a permanent threat, and a turner that believes
      // it can never commit to a standing queue is a turner that never moves.
      //
      // The cost of that is not one slow car. It is the whole junction: a turner
      // that never moves is an occupant, an occupant blocks the vehicle clearance
      // interlock, the interlock extends the all-red, and the all-red is the only
      // state in which the controller chooses whom to serve next — so the stream
      // the turner is politely waiting for never gets the green that would let the
      // turner go. Measured at default demand, seed 7: a west left sat 439 s inside
      // the junction at s=79,78 yielding to an east through queue that had been
      // standing at its line for the entire time, holding the box and, through it,
      // every other approach. `served` froze at 138 of a possible ~150.
      //
      // So what is tested is whether anything on that stream is actually *coming*.
      // A rolling vehicle is; a standing one is not. This does not put two
      // stationary vehicles in the same place: the give-way order between bodies
      // that are both standing belongs to `boxConflict` and `holdForBodyConflict`,
      // which arbitrate by body and by swept band, and which is what closed the
      // overlaps. This only decides whether a turner is giving way to a *flow*.
      if (other.v <= ROLLING_SPEED && !other.inBox) {
        continue
      }
      return true
    }
    return false
  }

  /**
   * Is this vehicle committed to clearing the junction?
   *
   * A vehicle that has crossed its stop line continues even against a red — the
   * "already through" exemption that keeps a box from freezing with traffic in
   * it. The exemption has to stay narrow: it must cover a car caught at the box
   * when the light turns, and it must *not* cover a first-in-line queue car that
   * inched over the line with room ahead blocked and then stopped. Honouring the
   * inch would discharge the whole queue through a red, one car at a time, the
   * moment the far side cleared.
   *
* The test is therefore the vehicle's own motion, not its arc: rolling — even
   * slowly — or physically inside the box. Inside is geometry, not `s`, so a
   * line that a long vehicle stretches across is judged from its actual centre
   * and the exemption survives the measured half-metre differences.
   *
   * "Inside the box" has to mean the same thing here as it does in `occupiesBox`,
   * and it used not to. This function asked whether the vehicle's *centre* had
   * crossed the junction's midpoint, while `occupiesBox` asks whether any part of
   * its body has entered the square. A car can have a metre of nose inside the
   * junction and its centre still behind the boundary, and then the two functions
   * disagreed: `occupiesBox` counted it as blocking the box, so the controller
   * held the crossing at red, and `clearingJunction` called it uncommitted, so it
   * was pinned to a stop line a metre behind its own nose. A vehicle cannot obey a
   * hold that is behind it — the step is bounded by the metres left to the hold
   * point, so there are none — and it sat there permanently. Two vehicles in that
   * state were enough to empty no phase, and the junction stopped entirely.
   *
   * That trap had been masked. The amber used to hand a flat 2.5 m of phantom
   * stopping distance to every stationary vehicle, which released exactly this car
   * on amber, and by the time the red arrived it was rolling, and `v > 0.5` made
   * it committed on its own. Fixing the amber exposed the deadlock underneath it.
   *
   * So both questions are asked of the body now, and one definition of "inside
   * the junction" serves both callers.
   */
  private clearingJunction(vehicle: VehicleState): boolean {
    if (vehicle.s <= vehicle.movement.route.stopS + 0.05) {
      return false
    }
    if (vehicle.v > 0.5) {
      return true
    }
    return this.occupiesBox(vehicle)
  }

  /**
   * Is any part of this vehicle inside the junction box?
   *
   * Two tests, and the geometry is the one that decides. The arc bounds are a
   * cheap rejection — the nose has not reached the line, or the tail is already
   * past the far arc — and the body is then tested against the junction square
   * itself, because "inside the box" is a place and not an arc length.
   *
   * The body test is the whole content of the correction, and it is rear-based
   * where the arc version was not. `s` is the front bumper and `exitS` is the arc
   * at which the front is clear, so a test written on `s` reports a bus as gone
   * the instant its nose leaves, while eleven metres of bus are still lying
   * across the lane it is turning into. For a car the two conventions agree to
   * within a metre, which is why the bug survived ten simulated minutes.
   *
   * It also has to reject the vehicle that is merely *at* its stop line. An
   * arc-only test calls that vehicle an occupant of the box, and a junction where
   * the first car in a queue counts as blocking traffic brings every phase to a
   * standstill: the car in front is waiting for a gap, the car beside it is
   * waiting for the car in front, and the box is never empty.
   */
  private occupiesBox(vehicle: VehicleState): boolean {
    const route = vehicle.movement.route
    if (vehicle.s < route.stopS || vehicle.s - vehicle.spec.length >= route.exitS) {
      return false
    }
    return junctionIntrusion(vehicle) > BOX_INTRUSION
  }

  /** Is anything else on a route that crosses this one, mid-box? */
  private crossingNow(other: VehicleState): boolean {
    return this.occupiesBox(other)
  }

  /**
   * Whether a vehicle may enter the box on a green.
   *
   * The signal has already done the coarse work: only one axis is green at a
   * time, so the opposing approach is stopped and the box was empty when the
   * green began. What is left is the fine work that a phase plan cannot express
   * and that a viewer notices immediately, because it is two vehicles occupying
   * the same square metres:
   *
   * - **Merging.** Four approaches become one lane on the far side, so a vehicle
   *   waits for room rather than arriving on top of whoever is already there.
   * - **Crossing.** Any vehicle already inside the box whose path intersects this
   *   one, from any approach. This is the case a two-phase plan does not cover on
   *   its own: a vehicle that entered on the last second of a green is still
   *   crossing when the next axis is released.
   *
   * Both are refusals rather than corrections. A vehicle that cannot enter waits
   * at the line, which is what a real one does; there is no arrangement of the
   * arithmetic that makes two vehicles share a space safely.
   */
  private mayRelease(vehicle: VehicleState, aspect: Aspect): boolean {
    if (aspect !== 'green') {
      return false
    }
    if (this.exitBlocked(vehicle) || this.boxConflict(vehicle)) {
      return false
    }
    return true
  }

  private mustYield(vehicle: VehicleState): boolean {
    return vehicle.movement.turn === 'right' && this.crossingOccupied(RIGHT_TARGET[vehicle.lane.arm])
  }

  private crossingOccupied(arm: Arm): boolean {
    const crossing = CROSSWALKS.find((candidate) => candidate.arm === arm)
    if (!crossing) {
      return false
    }
    return this.walkers.some(
      (walker) => walker.crosswalk.arm === arm && walker.state === 'walking',
    )
  }
}

function project(point: Vec2, axis: Vec2): number {
  return point.x * axis.x + point.z * axis.z
}

/**
 * Do two routes cross inside the junction box?
 *
 * A property of the geometry, not of the turn types, and it is asked once per
 * movement pair when this module loads — twenty-four movements, so a few hundred
 * segment tests — rather than per vehicle per frame. Deriving it from turn types
 * is the trap: "left turns conflict" describes a junction with a protected
 * left-turn phase, and this junction has none. Its left turns run against an
 * opposing approach that the green has already stopped, so the pairs that
 * actually cross are two through movements from adjacent arms.
 */

/**
 * For every movement: where it crosses each movement it conflicts with.
 *
 * Keyed by movement id, and the value is the arc length *along this movement's
 * own route* at which the two centrelines meet. Having the number is what makes
 * a permissive left turn possible: a turner can be held at the exact point where
 * it would meet oncoming traffic, rather than being either released too early or
 * stopped at the stop line where it blocks the lane behind it.
 *
 * Computed once at load, from the same geometry the routes were built from, so
 * it cannot drift out of step with them.
 */
const CONFLICTS = new Map<string, Map<string, number>>()

for (const first of MOVEMENTS) {
  for (const second of MOVEMENTS) {
    if (first.id === second.id) {
      continue
    }
    // Movements from the same lane never conflict: the followers order owns their
    // spacing on the approach, and their paths only *diverge* inside the box —
    // a straight and a left from the same lane separate, they do not cross.
    // Without this line the two share an entrance point, their centreline
    // segments touch there, and a permissive left would report a conflict at its
    // own stop line and never be held at its real one.
    if (first.lane.id === second.lane.id || first.destination.id === second.destination.id) {
      continue
    }
    const at = firstConflictArc(first, second)
    if (at !== null) {
      const set = CONFLICTS.get(first.id) ?? new Map<string, number>()
      set.set(second.id, at)
      CONFLICTS.set(first.id, set)
    }
  }
}

/**
 * Do two movements put their centrelines through each other inside the box?
 *
 * Asked of movements rather than of routes, because a route carries no identity of
 * its own: recovering one meant a `WeakMap` probe per operand — twice, per pair of
 * vehicles, per frame — to recover something the caller was already holding.
 */
function routesConflict(a: Movement, b: Movement): boolean {
  return CONFLICTS.get(a.id)?.has(b.id) ?? false
}

/**
 * Where two movements out of the same lane stop sharing road.
 *
 * Keyed by movement id, and the value is the arc — the same number on both
 * routes, which is the property that makes it usable: the two paths are identical
 * up to this point and identical in their arc length up to this point, so "has the
 * leader's rear passed the divergence" is a question both vehicles can answer in
 * their own units and get the same answer.
 *
 * `CONFLICTS` above skips these pairs on purpose, because two movements out of
 * one lane never cross and a table that claimed they did would report a conflict
 * at the shared stop line. This is the other half of that decision: they do not
 * cross, but they do share the piece of road where they part company, and that
 * piece needs a name.
 */
/** A body plus a body's worth of slack. Two vehicles this far apart laterally are
 *  in different pieces of road, whatever their headings are doing. */
const DIVERGENCE_CLEARANCE = 2.2

const DIVERGENCE = new Map<string, Map<string, number>>()

for (const first of MOVEMENTS) {
  for (const second of MOVEMENTS) {
    if (first.id === second.id) {
      continue
    }
    if (first.lane.id !== second.lane.id || first.destination.id === second.destination.id) {
      continue
    }
    const at = divergenceArc(first, second)
    if (at === null) {
      continue
    }
    const set = DIVERGENCE.get(first.id) ?? new Map<string, number>()
    set.set(second.id, at)
    DIVERGENCE.set(first.id, set)
  }
}

/**
 * The arc at which two same-lane movements are far enough apart to be independent.
 *
 * Walked at a fine enough step that the answer is not sensitive to where the
 * samples happen to fall, because the value is compared against a rear bumper
 * position and an error of half a metre here is half a metre of clipping.
 */
function divergenceArc(first: Movement, second: Movement): number | null {
  const STEP = 0.2
  const from = first.route.stopS
  const to = Math.min(first.route.exitS, second.route.exitS)

  for (let s = from; s <= to; s += STEP) {
    const a = sampleRoute(first.route, s)
    const b = sampleRoute(second.route, s)
    if (Math.hypot(a.x - b.x, a.z - b.z) > DIVERGENCE_CLEARANCE) {
      return s
    }
  }

  return null
}

/**
 * Memoised answer to "can these two movements, with vehicles of these sizes, put
 * bodies in the same place inside the box", as the earliest arc on the first
 * route where it happens.
 *
 * Both callers want the same sweep, and they want different things out of it: the
 * entry gate only needs to know whether it is true, and the hold rule needs to
 * know where. Returning the arc answers both, and the number it returns is not
 * decoration — it is the distance a vehicle has to give up, so it is measured in
 * the first vehicle's own units rather than in some shared frame.
 *
 * Keyed on the four things the answer actually depends on, so the sweep runs once
 * per distinct combination and never again. The live model asks a few hundred
 * pairs a frame and answers all but a handful of them from here.
 *
 * The key is an integer index into a flat array rather than a string, and that is
 * not a micro-optimisation dressed up as one. Every rule in this file that asks
 * about two bodies asks it once per candidate vehicle per frame, so the memo is
 * read a few hundred thousand times a minute; building a hundred-character key
 * and hashing it for each of those reads measured as *the most expensive thing in
 * the model*, ahead of every rule that decides whether a collision happens. The
 * geometry was never the cost. The lookup was.
 */
/**
 * The stretch of one vehicle's route over which its body can touch another.
 *
 * A span and not a point, and the difference is the whole mechanism. The bodies of
 * a bus turning right and a car waiting in the lane beside it are not in conflict
 * at a single instant: for as long as the bus is in the junction its tail lies
 * across that lane, and the lane is unsafe for as long as the bus is *anywhere* in
 * the junction. Reporting only where the band begins says where to hold a car; it
 * says nothing about when the car may go, and a car released at the first contact
 * is released into a bus that is still halfway through the band.
 *
 * The two ends are used by two different vehicles, which is why both are needed
 * and why the span is asked for twice per pair. A follower is held at its own
 * `start`, and waits until the other's rear has passed the other's `end`.
 */
interface BodySpan {
  start: number
  end: number
}

/** Movements and vehicle sizes, reduced to small integers so a pair of them is one.
 *
 *  Both are object-keyed and both are filled once at module load, which is why the
 *  answer can be an array index: the alternative is asking a `Map<string, …>` with
 *  a freshly built string on every one of the model's hottest lookups. */
const MOVEMENT_SLOTS = new Map<Movement, number>()
MOVEMENTS.forEach((movement, index) => {
  MOVEMENT_SLOTS.set(movement, index)
})

const SPEC_SLOTS = Object.keys(VEHICLE_SPECS).length

const SPEC_INDEX = new Map<VehicleSpec, number>()
Object.keys(VEHICLE_SPECS).forEach((kind, index) => {
  SPEC_INDEX.set(VEHICLE_SPECS[kind as VehicleKind], index)
})

const BODY_OVERLAPS: (BodySpan | null | undefined)[] = new Array(
  MOVEMENTS.length * SPEC_SLOTS * MOVEMENTS.length * SPEC_SLOTS,
)

/** One integer for a (movement, size) pair, and one for an ordered pair of them. */
function bodyOverlapKey(
  first: Movement,
  firstSpec: VehicleSpec,
  second: Movement,
  secondSpec: VehicleSpec,
): number {
  const mine = MOVEMENT_SLOTS.get(first)! * SPEC_SLOTS + SPEC_INDEX.get(firstSpec)!
  const theirs = MOVEMENT_SLOTS.get(second)! * SPEC_SLOTS + SPEC_INDEX.get(secondSpec)!
  return mine * (MOVEMENTS.length * SPEC_SLOTS) + theirs
}

function bodyOverlapSpan(
  first: Movement,
  firstSpec: VehicleSpec,
  second: Movement,
  secondSpec: VehicleSpec,
): BodySpan | null {
  const key = bodyOverlapKey(first, firstSpec, second, secondSpec)
  const cached = BODY_OVERLAPS[key]
  if (cached !== undefined) {
    return cached
  }
  const result = sweptBodyOverlap(first, firstSpec, second, secondSpec)
  BODY_OVERLAPS[key] = result
  return result
}

/**
 * The stretch of *this* vehicle's route from which its body can reach one other
 * vehicle standing still at a given arc.
 *
 * The mirror image of `bodyOverlapSpan`, and the one that answers "when may I go".
 * That question is not symmetric with "where must I stop", because a vehicle
 * waiting at a line is not a vehicle that will travel its whole route: it is one
 * body, in one place. Sweeping its entire possible journey to decide when that
 * one body is safe describes a vehicle that is going somewhere it will never go,
 * and the arc it produces is so far downstream that the other vehicle is reported
 * as clear while its tail is already across the lane.
 *
 * Keyed on the pair and the arc, both of which are fixed for a given pair of
 * movements and sizes — the hold point is derived from the pair — so this is
 * computed once per pair as well, and the live rule is a map lookup and a
 * comparison.
 */
const PINNED_OVERLAPS = new Map<string, BodySpan | null>()

/**
 * Debug helper: the reachability wrapper around `pinnedBodySpan`.
 *
 * Exported for the same reason `bodyBandBetween` is: the pinned band is the one
 * number in `holdForBodyConflict` that decides whether the rule fires at all, and
 * it is computed inside a loop over live vehicles where nothing about it can be
 * read off the state. A rule that "should" hold and does not is either wrong or
 * unreachable, and the difference is one number.
 */
export function pinnedBandBetween(
  heldMovementId: string,
  heldKind: VehicleKind,
  from: number,
  to: number,
  otherMovementId: string,
  otherKind: VehicleKind,
): BodySpan | null {
  const held = MOVEMENTS.find((movement) => movement.id === heldMovementId)
  const other = MOVEMENTS.find((movement) => movement.id === otherMovementId)
  if (!held || !other) {
    return null
  }
  return pinnedBodySpan(
    { spec: VEHICLE_SPECS[heldKind], movement: held } as VehicleState,
    from,
    to,
    { spec: VEHICLE_SPECS[otherKind], movement: other } as VehicleState,
  )
}

function pinnedBodySpan(
  held: VehicleState,
  from: number,
  to: number,
  other: VehicleState,
): BodySpan | null {
  const spec = held.spec
  const otherSpec = other.spec
  const key =
    `${held.movement.id}:${spec.length}:${spec.width}@${from.toFixed(1)}-${to.toFixed(1)}` +
    `|${other.movement.id}:${otherSpec.length}:${otherSpec.width}`
  const cached = PINNED_OVERLAPS.get(key)
  if (cached !== undefined) {
    return cached
  }

  const window = bodyWindow(other.movement.route, otherSpec)
  let start: number | null = null
  let end: number | null = null

  for (let i = 0; i < window.length; i += 1) {
    const t = window[i]!
    const theirs = sampleRoute(other.movement.route, t - otherSpec.length / 2)
    let touching = false
    // Every place the held vehicle might stand between the two arcs, at a step
    // fine enough that a vehicle a car-length long is never missed between
    // samples.
    for (let arc = from; arc <= to; arc += spec.length / 2) {
      const mine = sampleRoute(held.movement.route, arc - spec.length / 2)
      if (boxSeparation(mine, spec, theirs, otherSpec) < 0) {
        touching = true
        break
      }
    }
    if (!touching) {
      continue
    }
    if (start === null || t < start) {
      start = t
    }
    if (end === null || t > end) {
      end = t
    }
  }

  const result = start === null || end === null ? null : { start, end }
  PINNED_OVERLAPS.set(key, result)
  return result
}

function bodiesConflict(
  first: Movement,
  firstSpec: VehicleSpec,
  second: Movement,
  secondSpec: VehicleSpec,
): boolean {
  return bodyOverlapSpan(first, firstSpec, second, secondSpec) !== null
}

/**
 * The earliest arc on `first`'s route at which its body meets `second`'s swept
 * body, or null if the two never do.
 *
 * Sampled over the window in which each body is in the box, and paired every
 * position on one route with every position on the other. Pairing them all is
 * deliberate: the two vehicles are not assumed to arrive at the sampled moments
 * together, so the answer is "can these two paths be occupied at the same
 * instant", which is a question about paths and not about a schedule.
 *
 * The window is bounded by the rear, and bounded by the front, for the same
 * reason `occupiesBox` is. The overlap that matters happens when the bus is four
 * metres past the exit arc with its tail still across the lane, and a window
 * that ended at `exitS` would have stopped looking a metre before it happened.
 */
function sweptBodyOverlap(
  first: Movement,
  firstSpec: VehicleSpec,
  second: Movement,
  secondSpec: VehicleSpec,
): BodySpan | null {
  const firstWindow = bodyWindow(first.route, firstSpec)
  const secondWindow = bodyWindow(second.route, secondSpec)
  let start: number | null = null
  let end: number | null = null

  for (let i = 0; i < firstWindow.length; i += 1) {
    const s = firstWindow[i]!
    // `s` is the front bumper, so the body sits half a length behind it — the
    // same half-length `integrate` uses, and the difference between the two is
    // five and a half metres on a bus.
    const a = sampleRoute(first.route, s - firstSpec.length / 2)
    let touching = false
    for (let j = 0; j < secondWindow.length; j += 1) {
      const t = secondWindow[j]!
      const b = sampleRoute(second.route, t - secondSpec.length / 2)
      if (boxSeparation(a, firstSpec, b, secondSpec) < 0) {
        touching = true
        break
      }
    }
    if (!touching) {
      continue
    }
    if (start === null || s < start) {
      start = s
    }
    if (end === null || s > end) {
      end = s
    }
  }

  if (start === null || end === null) {
    return null
  }
  return { start, end }
}

/** Arc samples over which a body of this size is inside the junction box. */
function bodyWindow(route: Route, spec: VehicleSpec): number[] {
  const from = route.stopS - spec.length - 4
  const to = route.exitS + spec.length + 0.5
  const STEP = 0.4
  const samples: number[] = []
  for (let s = from; s <= to; s += STEP) {
    samples.push(Math.max(0, Math.min(s, route.total)))
  }
  return samples
}

/**
 * How far this vehicle's body reaches into the junction square, in metres.
 *
 * Separating-axis test between the body's oriented rectangle and the axis-aligned
 * square the junction occupies, on the body's two edge normals and the square's
 * two. The square is given as its projection onto each axis rather than as four
 * of its own edges, which is the same test with half the work: on the square's
 * own axes the separation is exact, and on the body's axes the square's
 * projection is exact too.
 *
 * Measured on the *body*, not the centre, so a bus whose nose has crossed the far
 * side still reports a positive depth while its tail is lying across the
 * junction — which is the measurement the whole conflict argument turns on, since
 * a bus is in the junction until its tail leaves it and not one metre sooner.
 *
 * Returns a distance rather than a boolean because a distance can be compared
 * against a threshold, and a boolean cannot be told apart from a body merely
 * *touching* the square. That distinction is the difference between a car
 * waiting at its stop line and a car in the junction, and getting it wrong
 * deadlocks the whole grid: two cars at their lines, each waiting for the other
 * to clear a space neither of them is in.
 *
 * The minimum over the axes, not the maximum. Two rectangles are apart if *any*
 * axis separates them, so the least-separated axis is the one that decides, and
 * taking the most-separated instead reports a car parked two metres outside the
 * junction as being nine metres inside it — because across the road it is well
 * clear, and the answer is whichever number is larger.
 */
export function junctionIntrusion(vehicle: VehicleState): number {
  const forward = { x: Math.sin(vehicle.heading), z: Math.cos(vehicle.heading) }
  const lateral = { x: Math.cos(vehicle.heading), z: -Math.sin(vehicle.heading) }
  const along = vehicle.spec.length / 2
  const across = vehicle.spec.width / 2
  const axes = [forward, lateral, { x: 1, z: 0 }, { x: 0, z: 1 }]
  let shallowest = Infinity

  for (const axis of axes) {
    const centre = vehicle.position.x * axis.x + vehicle.position.z * axis.z
    const body =
      along * Math.abs(forward.x * axis.x + forward.z * axis.z) +
      across * Math.abs(lateral.x * axis.x + lateral.z * axis.z)
    const square = JUNCTION_HALF * (Math.abs(axis.x) + Math.abs(axis.z))
    shallowest = Math.min(shallowest, body + square - Math.abs(centre))
  }

  return shallowest
}

/**
 * Separating distance between two oriented rectangles: positive when they are
 * apart, zero when they touch, negative by the depth of the overlap.
 *
 * Separating-axis test on the four edge normals. It is the same test the
 * invariant checker uses to call a collision, run here so that a collision can be
 * *predicted* — which is the only way to prevent one, since two vehicles already
 * in the box are on arc lengths that cannot be compared and neither can be told
 * to back up.
 */
function boxSeparation(
  a: { x: number; z: number; heading: number },
  aSpec: VehicleSpec,
  b: { x: number; z: number; heading: number },
  bSpec: VehicleSpec,
): number {
  const aForward = { x: Math.sin(a.heading), z: Math.cos(a.heading) }
  const aRight = { x: Math.cos(a.heading), z: -Math.sin(a.heading) }
  const bForward = { x: Math.sin(b.heading), z: Math.cos(b.heading) }
  const bRight = { x: Math.cos(b.heading), z: -Math.sin(b.heading) }

  const dx = b.x - a.x
  const dz = b.z - a.z
  const aHalf = { along: aSpec.length / 2, across: aSpec.width / 2 }
  const bHalf = { along: bSpec.length / 2, across: bSpec.width / 2 }

  let deepest = -Infinity

  for (const axis of [aForward, aRight, bForward, bRight]) {
    const distance = Math.abs(dx * axis.x + dz * axis.z)
    const aExtent =
      aHalf.along * Math.abs(aForward.x * axis.x + aForward.z * axis.z) +
      aHalf.across * Math.abs(aRight.x * axis.x + aRight.z * axis.z)
    const bExtent =
      bHalf.along * Math.abs(bForward.x * axis.x + bForward.z * axis.z) +
      bHalf.across * Math.abs(bRight.x * axis.x + bRight.z * axis.z)
    deepest = Math.max(deepest, distance - aExtent - bExtent)
  }

  return deepest
}

/** Debug helper: every crossing arc on this movement, keyed by the movement crossed. */
export function conflictTableFor(id: string): Record<string, number> {
  const table = CONFLICTS.get(id)
  if (!table) {
    return {}
  }
  return Object.fromEntries([...table.entries()].sort((a, b) => a[1] - b[1]))
}

/** Debug helper: the divergence arc against each movement that shares this lane. */
export function divergenceTableFor(id: string): Record<string, number> {
  const table = DIVERGENCE.get(id)
  if (!table) {
    return {}
  }
  return Object.fromEntries([...table.entries()].sort((a, b) => a[1] - b[1]))
}

/**
 * Debug helper: the swept body band between two movements, at a given pair of sizes.
 *
 * Reports the band in both vehicles' own arcs, because the two ends are used for
 * two different purposes and reading only one of them is what makes a hold rule
 * look correct while it is not. The band on the follower's route says where it
 * must stop; the band on the leader's says when it may be released.
 */
export function bodyBandBetween(
  a: string,
  aKind: VehicleKind,
  b: string,
  bKind: VehicleKind,
): { a: BodySpan | null; b: BodySpan | null } {
  const first = MOVEMENTS.find((movement) => movement.id === a)
  const second = MOVEMENTS.find((movement) => movement.id === b)
  if (!first || !second) {
    return { a: null, b: null }
  }
  const firstSpec = VEHICLE_SPECS[aKind]
  const secondSpec = VEHICLE_SPECS[bKind]
  return {
    a: bodyOverlapSpan(first, firstSpec, second, secondSpec),
    b: bodyOverlapSpan(second, secondSpec, first, firstSpec),
  }
}

/**
 * Arc length along `first`'s route at which it crosses `second`'s, or null.
 *
 * The earliest of the intersections, so a turner is held at the first place it
 * could possibly conflict rather than the last.
 */
function firstConflictArc(first: Movement, second: Movement): number | null {
  const a = first.route
  const b = second.route
  const from = a.samples.filter((sample) => sample.s >= a.stopS && sample.s <= a.exitS)
  const other = b.samples.filter((sample) => sample.s >= b.stopS && sample.s <= b.exitS)
  let earliest: number | null = null

  for (let i = 1; i < from.length; i += 1) {
    const p = from[i - 1]?.point
    const q = from[i]?.point
    if (!p || !q) {
      continue
    }
    for (let j = 1; j < other.length; j += 1) {
      const r = other[j - 1]?.point
      const t = other[j]?.point
      if (!r || !t) {
        continue
      }
      if (segmentsCross(p.x, p.z, q.x, q.z, r.x, r.z, t.x, t.z)) {
        const s = from[i - 1]!.s
        if (earliest === null || s < earliest) {
          earliest = s
        }
      }
    }
  }

  return earliest
}

/** Proper segment intersection, by the sign of the two cross products. */
function segmentsCross(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  dx: number,
  dz: number,
): boolean {
  const first = (bx - ax) * (cz - az) - (bz - az) * (cx - ax)
  const second = (bx - ax) * (dz - az) - (bz - az) * (dx - ax)
  if (first * second > 0) {
    return false
  }
  const third = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx)
  const fourth = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx)
  return third * fourth <= 0
}

function bumperGap(a: VehicleState, b: VehicleState): number {
  return (a.spec.length + b.spec.length) / 2 + MIN_GAP
}

/**
 * Heading, eased rather than set.
 *
 * A car's body does not point along the instantaneous tangent of its path; it
 * points where the driver has actually steered it, and steering has a rate. At
 * the moment a vehicle enters a turn its path tangent is already rotating while
 * the car is still straight, and snapping to it would put a visible kink at the
 * exact point where the eye is looking for one.
 */
function easeHeading(current: number, target: number, dt: number): number {
  const difference = angleDelta(current, target)
  // A car can only change its heading about as fast as it is moving. The rate
  // below is generous — it is roughly a two-second lane change — but it is
  // bounded, which is the point.
  const maxRate = 2.4
  const step = Math.max(-maxRate * dt, Math.min(maxRate * dt, difference))
  return current + step
}

function angleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) {
    delta -= Math.PI * 2
  }
  if (delta <= -Math.PI) {
    delta += Math.PI * 2
  }
  return delta
}

/**
 * Opacity at the ends of a route.
 *
 * Smoothstep rather than linear, so a vehicle does not arrive with a visible
 * edge on it. The spawn and despawn points sit inside the fog, so in practice
 * this ramp is never the thing you see — it is the guarantee behind the thing
 * you see.
 */
function edgeOpacity(s: number, total: number): number {
  const fromStart = clamp01(s / FADE_LENGTH)
  const fromEnd = clamp01((total - s) / FADE_LENGTH)
  const value = Math.min(fromStart, fromEnd)
  return value * value * (3 - 2 * value)
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** Re-exported so the renderer does not have to reach into two modules for one
 *  number, and so the timing constants have exactly one home. */
export const TIMING = { MIN_GREEN, MAX_GREEN, AMBER, ALL_RED, MIN_GAP } as const
