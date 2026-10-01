/**
 * The signal, and one vehicle, second by second.
 *
 * `sweep-release.ts` shows `sweptOverAStoppedBody` blocking the right-turner and
 * then, four seconds before the contact, ceasing to be asked at all — while the
 * vehicle is still at its stop line, still at the head of its queue, and moving
 * afterwards. The only gate in front of `boxConflict` is the aspect, so the
 * question is what the aspect was doing in between.
 *
 * Usage: npx tsx scripts/aspect-timeline.ts [seed] [movementId] [fromSeconds] [toSeconds]
 */
import { IntersectionWorld } from '../src/simulation/core/world'
import type { Arm, Aspect } from '../src/simulation/core/index'

const DT = 1 / 60
const args = process.argv.slice(2)
const seed = Number(args[0] ?? 11)
const movement = args[1] ?? 'south-1:right'
const from = Number(args[2] ?? 182)
const to = Number(args[3] ?? 190)

const world = new IntersectionWorld({ seed, baseRate: 0.045, peakRate: 0.075 })
const ARMS: Arm[] = ['north', 'east', 'south', 'west']

console.log(`semilla ${seed} · ${movement} · ${from}..${to} s`)
console.log('')
console.log('   t     n    e    s    w  |  vehiculo  s      v     inBox  committed')
console.log('  ' + '-'.repeat(70))

let last = ''
for (let step = 0; step < 60 * 300; step += 1) {
  world.step(DT)
  const t = step * DT
  if (t < from || t > to) {
    continue
  }
  const aspects = world.controller.aspects()
  const row = ARMS.map((arm) => (aspects[arm] as Aspect).padStart(5)).join('')
  if (row !== last) {
    const vehicle = world.vehicles.find((candidate) => candidate.movement.id === movement)
    const cell = vehicle
      ? `#${String(vehicle.id).padStart(2)} ${vehicle.kind.padEnd(8)}` +
        ` s=${vehicle.s.toFixed(2).padStart(6)} v=${vehicle.v.toFixed(2).padStart(5)}` +
        `  ${vehicle.inBox ? 'box' : '   '}`
      : '(ninguno)'.padEnd(34)
    const committed = vehicle && vehicle.s > vehicle.movement.route.stopS + 0.05
    console.log(`  ${row}  |  ${cell}  ${committed ? 'SI' : 'no'}`)
    last = row
  }
}
