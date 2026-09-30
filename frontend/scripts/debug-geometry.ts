/**
 * Print the exact geometry behind one refusal to enter.
 *
 * The release gates are private, so the model is asked directly: for the first
 * vehicle that `boxConflict` refuses, this prints every vehicle it was compared
 * against, with the numbers the gate is actually using — arc, body centre,
 * heading, how far the body reaches into the junction square, and whether the
 * arc prefilter passed.
 *
 * Run with: npx tsx scripts/debug-geometry.ts
 */

import {
  IntersectionWorld,
  JUNCTION_HALF,
  type Arm,
  type VehicleState,
} from '../src/simulation/core/index.ts'
import { junctionIntrusion } from '../src/simulation/core/world.ts'

interface Internals {
  boxConflict(vehicle: VehicleState): boolean
  occupiesBox(vehicle: VehicleState): boolean
  bodyConflict(a: VehicleState, b: VehicleState): boolean
}

const world = new IntersectionWorld({ seed: 7 })
const inner = world as unknown as Internals
const DT = 1 / 60

function describe(vehicle: VehicleState): string {
  const route = vehicle.movement.route
  return (
    `${vehicle.kind}#${vehicle.id} ${vehicle.movement.id} ` +
    `s=${vehicle.s.toFixed(3)} pos=(${vehicle.position.x.toFixed(2)},${vehicle.position.z.toFixed(2)}) ` +
    `h=${vehicle.heading.toFixed(3)} L=${vehicle.spec.length} ` +
    `stopS=${route.stopS} exitS=${route.exitS.toFixed(2)} ` +
    `intrusion=${junctionIntrusion(vehicle).toFixed(3)} occupies=${inner.occupiesBox(vehicle)}`
  )
}

for (let step = 0; step < 90 * 60; step += 1) {
  world.step(DT)
  if (step % 30 !== 0) {
    continue
  }

  const aspects = world.controller.aspects()
  const greenArms: Arm[] = (['north', 'east', 'south', 'west'] as Arm[]).filter(
    (arm) => aspects[arm] === 'green',
  )

  for (const vehicle of world.vehicles) {
    if (!greenArms.includes(vehicle.lane.arm)) continue
    if (vehicle.s > vehicle.movement.route.stopS + 0.1) continue
    if (vehicle.v > 0.5) continue
    if (!inner.boxConflict(vehicle)) continue

    console.log(`\n--- step ${step} (t=${(step * DT).toFixed(1)}s) aspect=${aspects[vehicle.lane.arm]}`)
    console.log(`REFUSED ${describe(vehicle)}`)
    for (const other of world.vehicles) {
      if (other === vehicle) continue
      if (!inner.occupiesBox(other) && !inner.bodyConflict(vehicle, other)) continue
      const reason = inner.occupiesBox(other)
        ? inner.bodyConflict(vehicle, other)
          ? 'body-conflicting AND in the box'
          : 'in the box (crossing path)'
        : 'body-conflicting (not in box)'
      console.log(`  vs ${describe(other)}  [${reason}]`)
    }
    process.exit(0)
  }
}

console.log('no refusal sampled')
console.log(`junctionHalf=${JUNCTION_HALF}`)
