/**
 * Overlap count across several seeds, in one run.
 *
 * `verify-model.ts` exists and is the right tool for one configuration, but it
 * runs a single seed, and that turned out to matter enormously: the permissive
 * left-turn collision measured 6 overlap frames on the seed `verify-model` uses
 * and 27–99 on the others. Every tuning decision made on one seed was made on
 * the mildest case in the set, and two of them looked like fixes.
 *
 * Sampling matters too. `verify-model` checks every sixth frame, which is right
 * for speed and wrong for a defect that lasts a handful of frames: an overlap
 * that opens and closes between two samples is invisible. This checks every
 * frame, which is why it is a separate script and not a flag.
 *
 * Usage:
 *   npx tsx scripts/overlap-seeds.ts [minutes] [--default] [--calibrated]
 */
import { IntersectionWorld } from '../src/simulation/core/world'

const DT = 1 / 60

/** The eight seeds used throughout. Not random: the same list every time, so
 *  two runs are comparable. */
const SEEDS = [1, 2, 3, 4, 5, 7, 11, 13]

/** Demands worth measuring. The default is what ships; the calibrated one sits
 *  near measured capacity, which is where the permissive left used to collide. */
const DEMANDS = {
  default: { baseRate: 0.115, peakRate: 0.29 },
  calibrated: { baseRate: 0.045, peakRate: 0.075 },
} as const

/**
 * Separating-axis penetration depth between two oriented rectangles.
 *
 * The minimum over the four candidate axes, not the maximum. See rule 5 in
 * `CONTINUIDAD.md`: saturating every axis turns a glancing overlap into a
 * blocking one, and two stopped cars then lock each other at the stop lines.
 */
function penetration(a: Body, b: Body): number {
  const axes = [
    heading(a.heading),
    lateral(a.heading),
    heading(b.heading),
    lateral(b.heading),
  ]

  let worst = -Infinity

  for (const axis of axes) {
    const centreGap =
      Math.abs((b.position.x - a.position.x) * axis.x + (b.position.z - a.position.z) * axis.z)
    const reach = extent(a, axis) + extent(b, axis)
    worst = Math.max(worst, centreGap - reach)
  }

  return -worst
}

interface Body {
  heading: number
  position: { x: number; z: number }
  spec: { length: number; width: number }
}

function heading(angle: number): { x: number; z: number } {
  return { x: Math.sin(angle), z: Math.cos(angle) }
}

function lateral(angle: number): { x: number; z: number } {
  return { x: Math.cos(angle), z: -Math.sin(angle) }
}

function extent(body: Body, axis: { x: number; z: number }): number {
  const forward = heading(body.heading)
  const side = lateral(body.heading)
  return (
    (body.spec.length / 2) * Math.abs(forward.x * axis.x + forward.z * axis.z) +
    (body.spec.width / 2) * Math.abs(side.x * axis.x + side.z * axis.z)
  )
}

function measure(demand: { baseRate: number; peakRate: number }, minutes: number) {
  const steps = Math.round(minutes * 60) / DT
  let overlaps = 0
  let worst = 0
  let served = 0

  for (const seed of SEEDS) {
    const world = new IntersectionWorld({ seed, ...demand })

    for (let i = 0; i < steps; i += 1) {
      world.step(DT)

      for (let a = 0; a < world.vehicles.length; a += 1) {
        for (let b = a + 1; b < world.vehicles.length; b += 1) {
          const depth = penetration(
            world.vehicles[a] as unknown as Body,
            world.vehicles[b] as unknown as Body,
          )
          if (depth > 0) {
            overlaps += 1
            if (depth > worst) {
              worst = depth
            }
          }
        }
      }
    }

    served += world.summary().served
  }

  return { overlaps, worst, served }
}

const minutesArg = process.argv.find((arg) => /^\\d/.test(arg))
const minutes = minutesArg ? Number(minutesArg) : 5
const which = process.argv.includes('--default')
  ? ['default']
  : process.argv.includes('--calibrated')
    ? ['calibrated']
    : ['default', 'calibrated']

console.log(`overlap-seeds: ${minutes} min, ${SEEDS.length} semillas, muestreo por frame`)
console.log('')
console.log('  demanda          overlaps   peor (m)   served total')
console.log('  ─────────────────────────────────────────────────────')

let anyOverlap = false

for (const name of which) {
  const result = measure(DEMANDS[name as keyof typeof DEMANDS], minutes)
  if (result.overlaps > 0) {
    anyOverlap = true
  }
  console.log(
    `  ${name.padEnd(16)}${String(result.overlaps).padStart(8)}` +
      `${result.worst.toFixed(3).padStart(12)}${String(result.served).padStart(14)}`,
  )
}

console.log('')
console.log(anyOverlap ? 'HAY SOLAPAMIENTOS' : 'sin solapamientos en ninguna semilla')
