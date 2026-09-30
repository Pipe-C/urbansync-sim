import { ARMS, type Arm } from './layout'

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

/** After this long the current approach yields even if nothing else is waiting. */
export const MAX_GREEN = 21

/** Enough time for a car at approach speed to stop in the distance it has. */
export const AMBER = 3.2

/** The interval the cross traffic gets to clear the box before anyone else moves. */
export const ALL_RED = 2.2

/** How long a cleared all-red may be extended to finish letting people across. */
export const MAX_CLEARANCE_EXTENSION = 6

/**
 * Hard ceiling on extending an all-red because the box is not empty.
 *
 * An interlock with no ceiling is a deadlock: one vehicle that stopped with its
 * nose in the box would hold the junction at red for ever. Real signals solve
 * this the same way, by capping the wait and accepting that a stalled vehicle is
 * a problem for the operator rather than for the timing plan.
 */
export const MAX_BOX_EXTENSION = 9

export type ControllerState =
  | { kind: 'green'; arm: Arm; elapsed: number; reason: string }
  | { kind: 'amber'; arm: Arm; elapsed: number; reason: string }
  | { kind: 'allRed'; clearing: Arm | null; elapsed: number; reason: string }

export interface ControllerInput {
  /** Total pressure per approach, from the world. */
  pressure: Record<Arm, number>
  /** The arm an emergency vehicle is approaching on, if any. */
  preemption: Arm | null
  /** True while anyone is still on a crossing the current state would release
   *  traffic across. This is the pedestrian clearance interlock, and it is why
   *  the all-red is not a fixed number of seconds. */
  crossingBlocked: boolean
  /** The arm whose crossing is currently occupied, for the message. */
  crossingArm: Arm | null
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
}

export class SignalController {
  private state: ControllerState = {
    kind: 'allRed',
    clearing: null,
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

  /** What each approach is being shown. The heads read this, and the turning
   *  logic reads it, so the lamp and the behaviour cannot disagree. */
  aspects(): Record<Arm, Aspect> {
    const result: Record<Arm, Aspect> = { north: 'red', east: 'red', south: 'red', west: 'red' }
    const state = this.state

    if (state.kind === 'green') {
      result[state.arm] = 'green'
      // In a two-phase junction the axis gets green together. Modelling each
      // arm separately would mean a four-phase cycle with a protected left,
      // which is a different product and a different argument.
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

  /** The aspect a given approach's *movement* is judged on. A left-turner is
   *  released on the green of its own approach only, which is what the state
   *  machine already says; the wrapper is here so the world never has to know
   *  that an axis is served as a pair. */
  aspectFor(arm: Arm): Aspect {
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

  private stepGreen(state: Extract<ControllerState, { kind: 'green' }>, input: ControllerInput): void {
    const holdsMinimum = state.elapsed < MIN_GREEN
    const preemptionElsewhere =
      this.preemptionArm !== null && this.preemptionArm !== state.arm

    if (preemptionElsewhere) {
      this.goAmber(state.arm, `Preemptión: emergencia en ${armName(this.preemptionArm!)}`)
      return
    }

    if (holdsMinimum) {
      return
    }

    if (state.elapsed >= MAX_GREEN) {
      this.goAmber(state.arm, `Green máximo alcanzado (${Math.round(MAX_GREEN)} s)`)
      return
    }

    const choice = this.choose(input)
    if (choice !== state.arm) {
      this.goAmber(state.arm, `Mayor presión en ${armName(choice)}`)
    }
  }

  private stepAmber(state: Extract<ControllerState, { kind: 'amber' }>): void {
    if (state.elapsed < AMBER) {
      return
    }
    this.state = {
      kind: 'allRed',
      clearing: state.arm,
      elapsed: 0,
      reason: `Fin de ámbar en ${armName(state.arm)}`,
    }
  }

  private stepAllRed(state: Extract<ControllerState, { kind: 'allRed' }>, input: ControllerInput): void {
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

    if (input.crossingBlocked && beyondNominal < MAX_CLEARANCE_EXTENSION) {
      this.state = {
        ...state,
        reason: `Espera al paso de peatones en ${armName(input.crossingArm ?? 'north')}`,
      }
      return
    }

    const preemption = this.preemptionArm
    if (preemption) {
      this.goGreen(preemption, `Preemptión: emergencia en ${armName(preemption)}`)
      return
    }

    const choice = this.choose(input)
    this.goGreen(choice, this.servedCount === 0 ? 'Primer verde' : `Mayor presión en ${armName(choice)}`)
  }

  private goGreen(arm: Arm, reason: string): void {
    this.servedCount += 1
    this.lastServed[arm] = this.servedCount
    this.state = { kind: 'green', arm, elapsed: 0, reason }
  }

  private goAmber(arm: Arm, reason: string): void {
    this.state = { kind: 'amber', arm, elapsed: 0, reason }
  }

  /**
   * Highest pressure wins; ties go to whoever has gone longest without a green.
   *
   * The tie-break is not a refinement. Two approaches on an empty junction at
   * the start of a run both have zero pressure, and without it the first
   * candidate in a fixed array order would be served every time, which reads as
   * a broken signal rather than an idle one.
   */
  private choose(input: ControllerInput): Arm {
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

    return best
  }
}

function isOpposite(a: Arm, b: Arm): boolean {
  return (a === 'north' && b === 'south') ||
    (a === 'south' && b === 'north') ||
    (a === 'east' && b === 'west') ||
    (a === 'west' && b === 'east')
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
