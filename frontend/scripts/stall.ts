/**
 * Is the junction refusing to discharge, or refusing because it is full?
 *
 * The two look identical from the outside - `served` stops rising, the box looks
 * empty at the end - and they need opposite fixes. So: on every frame, for each
 * arm, is it green, and if so is the head of one of its queues stationary at its
 * line? And while that is happening, is anybody in the box?
 *
 * A green refused with the box empty is an interlock with nothing to interlock
 * against. A green refused with the box occupied is a junction at capacity, and
 * the fix is demand or geometry, not arbitration.
 *
 * Usage: npx tsx scripts/stall.ts [seed] [minutes] [--default|--calibrated]
 */
import { IntersectionWorld } from '../src/simulation/core/world'
import type { Arm, Aspect } from '../src/simulation/core/index'

const DT = 1 / 60
const args = process.argv.slice(2)
const seed = Number(args[0] ?? 7)
const minutes = Number(args[1] ?? 10)
const demand = args.includes('--calibrated')
  ? { baseRate: 0.045, peakRate: 0.075 }
  : { baseRate: 0.115, peakRate: 0.29 }

const ARMS: Arm[] = ['north', 'east', 'south', 'west']
const world = new IntersectionWorld({ seed, ...demand })

interface Stall {
  frames: number
  boxOccupied: number
  boxEmpty: number
  sample: string
}

const stalls = new Map<Arm, Stall>()
let greenFrames = 0
let servedAt: number[] = []

for (let step = 0; step < 60 * 60 * minutes; step += 1) {
  world.step(DT)
  const aspects = world.controller.aspects()
  const boxFull = world.vehicles.some((vehicle) => vehicle.inBox)

  for (const arm of ARMS) {
    if ((aspects[arm] as Aspect) !== 'green') {
      continue
    }
    greenFrames += 1

    // The head of each queue on this arm's approach: the vehicle no one on that
    // movement is waiting behind.
    const heads = world.vehicles.filter((vehicle) => {
      if (vehicle.lane.arm !== arm) return false
      if (vehicle.s > vehicle.movement.route.exitS) return false
      return !world.vehicles.some(
        (other) =>
          other !== vehicle &&
          other.movement.id === vehicle.movement.id &&
          other.s > vehicle.s,
      )
    })

    for (const head of heads) {
      const route = head.movement.route
      const parked = head.v < 0.05 && head.s > route.stopS - 1.5
      if (!parked) {
        continue
      }
      const record = stalls.get(arm) ?? {
        frames: 0,
        boxOccupied: 0,
        boxEmpty: 0,
        sample: '',
      }
      record.frames += 1
      if (boxFull) {
        record.boxOccupied += 1
      } else {
        record.boxEmpty += 1
        if (record.sample === '') {
          record.sample =
            `${head.movement.id} ${head.kind} s=${head.s.toFixed(2)} v=${head.v.toFixed(2)}` +
            ` linea=${route.stopS.toFixed(2)} inBox=${head.inBox}`
        }
      }
      stalls.set(arm, record)
    }
  }

  if (step % 1800 === 0) {
    servedAt.push(world.summary().served)
  }
}

console.log(`semilla ${seed} · ${minutes} min · ${demand.baseRate}/${demand.peakRate} veh/s`)
console.log(`served por minuto: ${servedAt.join('  ')}`)
console.log('')
console.log('  brazo  cuadros-en-verde-con-cabecera-parada   caja ocupada   caja VACIA   ejemplo')
console.log('  ' + '-'.repeat(96))
for (const arm of ARMS) {
  const record = stalls.get(arm)
  if (!record) {
    console.log(`  ${arm.padEnd(7)} 0`)
    continue
  }
  console.log(
    `  ${arm.padEnd(7)} ${String(record.frames).padStart(10)}` +
      `   ${String(record.boxOccupied).padStart(12)}` +
      `   ${String(record.boxEmpty).padStart(10)}   ${record.sample}`,
  )
}