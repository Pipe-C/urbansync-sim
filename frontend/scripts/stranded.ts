/**
 * What does the junction look like after `served` stops rising?
 *
 * Two very different failures share a frozen `served` counter:
 *
 *   - the box is full and everyone is waiting their turn  -> at capacity
 *   - the box is empty and everyone is still waiting      -> arbitration is stuck
 *
 * Aggregate counts cannot tell these apart, because they average over the part
 * of the run that still worked. So sample every 30 s and print the box state,
 * the queue state, and what the controller is doing, in order.
 *
 * Usage: npx tsx scripts/stranded.ts [seed] [minutes] [--default|--calibrated]
 */
import { IntersectionWorld } from '../src/simulation/core/world'
import type { Arm } from '../src/simulation/core/index'

const DT = 1 / 60
const args = process.argv.slice(2)
const seed = Number(args[0] ?? 7)
const minutes = Number(args[1] ?? 10)
const demand = args.includes('--calibrated')
  ? { baseRate: 0.045, peakRate: 0.075 }
  : { baseRate: 0.115, peakRate: 0.29 }

const ARMS: Arm[] = ['north', 'east', 'south', 'west']
const world = new IntersectionWorld({ seed, ...demand })

console.log(
  `semilla ${seed} · ${minutes} min · ${demand.baseRate}/${demand.peakRate} veh/s`,
)
console.log('')
console.log('    t   served  dentro  en cola  en linea   aspects (* = fila con vehiculocommitted)')
console.log('  ' + '-'.repeat(88))

for (let step = 0; step <= 60 * 60 * minutes; step += 1) {
  if (step % 1800 === 0 && step > 0) {
    world.step(0)
    const summary = world.summary()
    const aspects = world.controller.aspects()
    const inBox = world.vehicles.filter((vehicle) => vehicle.inBox)
    const queue = world.vehicles.filter((vehicle) => vehicle.s <= vehicle.movement.route.stopS + 0.05)
    const atLine = world.vehicles.filter(
      (vehicle) =>
        Math.abs(vehicle.s - vehicle.movement.route.stopS) < 0.1 && vehicle.v < 0.05,
    )
    const heads = ARMS.map((arm) => {
      const lane = world.vehicles.filter((vehicle) => vehicle.lane.arm === arm)
      const head = lane.reduce<number>((max, vehicle) => Math.max(max, vehicle.s), 0)
      return `${arm[0]}:${aspects[arm][0]}${head > 70 ? '*' : ' '}`
    })
    const state = world.controller.current
    console.log(
      `  ${(step / 60).toFixed(0).padStart(4)}s` +
        `  ${String(summary.served).padStart(6)}` +
        `  ${String(inBox.length).padStart(6)}` +
        `  ${String(queue.length).padStart(7)}` +
        `  ${String(atLine.length).padStart(9)}` +
        `   ${heads.join(' ')}` +
        `   ${state.kind.padEnd(8)} ${String(state.elapsed.toFixed(1)).padStart(6)}  ${state.reason}`,
    )
    if (step < 60 * 60 * minutes) {
      for (let i = 0; i < 1800; i += 1) world.step(DT)
    }
    continue
  }
  world.step(DT)
}

console.log('')
console.log('vehiculos que siguen dentro de la caja al final:')
const stuck = world.vehicles.filter((vehicle) => vehicle.inBox)
if (stuck.length === 0) {
  console.log('  (ninguno)')
}
for (const vehicle of stuck) {
  const route = vehicle.movement.route
  console.log(
    `  #${vehicle.id} ${vehicle.kind} ${vehicle.movement.id}` +
      ` s=${vehicle.s.toFixed(2)} exitS=${route.exitS.toFixed(2)}` +
      ` v=${vehicle.v.toFixed(2)} espera=${vehicle.waited.toFixed(0)}s` +
      ` stopS=${route.stopS.toFixed(2)}`,
  )
}