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
  /** Metres per second. A normal adult walk is 1.2–1.4 m/s. */
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
   *  crossings. Six is enough to make the crossing read as used and few enough
   *  that a queue of them is not a crowd. */
  population?: number
}

export class WalkerField {
  readonly walkers: Walker[] = []

  private random: Random
  private population: number
  private nextId = 1

  constructor(options: WalkerFieldOptions) {
    this.random = new Random(options.seed)
    this.population = options.population ?? 6

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
      speed: this.random.range(1.18, 1.42),
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
        walker.offset = walker.direction > 0
          ? walker.crosswalk.length + KERB_INSET
          : -KERB_INSET
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
        walker.direction > 0
          ? walker.offset >= walker.crosswalk.length
          : walker.offset <= 0

      if (finished) {
        walker.state = 'done'
      }
    }
  }

  /** True while anyone is on a carriageway, which is the clearance interlock. */
  anyoneCrossing(): boolean {
    return this.walkers.some((walker) => walker.state === 'walking')
  }

  /** The arm whose crossing is occupied, for the controller's message. */
  occupiedCrossing(): Crosswalk['arm'] | null {
    const crossing = this.walkers.find((walker) => walker.state === 'walking')
    return crossing ? crossing.crosswalk.arm : null
  }
}
