/**
 * The fleet.
 *
 * A junction where every vehicle is the same length and the same colour is a
 * diagram of a junction. The catalogue below exists so the road reads as traffic:
 * a bus takes three car lengths and a taxi one and a half, which changes the
 * shape of the queue, and an ambulance is a different object from above as well
 * as from the side.
 *
 * ### On red, and on the signal colours
 *
 * `DESIGN.md`'s Reserved Signal Rule — green means flow, amber means warning,
 * red means congestion, blue means preemption — governs *instrumentation*. It
 * does not govern the paint on a vehicle, and a scene that refused to draw a red
 * fire engine would be obeying a UI rule in a place it was never written for.
 *
 * So the fleet runs on car colours: whites, silvers, graphites, navies, an olive,
 * a beige, a wine. The exceptions are the three vehicles whose entire purpose is
 * to be recognised by their colour at a distance — the ambulance, the fire
 * truck and the patrol car — and they are the only red and saturated blue in
 * the scene. Nothing else in the frame wears a signal colour, and the only
 * other red pixels are light: the tail lamps every kind now carries, and the
 * emergency bars' own pulse. A red pixel is a lamp, an emergency livery, or the
 * product's own diagnostics — never decoration.
 */

export type VehicleKind =
  | 'sedan'
  | 'hatchback'
  | 'taxi'
  | 'van'
  | 'bus'
  | 'ambulance'
  | 'firetruck'
  | 'police'

export interface Paint {
  /** Main body colour. */
  body: string
  /** Roof, or the upper panel of a van and a bus. */
  roof: string
  /** A second colour for liveries: a stripe, a chevron, a checkerboard. */
  accent: string
}

export interface VehicleSpec {
  kind: VehicleKind
  /** Metres. */
  length: number
  width: number
  height: number
  /** Metres per second. Urban approach speeds; 13.9 m/s is 50 km/h. */
  maxSpeed: number
  /** Comfortable acceleration and braking, m/s². */
  accel: number
  decel: number
  /** Share of the arriving stream, before normalisation. */
  weight: number
  paints: Paint[]
  /** A taxi sign on the roof. */
  roofSign?: boolean
  /** A light bar, and therefore a pulse on the intersection's slowest clock. */
  lightBar?: 'emergency' | 'police'
  /** Rendered as a saloon, a van's box body, or a bus's long body. */
  body: 'saloon' | 'box' | 'long'
}

/** Ordinary car paints. Deliberately dull: a road of jewel tones reads as a
 *  toy, and the vehicles are the least important thing in the frame. */
const CAR_PAINTS: Paint[] = [
  { body: '#C9CED6', roof: '#B4BAC4', accent: '#8A929F' },
  { body: '#7C8695', roof: '#6B7482', accent: '#525A66' },
  { body: '#39414F', roof: '#2E3541', accent: '#1E242D' },
  { body: '#E4E7EB', roof: '#D2D6DC', accent: '#A8AEB8' },
  { body: '#3E5573', roof: '#344862', accent: '#243348' },
  { body: '#6E6A5C', roof: '#5E5A4E', accent: '#454238' },
  { body: '#4A5B4A', roof: '#3E4C3E', accent: '#2C372C' },
  { body: '#5C3A3F', roof: '#4C3034', accent: '#372226' },
]

const HATCHBACK_PAINTS: Paint[] = [
  { body: '#A8B2BE', roof: '#96A0AC', accent: '#6E7885' },
  { body: '#D9D3C6', roof: '#C6BFB1', accent: '#9A9384' },
  { body: '#5A6472', roof: '#4C5563', accent: '#39404B' },
  { body: '#8A4B3C', roof: '#763F32', accent: '#563025' },
  { body: '#DCE1E6', roof: '#C8CDD3', accent: '#9EA4AB' },
]

export const VEHICLE_SPECS: Record<VehicleKind, VehicleSpec> = {
  sedan: {
    kind: 'sedan',
    length: 4.6,
    width: 1.84,
    height: 1.45,
    maxSpeed: 13.9,
    accel: 2.4,
    decel: 4.0,
    weight: 30,
    paints: CAR_PAINTS,
    body: 'saloon',
  },
  hatchback: {
    kind: 'hatchback',
    length: 4.05,
    width: 1.76,
    height: 1.52,
    maxSpeed: 13.4,
    accel: 2.4,
    decel: 4.0,
    weight: 22,
    paints: HATCHBACK_PAINTS,
    body: 'saloon',
  },
  taxi: {
    kind: 'taxi',
    length: 4.65,
    width: 1.84,
    height: 1.48,
    maxSpeed: 14.5,
    accel: 2.6,
    decel: 4.0,
    weight: 13,
    // One colour. A taxi in a different colour is a taxi you have to look at
    // twice, and the whole point of the livery is that it is recognisable.
    paints: [{ body: '#D8A72C', roof: '#C69724', accent: '#2A2A2C' }],
    roofSign: true,
    body: 'saloon',
  },
  van: {
    kind: 'van',
    length: 5.4,
    width: 2.0,
    height: 2.35,
    maxSpeed: 12.5,
    accel: 1.7,
    decel: 3.6,
    weight: 15,
    paints: [
      { body: '#E7EAEE', roof: '#F0F2F5', accent: '#9AA2AC' },
      { body: '#AFB7C1', roof: '#C3CAD2', accent: '#7C848F' },
      { body: '#5E6B7A', roof: '#6E7B8A', accent: '#454F5B' },
    ],
    body: 'box',
  },
  bus: {
    kind: 'bus',
    // Eleven metres is a short city bus, and it is the reason the model has to
    // be a model: a bus occupies more than two car lengths, so a queue of three
    // "slots" is not three vehicles. Spacing has to be a function of length.
    length: 11.2,
    width: 2.52,
    height: 3.15,
    maxSpeed: 11.0,
    accel: 1.0,
    decel: 3.0,
    weight: 6,
    paints: [
      { body: '#2F6E8F', roof: '#E8ECEF', accent: '#E8B33A' },
      { body: '#DCDDDF', roof: '#DCDDDF', accent: '#2F6E8F' },
    ],
    body: 'long',
  },
  ambulance: {
    kind: 'ambulance',
    length: 5.65,
    width: 2.05,
    height: 2.45,
    maxSpeed: 16.0,
    accel: 3.0,
    decel: 4.2,
    weight: 0,
    // Never drawn from the general stream. The world spawns these deliberately,
    // one at a time, when it wants to demonstrate preemption.
    paints: [{ body: '#F2F4F6', roof: '#F2F4F6', accent: '#C93A3A' }],
    lightBar: 'emergency',
    body: 'box',
  },
  police: {
    kind: 'police',
    length: 4.95,
    width: 1.9,
    height: 1.55,
    maxSpeed: 15.5,
    accel: 3.0,
    decel: 4.2,
    weight: 4,
    // Battenburg, which is what European patrol cars actually wear. It reads as
    // "police" from directly above, where a light bar alone is two small dots.
    paints: [{ body: '#F0F2F4', roof: '#1B2A44', accent: '#2E6BC4' }],
    lightBar: 'police',
    body: 'saloon',
  },
  firetruck: {
    kind: 'firetruck',
    // Length is a model rule as well as a fact about fire engines. At 8,4 m
    // the truck is past the length where `chooseMovement` will ever offer it a
    // left turn — the same limit the 11,2 m bus is subject to — so it turns
    // right or it goes through, and either way it is the longest thing the
    // emergency rotation puts on the road.
    length: 8.4,
    width: 2.5,
    height: 3.1,
    // An emergency vehicle is driven hard whatever its size, so it accelerates
    // like the ambulance and the patrol car rather than like the bus it is
    // almost as long as. It matters beyond realism: preemption holds an arm at
    // green until this vehicle clears the box, so the sooner it clears, the
    // less the rest of the intersection is made to wait for it.
    maxSpeed: 15.0,
    accel: 3.0,
    decel: 4.2,
    // Never drawn from the general stream. `updateEmergency` alternates it with
    // the ambulance, so preemption shows both an ambulance and a fire engine.
    weight: 0,
    paints: [{ body: '#B22C22', roof: '#B22C22', accent: '#E9C46A' }],
    lightBar: 'emergency',
    body: 'box',
  },
}

/** Kinds that can be drawn from the arriving stream at all. The ambulance and
 *  the fire truck carry a weight of zero and are excluded here as well, so a
 *  future edit that gave one a real weight would not also start spraying
 *  emergency vehicles into the ordinary traffic. The patrol car is not among
 *  them: it is ordinary traffic that happens to be blue-and-white. */
export const ORDINARY_KINDS: VehicleKind[] = [
  'sedan',
  'hatchback',
  'taxi',
  'van',
  'bus',
  'police',
]

/**
 * A stable pseudo-random source.
 *
 * The junction is decoration, but it is decoration that is looked at for a long
 * time, and a stream generated from `Math.random()` re-rolls on every remount —
 * which is how a scene ends up with a queue of five taxis in a row after a
 * resize. A seeded generator makes the scene reproducible, which is also the
 * first thing anyone will ask when they want to know whether a change to the
 * control law changed anything.
 *
 * This is a mulberry32: 32 bits of state, one multiply, and good enough
 * distribution for choosing a colour.
 */
export class Random {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  pick<T>(items: readonly T[]): T {
    const index = Math.min(items.length - 1, Math.floor(this.next() * items.length))
    return items[index] as T
  }

  /** Index into a weighted list. Weights need not be normalised. */
  weighted<K extends string>(weights: Record<K, number>): K {
    const keys = Object.keys(weights) as K[]
    let total = 0
    for (const key of keys) {
      total += weights[key]
    }

    let threshold = this.next() * total
    for (const key of keys) {
      threshold -= weights[key]
      if (threshold <= 0) {
        return key
      }
    }

    return keys[0] as K
  }
}
