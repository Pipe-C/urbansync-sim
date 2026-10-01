/**
 * Throwaway diagnostic: characterise every stop-line crossing that happens while
 * the approach aspect is red.
 *
 * The invariant checker counts them; it does not say what they are. The two
 * candidate causes need opposite fixes:
 *
 *   - a vehicle creeping over the line at a speed the comfort model can no longer
 *     slow down, which is an artefact of an asymptotic brake and not a driver,
 *   - a vehicle crossing at speed, which means the dilemma zone is not being
 *     honoured and is a real control fault.
 *
 * So this prints the distribution of crossing speeds and the overshoot distance.
 */

import { IntersectionWorld } from '../src/simulation/core/index.ts'

const DT = 1 / 60
const STEPS = Math.round(10 * 60) / DT

const world = new IntersectionWorld({ seed: 7 })

let previous = new Map<number, { s: number; v: number }>()
let crossed = 0
const speeds: number[] = []
const overshoots: number[] = []
const samples: string[] = []

for (let step = 0; step < STEPS; step += 1) {
  world.step(DT)

  for (const vehicle of world.vehicles) {
    const route = vehicle.movement.route
    const before = previous.get(vehicle.id)

    // Per movement, not per approach: `aspects()` is the through aspect and reads
    // red on every arm during a protected left phase, so asking it here counted
    // every left-turner released on a green left arrow as a red runner.
    const aspect = world.controller.aspectFor(vehicle.lane.arm, vehicle.movement.turn)

    if (
      aspect === 'red' &&
      vehicle.s > route.stopS &&
      before !== undefined &&
      before.s <= route.stopS
    ) {
      crossed += 1
      speeds.push(vehicle.v)
      overshoots.push(vehicle.s - route.stopS)
      if (samples.length < 20) {
        samples.push(
          `  t=${(step * DT).toFixed(2)}s ${vehicle.kind}#${vehicle.id} ${vehicle.movement.id}` +
            ` v=${vehicle.v.toFixed(3)} over=${(vehicle.s - route.stopS).toFixed(4)}` +
            ` decel=${vehicle.spec.decel} waited=${vehicle.waited.toFixed(1)}`,
        )
      }
    }

    previous.set(vehicle.id, { s: vehicle.s, v: vehicle.v })
  }
}

speeds.sort((a, b) => a - b)
overshoots.sort((a, b) => a - b)

console.log(`red crossings: ${crossed}\n`)
console.log('speed at crossing (m/s)')
print(speeds)
console.log('\novershoot past the line (m)')
print(overshoots)
console.log('\nsamples')
for (const line of samples) {
  console.log(line)
}

function print(values: number[]): void {
  if (values.length === 0) return
  const at = (q: number) => values[Math.min(values.length - 1, Math.floor(values.length * q))]!
  console.log(
    `  min ${at(0).toFixed(3)}  p50 ${at(0.5).toFixed(3)}  p90 ${at(0.9).toFixed(3)}  max ${at(1).toFixed(3)}`,
  )
  const buckets = [
    [0, 0.05],
    [0.05, 0.2],
    [0.2, 0.5],
    [0.5, 1],
    [1, 2],
    [2, 5],
    [5, Infinity],
  ]
  for (const [lo, hi] of buckets) {
    const n = values.filter((v) => v >= lo && v < hi).length
    if (n > 0) console.log(`  [${lo}, ${hi === Infinity ? 'inf' : hi}) ${'#'.repeat(n)} ${n}`)
  }
}
