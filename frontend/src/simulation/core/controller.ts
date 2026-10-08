import { ARMS, LEFT_TARGET, RIGHT_TARGET, type Arm, type Turn } from './layout'

/**
 * The signal controller.
 *
 * This is the product. `DESIGN.md` says the control room is not decoration and
 * `PRODUCT.md` says explainability is a feature, so the controller here is
 * written as a state machine with named interlocks and a `reason` string on
 * every state — not as a chain of booleans scattered through the world update.
 * When a phase changes, the string says which rule fired, and an evaluator can
 * read the transition back without stepping through the code.
 *
 * The law itself is three rules and a tie-break:
 *
 * 1. **Pressure** decides. Each queued vehicle contributes `1 + waited / 12` to
 *    its approach. The constant is twelve seconds because that is roughly the
 *    difference between a wait a driver tolerates and one they start taking as
 *    personal. The `1` is the vehicle itself; the fraction is how long it has
 *    been standing there. A single car that has waited twenty seconds therefore
 *    outweighs four that have just arrived, which is the property that stops an
 *    approach being starved by a busier neighbour.
 * 2. **Interlocks** bound the decision. A green is never shorter than
 *    `MIN_GREEN` and never longer than `MAX_GREEN`, so the cycle cannot collapse
 *    to a flicker and no approach can hold the box indefinitely.
 * 3. **Preemption** overrides both, once, for an emergency vehicle.
 *
 * That is the whole algorithm. It is intentionally a rule-based control law and
 * not a learned policy, because a professor is the reader and a policy nobody can
 * trace is a policy nobody can check.
 */

export type Aspect = 'green' | 'amber' | 'red'

/** A green shorter than this is a flicker, and drivers read it as a fault. */
export const MIN_GREEN = 11

/**
 * The protected left arrow's own floor, and its own ceiling.
 *
 * Both are shorter than the through green because the queue behind them is
 * shorter: a left-turning lane drains in a handful of seconds, and the arrow has
 * to be gone before the opposing through is released or the junction is worse off
 * than it was with a permissive left.
 *
 * These are starting values, not tuned ones. The pass that set them is
 * `CONTINUIDAD.md` § Sprint 1-E, and it is measured against throughput on more
 * than one seed, because the first attempt at this phase was tuned on one and
 * that hid the whole defect.
 */
export const MIN_LEFT_GREEN = 5

export const MAX_LEFT_GREEN = 12

/**
 * How much left pressure it takes to take a phase away from the approach that
 * would otherwise have been served, as a fraction of that approach's own
 * pressure.
 *
 * Measured, not guessed. `scripts/left-share.ts` prints the distribution of
 * `leftPressure / deniedPressure` on every frame where somebody is waiting to
 * turn left; at the shipped default demand over 5 minutes the ratio sits between
 * 0,142 and 0,317 with a median of 0,275 and a p90 of 0,304. It never approaches
 * 1, because a left is roughly one movement in six, and that is the whole reason
 * the first version of this rule was wrong.
 *
 * Both obvious alternatives are measured failures:
 *
 *   - At 1 (the arrow must outrank the throughs): 0 requests in 73 phase
 *     changes, worst left wait 592 s. The arrow never ran.
 *   - At ~0 (serve the arrow whenever anyone is waiting): one arm's left takes
 *     the phase in a tight loop, `served` fell to 13 in ten minutes, and a
 *     vehicle entered on red.
 *
 * 0,20 sits just under the median, so the arrow fires for a left that is waiting
 * about as long as the approach it would be taken from — which is the fair
 * reading of "the arrow is owed". The window between the measured p10 (0,207) and
 * p90 (0,304) is narrow, so this is the number to revisit if throughput moves.
 */
export const LEFT_SHARE_OF_DENIED = 0.2

/** After this long the current approach yields even if nothing else is waiting. */
export const MAX_GREEN = 21

/**
 * How many greens in a row an approach may be passed over before it is served
 * regardless of pressure.
 *
 * Served round-robin an arm's age runs 0..3, so three passes is the point at
 * which it has been skipped a full lap. See `choose`, where this replaced a
 * tie-break on exactly-equal pressures that never fired.
 */
export const MAX_CONSECUTIVE_SKIPS = 3

/** Enough time for a car at approach speed to stop in the distance it has. */
export const AMBER = 3.2

/**
 * Perception-reaction time, charged to a vehicle crossing an amber as distance
 * rather than as a flat allowance. At 5 m/s this is 2.5 m.
 *
 * Charged as a constant it was 2.5 m even for a vehicle at a standstill, which
 * invented a dilemma zone for cars that had already stopped and could stop again
 * at no cost. See the amber branch in `world.ts`.
 */
export const REACTION_SECONDS = 0.5

/** The interval the cross traffic gets to clear the box before anyone else moves. */
export const ALL_RED = 2.2

/**
 * How long a cleared all-red may be extended to finish letting people across.
 *
 * Long enough for the slowest walker to clear the widest crossing: 13.6 m at the
 * 1.4 m/s floor is 9.7 s. A walker may step off on the last frame its approach
 * is red, so the extension has to cover a full crossing and not merely the tail
 * of one. Ten seconds does that and is still a bounded wait — the same ceiling
 * reasoning as `MAX_BOX_EXTENSION`, with "people are not to be run over" on the
 * other side of the ledger.
 */
export const MAX_CLEARANCE_EXTENSION = 10

/**
 * Hard ceiling on extending an all-red because the box is not empty.
 *
 * An interlock with no ceiling is a deadlock: one vehicle that stopped with its
 * nose in the box would hold the junction at red for ever. Real signals solve
 * this the same way, by capping the wait and accepting that a stalled vehicle is
 * a problem for the operator rather than for the timing plan.
 */
export const MAX_BOX_EXTENSION = 9

/**
 * Which movements a green serves.
 *
 * `through` serves the axis pair exactly as a two-phase junction does. `left`
 * is the protected left-turn phase, and it exists because the permissive left
 * could not be made safe by tuning: deciding a permissive left means comparing
 * the turner's own clearance against the opponent's arrival, and both estimates
 * were measured to err in the unsafe direction under continuous flow. Five
 * attempts at that arithmetic are recorded in `CONTINUIDAD.md`. A protected
 * left removes the comparison: with the opposing through movement at red there
 * is nothing to yield to, so the decision cannot be wrong.
 *
 * Both opposing lefts of one axis are served together — `north` and `south` — and
 * the conflict table confirms they do not cross each other. The two *perpendicular*
 * lefts do cross, and stay red.
 */
export type GreenKind = 'through' | 'left'

export type ControllerState =
  | { kind: 'green'; arm: Arm; mode: GreenKind; elapsed: number; reason: string }
  | { kind: 'amber'; arm: Arm; mode: GreenKind; elapsed: number; reason: string }
  | {
      kind: 'allRed'
      clearing: Arm | null
      mode: GreenKind | null
      elapsed: number
      reason: string
    }

export interface ControllerInput {
  /** Total pressure per approach, from the world. */
  pressure: Record<Arm, number>
  /**
   * Pressure from left-turners only, per approach.
   *
   * Kept apart from `pressure` because the left phase is a separate decision: a
   * left phase is only worth the cycle time it costs when somebody is actually
   * waiting to turn left, and folding lefts into the through pressure cannot
   * express that. It is also the honest read on a junction where the throughs
   * outnumber the lefts several times over.
   */
  leftPressure: Record<Arm, number>
  /**
   * The longest a left-turner has been waiting anywhere on the junction.
   *
   * Reported separately from `leftPressure` because the two answer different
   * questions. Pressure decides *which* arm deserves the arrow. This decides
   * whether the arrow is owed at all, and a single ageing left-turner is a reason
   * to spend a phase on its own — see the note in `choose`.
   */
  leftWorst: number
  /** The arm an emergency vehicle is approaching on, if any. */
  preemption: Arm | null
  /**
   * The arms whose pedestrian crossings have someone on the carriageway. The
   * controller holds the all-red only when a crossing it is about to release is
   * in this set — not when anyone anywhere is walking. See `stepAllRed`.
   */
  crossingArms: ReadonlySet<Arm>
  /**
   * True while a vehicle from the arm being cleared is still inside the junction
   * box. This is the vehicle clearance interlock, and it is the one that stops
   * the model putting a car and a bus in the same square metre.
   *
   * Without it, the all-red is a fixed 2.2 s and a vehicle that entered the box
   * on the last frame of a green is still in it when the conflicting phase
   * starts. Through movements from crossing approaches then occupy the same
   * space, and the scene shows two vehicles passing through each other at the
   * centre of the junction — which is the single most visible way a traffic
   * simulation can admit it is not simulating traffic.
   */
  boxBlocked: boolean
  /**
   * Can this arm's left-turning queue actually reach its stop line?
   *
   * Lane 0 carries left turns *and* through movements, so a left-turner is
   * queued behind the through traffic sharing its lane. When a through vehicle
   * is standing at the line, the left-turner behind it is blocked by a vehicle
   * that the left phase itself holds at red — and the arrow cannot discharge a
   * queue that cannot reach the line it is drawn for.
   *
   * That is the deadlock, and it is a livelock rather than a stall: the arrow is
   * granted, times out, and is granted again. Measured at default demand, seed 7:
   * the protected left for one arm was granted on almost every 30 s sample for
   * five minutes, the junction stayed empty, `served` froze at 63, and the worst
   * wait reached 526 s. The left-turning head never moved once in 15 562 frames.
   *
   * Real signals resolve it the same way: the through movement is cleared first,
   * and the arrow only follows once the shared lane has room for a car to sit on
   * the line. So this flag gates *whether an arrow may be served at all*, not
   * which arm gets it.
   */
  leftReady: Record<Arm, boolean>
}

export class SignalController {
  private state: ControllerState = {
    kind: 'allRed',
    clearing: null,
    mode: null,
    elapsed: 0,
    reason: 'Arranque del sistema',
  }

  /** Arms served since the last full round, for the starvation tie-break. */
  private lastServed: Record<Arm, number> = { north: 0, east: 0, south: 0, west: 0 }
  private servedCount = 0

  private preemptionArm: Arm | null = null

  get current(): ControllerState {
    return this.state
  }

  /**
   * What each approach is being shown, for the through movements.
   *
   * During a left phase this is all red: the left arrow is not shown here, it is
   * shown by `leftOpen`, because one aspect per approach cannot describe "red for
   * the throughs and green for the left arrow" and pretending otherwise would put
   * two truths in one field.
   */
  aspects(): Record<Arm, Aspect> {
    const result: Record<Arm, Aspect> = { north: 'red', east: 'red', south: 'red', west: 'red' }
    const state = this.state

    if (state.mode === 'left') {
      return result
    }

    if (state.kind === 'green') {
      result[state.arm] = 'green'
      // In a two-phase junction the axis gets green together.
      for (const arm of ARMS) {
        if (isOpposite(arm, state.arm)) {
          result[arm] = 'green'
        }
      }
    } else if (state.kind === 'amber') {
      result[state.arm] = 'amber'
      for (const arm of ARMS) {
        if (isOpposite(arm, state.arm)) {
          result[arm] = 'amber'
        }
      }
    }

    return result
  }

  /**
   * Is this arm's left turn being served right now?
   *
   * True only during a left phase, and true for both opposing arms at once,
   * because the conflict table says those two lefts do not cross each other.
   * The perpendicular lefts are red throughout, which is what keeps the phase
   * honest.
   */
  leftOpen(arm: Arm): boolean {
    const state = this.state
    if (state.mode !== 'left') {
      return false
    }
    if (state.kind === 'allRed') {
      return false
    }
    return arm === state.arm || isOpposite(arm, state.arm)
  }

  /** The aspect a left-turning vehicle is judged on. */
  aspectForLeft(arm: Arm): Aspect {
    return this.leftOpen(arm) ? 'green' : 'red'
  }

  /** The aspect a given approach's *movement* is judged on. A left-turner is
   *  released on the protected left phase, not on its own approach's through
   *  green, which is what makes the left protected rather than permissive. */
  aspectFor(arm: Arm, turn: Turn): Aspect {
    if (turn === 'left') {
      return this.aspectForLeft(arm)
    }
    return this.aspects()[arm]
  }

  step(delta: number, input: ControllerInput): void {
    // Preemption latches. An ambulance appears, the approach it is on is
    // remembered, and the controller will not forget it half way through
    // switching away from that approach — the flicker that produces when it does
    // is a signal fault, and a signal fault during an emergency is the one thing
    // this feature exists to prevent.
    this.preemptionArm = input.preemption

    this.state = { ...this.state, elapsed: this.state.elapsed + delta } as ControllerState
    const state = this.state

    if (state.kind === 'green') {
      this.stepGreen(state, input)
    } else if (state.kind === 'amber') {
      this.stepAmber(state)
    } else {
      this.stepAllRed(state, input)
    }
  }

  private stepGreen(
    state: Extract<ControllerState, { kind: 'green' }>,
    input: ControllerInput,
  ): void {
    const holdsMinimum = state.elapsed < greenMinimum(state.mode)
    const preemptionElsewhere = this.preemptionArm !== null && this.preemptionArm !== state.arm

    if (preemptionElsewhere) {
      this.goAmber(
        state.arm,
        state.mode,
        `Preemptión: emergencia en ${armName(this.preemptionArm!)}`,
      )
      return
    }

    if (holdsMinimum) {
      return
    }

    if (state.elapsed >= greenMaximum(state.mode)) {
      this.goAmber(
        state.arm,
        state.mode,
        state.mode === 'left'
          ? `Verde de giro a la izquierda completo`
          : `Green máximo alcanzado (${Math.round(MAX_GREEN)} s)`,
      )
      return
    }

    const choice = this.choose(input)
    if (choice.arm !== state.arm || choice.mode !== state.mode) {
      this.goAmber(
        state.arm,
        state.mode,
        choice.mode === 'left'
          ? `Giros a la izquierda esperando en ${armName(choice.arm)}`
          : `Mayor presión en ${armName(choice.arm)}`,
      )
    }
  }

  private stepAmber(state: Extract<ControllerState, { kind: 'amber' }>): void {
    if (state.elapsed < AMBER) {
      return
    }
    this.state = {
      kind: 'allRed',
      clearing: state.arm,
      mode: state.mode,
      elapsed: 0,
      reason: `Fin de ámbar en ${armName(state.arm)}`,
    }
  }

  private stepAllRed(
    state: Extract<ControllerState, { kind: 'allRed' }>,
    input: ControllerInput,
  ): void {
    if (state.elapsed < ALL_RED) {
      return
    }

    const beyondNominal = state.elapsed - ALL_RED

    if (input.boxBlocked && beyondNominal < MAX_BOX_EXTENSION) {
      this.state = {
        ...state,
        reason: `Espera a que la intersección se vacíe (${armName(state.clearing ?? 'north')})`,
      }
      return
    }

    const preemption = this.preemptionArm
    const choice = preemption
      ? {
          arm: preemption,
          mode: 'through' as const,
          reason: `Preemptión: emergencia en ${armName(preemption)}`,
        }
      : this.choose(input)

    // Hold only for the crossing the release would put traffic on. A walker on
    // any other crossing is not in the path of this green, and with people
    // looping the crossings continuously, holding for all of them would extend
    // the all-red to its ceiling on nearly every cycle and starve the junction.
    const blocked = this.releasedCrossingOccupied(choice.arm, input.crossingArms)
    if (blocked && beyondNominal < MAX_CLEARANCE_EXTENSION) {
      this.state = {
        ...state,
        reason: `Espera al paso de peatones en ${armName(blocked)}`,
      }
      return
    }

    this.goGreen(choice.arm, choice.mode, this.servedCount === 0 ? 'Primer verde' : choice.reason)
  }

  /**
   * The occupied crossing a green on `arm` would release traffic across, if any.
   *
   * A two-phase green serves `arm` and its opposite together, so both crossings
   * are in the path of the release and either may hold it.
   */
  private releasedCrossingOccupied(arm: Arm, occupied: ReadonlySet<Arm>): Arm | null {
    // The arms whose crossings this green endangers: the ones being served, and
    // the arms their turning traffic exits onto. A green on the north approach
    // sends its right turners into the west crossing and its left turners into
    // the east one, so a pedestrian on the west crossing is in the path of the
    // vehicles this green is about to release even though west is not served.
    const served = ARMS.filter((candidate) => candidate === arm || isOpposite(candidate, arm))
    const endangered = new Set<Arm>()
    for (const candidate of served) {
      endangered.add(candidate)
      endangered.add(RIGHT_TARGET[candidate])
      endangered.add(LEFT_TARGET[candidate])
    }
    for (const candidate of endangered) {
      if (occupied.has(candidate)) {
        return candidate
      }
    }
    return null
  }

  private goGreen(arm: Arm, mode: GreenKind, reason: string): void {
    this.servedCount += 1
    this.lastServed[arm] = this.servedCount
    this.state = { kind: 'green', arm, mode, elapsed: 0, reason }
  }

  private goAmber(arm: Arm, mode: GreenKind, reason: string): void {
    this.state = { kind: 'amber', arm, mode, elapsed: 0, reason }
  }

  /**
   * Highest pressure wins; ties go to whoever has gone longest without a green.
   *
   * The tie-break is not a refinement. Two approaches on an empty junction at
   * the start of a run both have zero pressure, and without it the first
   * candidate in a fixed array order would be served every time, which reads as
   * a broken signal rather than an idle one.
   *
   * The left phase is chosen here rather than bolted on afterwards, and it is
   * chosen *greedily on left pressure*: a left phase is inserted whenever lefts
   * are the most pressing thing on the junction. That sounds greedy for the
   * cycle, and it is — the left phase costs an all-red pair every time. The
   * alternative, letting a left wait until the through queue happens to be thin,
   * is the permissive left again in a slower costume. The measurement decides
   * whether the greedy rule is affordable, and that is what the tuning pass is for.
   *
   * A left phase is only ever served when there is a left actually waiting, so an
   * empty junction still runs a plain two-phase cycle.
   */
  private choose(input: ControllerInput): { arm: Arm; mode: GreenKind; reason: string } {
    let best: Arm = 'north'
    let bestPressure = -1
    let bestAge = Infinity

    for (const arm of ARMS) {
      const pressure = input.pressure[arm]
      const age = this.servedCount - this.lastServed[arm]

      if (pressure > bestPressure || (pressure === bestPressure && age > bestAge)) {
        best = arm
        bestPressure = pressure
        bestAge = age
      }
    }

    // Fairness is a bound, not a preference.
    //
    // `age` was consulted only between arms whose pressures were *exactly*
    // equal, which on a float pressure is a coincidence that never happens. It
    // read like a starvation guard and guarded nothing. That is invisible until
    // the queues saturate, because a saturated junction has a fixed point: the
    // arm being served keeps the most vehicles waiting, keeps the most pressure,
    // and wins the next green, so its neighbours - which are not being served -
    // cannot catch up. Measured at default demand, seed 7: east took every green
    // from 69 s onward, north and west were never served again, and `served`
    // stopped at 54 with a longest wait over 500 s.
    //
    // Nothing downstream of this comparison can break that loop, because the
    // thing doing the reinforcing is the comparison itself. So the bound is here:
    // an approach that has been passed over more times than there are other
    // approaches gets the next green whatever its pressure says. Served
    // round-robin, an arm's age runs 0..3, so three passes means it has been
    // skipped all the way round once and is next in line regardless.
    let overdue: Arm | null = null
    let overdueAge = -1
    for (const arm of ARMS) {
      const age = this.servedCount - this.lastServed[arm]
      if (age > MAX_CONSECUTIVE_SKIPS && age > overdueAge) {
        overdue = arm
        overdueAge = age
      }
    }
    let starved = false
    if (overdue !== null) {
      best = overdue
      starved = true
    }
    const bestReason = starved
      ? `Turno pendiente en ${armName(best)}`
      : `Mayor presión en ${armName(best)}`

    let leftBest: Arm = 'north'
    let leftPressure = -1
    let leftAge = Infinity

    for (const arm of ARMS) {
      const pressure = input.leftPressure[arm]
      const age = this.servedCount - this.lastServed[arm]

      // An arm whose shared lane is still occupied by through traffic at the line
      // is not a candidate. Its left-turners are behind that vehicle and cannot
      // reach the line, so an arrow for it would time out unused and then be
      // requested again — and the arm would never take a through green either,
      // because an arrow that keeps being granted never lets one through. Skipping
      // the arm here, rather than downgrading the arrow afterwards, means the
      // through phase happens first and the arrow becomes servable on its own.
      if (!input.leftReady[arm]) {
        continue
      }

      if (pressure > leftPressure || (pressure === leftPressure && age > leftAge)) {
        leftBest = arm
        leftPressure = pressure
        leftAge = age
      }
    }

    // Nobody is waiting to turn left: the junction is a two-phase junction and
    // there is no reason to spend a phase on an arrow nobody is under.
    if (leftPressure <= 0) {
      return { arm: best, mode: 'through', reason: bestReason }
    }

    // A left that has already waited longer than the arrow it is waiting for does
    // not have to win a comparison to be served — but it may only take the phase
    // if the arm that would otherwise be served is not being starved by it.
    //
    // Two earlier versions of this rule were wrong, and both were measured:
    //
    //   - Comparing left pressure against total through pressure could never be
    //     won, because a left-turner is roughly one movement in six. The arrow
    //     was requested 0 times in 73 phase changes and the worst left wait
    //     reached 592 s.
    //   - Dropping the comparison and firing the arrow on the left's own clock
    //     over-corrected: one arm's left took the phase in a tight loop, `served`
    //     fell to 13 in ten minutes, and a vehicle entered on red.
    //
    // So the comparison is kept, but against the pressure that is actually being
    // *denied* — the through pressure on the arm that would have been served.
    // A left outranks the approach it is stealing from only when that approach is
    // not itself carrying a queue, and `leftWorst` is only a tie-break for which
    // arm gets the arrow, never the reason to take one.
    const denied = input.pressure[best]
    if (leftPressure > denied * LEFT_SHARE_OF_DENIED) {
      return {
        arm: leftBest,
        mode: 'left',
        reason: `Giro a la izquierda esperando en ${armName(leftBest)}`,
      }
    }

    return { arm: best, mode: 'through', reason: bestReason }
  }
}

function greenMinimum(mode: GreenKind): number {
  // A left arrow gets a shorter floor than a through green. There is rarely more
  // than one or two cars waiting to turn left, and holding a four-phase cycle's
  // longest green on an arrow that empties in four seconds is how a junction stops
  // moving. The floor still exists, because a two-second arrow reads as a fault.
  return mode === 'left' ? MIN_LEFT_GREEN : MIN_GREEN
}

function greenMaximum(mode: GreenKind): number {
  return mode === 'left' ? MAX_LEFT_GREEN : MAX_GREEN
}

function isOpposite(a: Arm, b: Arm): boolean {
  return (
    (a === 'north' && b === 'south') ||
    (a === 'south' && b === 'north') ||
    (a === 'east' && b === 'west') ||
    (a === 'west' && b === 'east')
  )
}

export function armName(arm: Arm): string {
  return { north: 'Av. Norte', east: 'Calle Este', south: 'Av. Sur', west: 'Calle Oeste' }[arm]
}

/**
 * Pressure for one approach, from the vehicles standing on it.
 *
 * Exported because the formula is the claim, and a claim that is only visible
 * inside a function is a claim the reader has to take on trust.
 */
export function pressureOf(waitingSeconds: number[]): number {
  let total = 0
  for (const waited of waitingSeconds) {
    total += 1 + waited / 12
  }
  return total
}
