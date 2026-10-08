import { CROSSWALKS, type Crosswalk } from './layout'
import { Random } from './fleet'

/**
 * Pedestrians.
 *
 * They are not decoration and they are not a "cute detail" — they are the
 * visible reason the signal has an all-red interval at all. Remove them and red
 * becomes a gap in the traffic; leave them in and red is obviously the part of
 * the cycle in which people cross, which is the argument the scene exists to
 * make about adaptive control.
 *
 * Two consequences follow, and both are modelled rather than drawn:
 *
 * - **They are released by the same controller as the vehicles.** A walker
 *   starts only when the road it is about to cross is at red, and the
 *   controller holds the all-red while anyone is still on it. Without the second
 *   half, a walker released on a short green is halfway across when a car is
 *   released, and the one scene that must never show a vehicle running a red
 *   would be showing it running a person over.
 * - **They have a walk cycle.** A figure that slides is a diagram; a figure whose
 *   legs alternate and whose shoulders counter-swing is a person, and at the
 *   scale these render — around twenty pixels tall — the legs are the only thing
 *   that separates the two.
 */

export type WalkerGait = 'idle' | 'walking'

export interface Walker {
  id: number
  crosswalk: Crosswalk
  /** `+1` walks from the negative kerb to the positive one, `-1` the reverse. */
  direction: 1 | -1
  /** Distance travelled along the crossing, from the origin kerb. */
  offset: number
  /** Metres per second. A normal adult walk is 1.2–1.4 m/s; these are brisk
   *  enough to clear a 13.6 m crossing inside the controller's clearance window,
   *  which is what keeps a car off a person. */
  speed: number
  /** Gait cycle in radians, advanced by distance rather than by time, so a
   *  slower walker takes shorter steps instead of taking the same steps more
   *  slowly. That is what real walking looks like, and it is one line. */
  stride: number
  /** Height, so the crowd is not eight identical posts. */
  height: number
  /** A three-tone clothing palette, so the pavement is not one grey. */
  clothing: { top: string; legs: string; skin: string }
  /** `waiting` on the kerb, `walking` across, `done` at the far kerb. */
  state: WalkerGait | 'done'
  /** Seconds spent waiting on the kerb, for the pacing of the next departure. */
  patience: number
}

const SKIN_TONES = ['#C89A72', '#8D5F3F', '#E0B48C', '#6B4429', '#A9764E']
const CLOTHING: { top: string; legs: string }[] = [
  { top: '#3E5573', legs: '#2B3038' },
  { top: '#6E6A5C', legs: '#3E3B33' },
  { top: '#5C3A3F', legs: '#33302F' },
  { top: '#4A5B4A', legs: '#2E332C' },
  { top: '#7C8695', legs: '#3A4049' },
  { top: '#39414F', legs: '#252A32' },
]

/** Stride length. 0.72 m is an adult's, and the walk cycle is derived from it. */
const STRIDE_LENGTH = 0.72

/** Kerb offset: people do not walk on the very edge of the carriageway. */
const KERB_INSET = 0.5

export interface WalkerFieldOptions {
  seed: number
  /** How many people to keep on the pavement at once, across all four
   *  crossings. Enough that the crossings read as used and busy, few enough
   *  that a queue of them stops being a pavement. */
  population?: number
}

export class WalkerField {
  readonly walkers: Walker[] = []

  private random: Random
  private population: number
  private nextId = 1

  constructor(options: WalkerFieldOptions) {
    this.random = new Random(options.seed)
    this.population = options.population ?? 12

    for (let index = 0; index < this.population; index += 1) {
      const crosswalk = CROSSWALKS[index % CROSSWALKS.length]
      if (crosswalk) {
        this.walkers.push(this.create(crosswalk))
      }
    }
  }

  private create(crosswalk: Crosswalk): Walker {
    const direction: 1 | -1 = this.random.next() < 0.5 ? 1 : -1
    const clothing = this.random.pick(CLOTHING)

    return {
      id: this.nextId++,
      crosswalk,
      direction,
      offset: direction > 0 ? -KERB_INSET : crosswalk.length + KERB_INSET,
      speed: this.random.range(1.4, 1.8),
      stride: this.random.next() * Math.PI * 2,
      height: this.random.range(1.62, 1.86),
      clothing: { ...clothing, skin: this.random.pick(SKIN_TONES) },
      state: 'idle',
      patience: 0,
    }
  }

  /**
   * Advances the crossing.
   *
   * `permitted` is the set of arms whose road is currently at red, which is
   * exactly when crossing it is safe. A walker already on the carriageway keeps
   * going whatever happens — stopping a person in the middle of a road because
   * the light changed would be both wrong and the one thing in this scene capable
   * of producing a genuinely alarming image.
   */
  step(delta: number, permitted: ReadonlySet<Crosswalk['arm']>): void {
    for (const walker of this.walkers) {
      if (walker.state === 'done') {
        // Turn around and wait to cross back. Without flipping the direction the
        // walker is re-placed on the kerb it just reached, still facing the way
        // it came, and the next step instantly "finishes" it again: the figure
        // crosses once and then flickers in place for the rest of the run.
        walker.direction = walker.direction > 0 ? -1 : 1
        walker.offset = walker.direction > 0 ? -KERB_INSET : walker.crosswalk.length + KERB_INSET
        walker.state = 'idle'
        walker.patience = 0
        continue
      }

      if (walker.state === 'idle') {
        walker.patience += delta
        // A short, varied wait before stepping off. Uniform departures would
        // put the whole population on the crossing at the same instant, which
        // is the one thing that makes a group of people read as an animation.
        if (permitted.has(walker.crosswalk.arm) && walker.patience > this.random.range(0.4, 3.2)) {
          walker.state = 'walking'
        }
        continue
      }

      const previous = walker.offset
      walker.offset += walker.speed * walker.direction * delta
      walker.stride += ((walker.offset - previous) / STRIDE_LENGTH) * Math.PI * 2

      const finished =
        walker.direction > 0 ? walker.offset >= walker.crosswalk.length : walker.offset <= 0

      if (finished) {
        walker.state = 'done'
      }
    }
  }

  /**
   * The arms whose crossings have someone on the carriageway right now.
   *
   * Reported as a set rather than a single boolean because the controller holds
   * the all-red only for the crossing it is about to release. With a population
   * that crosses back and forth continuously there is almost always *someone*
   * walking somewhere, and a global "anyone crossing" interlock would extend the
   * all-red to its ceiling on nearly every cycle and starve the junction.
   */
  occupiedCrossings(): Set<Crosswalk['arm']> {
    const arms = new Set<Crosswalk['arm']>()
    for (const walker of this.walkers) {
      if (walker.state === 'walking') {
        arms.add(walker.crosswalk.arm)
      }
    }
    return arms
  }
}
