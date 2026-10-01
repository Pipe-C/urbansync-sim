/**
 * Where the junction stopped.
 *
 * `verify-model` reports "waiting for the junction to empty" with served frozen,
 * which says the box is occupied and cannot discharge. This dumps every vehicle
 * that is stationary, so the question is answerable directly: is it stuck behind
 * its own stop line (a queue, harmless) or past it (in the box, fatal)?
 *
 * Usage: npx tsx scripts/box-occupants.ts [seed] [atSeconds]
 */
import { IntersectionWorld, setBodyTrace, setTraceVehicle } from '../src/simulation/core/world'

const DT = 1 / 60
const args = process.argv.slice(2)
const seed = Number(args[0] ?? 1)
const at = Number(args[1] ?? 120)
const traceId = Number(args[2] ?? -1)
const watch = process.argv[4] ?? ''

if (traceId >= 0) {
  setBodyTrace(true)
  setTraceVehicle(traceId)
}

const calibrated = !process.argv.includes('--default')
const world = new IntersectionWorld(
  calibrated ? { seed, baseRate: 0.045, peakRate: 0.075 } : { seed, baseRate: 0.115, peakRate: 0.29 },
)

for (let step = 0; step <= Math.round(at / DT); step += 1) {
  world.step(DT)
  for (const line of world.takeTrace()) {
    if (line.includes(`id=${traceId} `) && line.includes('INTEGRATE')) {
      console.log(line)
    } else if (watch && line.includes(`[${watch} `)) {
      console.log(line)
    }
  }
}

const stopped = world.vehicles.filter((vehicle) => vehicle.v < 0.05)
const inBox = stopped.filter((vehicle) => vehicle.s > vehicle.movement.route.stopS + 0.05)
const atLine = stopped.filter((vehicle) => vehicle.s <= vehicle.movement.route.stopS + 0.05)

console.log(`semilla ${seed} · t=${at}s · ${world.vehicles.length} vehiculos · served ${world.summary().served}`)
console.log(`  parados: ${stopped.length}   en la linea: ${atLine.length}   DENTRO de la caja: ${inBox.length}`)
console.log('')

console.log('  EN LA CAJA (esto es lo que no se vacia)')
console.log('  ' + '-'.repeat(78))
for (const vehicle of inBox) {
  const route = vehicle.movement.route
  console.log(
    `  #${String(vehicle.id).padStart(3)} ${vehicle.kind.padEnd(9)} ${vehicle.movement.id.padEnd(16)}` +
      ` s=${vehicle.s.toFixed(2).padStart(7)} v=${vehicle.v.toFixed(2).padStart(5)}` +
      `  linea=${route.stopS.toFixed(2)}  enBox=${vehicle.inBox ? 'si' : 'no'}`,
  )
}

console.log('')
console.log('  EN LA LINEA, por movimiento')
console.log('  ' + '-'.repeat(78))
const byLane = new Map<string, number[]>()
for (const vehicle of atLine) {
  byLane.set(vehicle.movement.id, [...(byLane.get(vehicle.movement.id) ?? []), vehicle.s])
}
for (const [movement, positions] of [...byLane.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${movement.padEnd(18)} ${String(positions.length).padStart(3)} en cola` +
    `  (s de cabeza ${Math.max(...positions).toFixed(2)})`)
}

console.log('')
console.log('  CABECAS (id, para trazar)')
console.log('  ' + '-'.repeat(78))
for (const [movement, positions] of [...byLane.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const head = atLine.find((vehicle) => vehicle.movement.id === movement && vehicle.s === Math.max(...positions))
  if (head) {
    console.log(`  ${movement.padEnd(18)} #${String(head.id).padStart(3)} s=${head.s.toFixed(2)} v=${head.v.toFixed(2)}`)
  }
}