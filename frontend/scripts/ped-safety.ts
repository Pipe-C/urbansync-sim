/**
 * Do cars ever drive through pedestrians?
 *
 * The signal holds the all-red while someone is on a crossing, and a right-turner
 * yields at the kerb, but those are two rules among many and neither is a proof.
 * This walks the model with no renderer and, every frame, asks the only question
 * that matters: is a walking pedestrian's position inside a vehicle's footprint?
 *
 * It also counts completed crossings per walker, which is how the "they cross
 * once and then freeze" regression is caught: a population that loops produces a
 * number that keeps rising, a stuck one produces a flat line.
 *
 * Usage:
 *   npx tsx scripts/ped-safety.ts [minutes] [seed ...]
 */
import { CROSSWALKS, IntersectionWorld, type Walker } from '../src/simulation/core/index'

const DT = 1 / 60
const SEEDS = [1, 2, 3, 4, 5, 7, 11, 13]

/** Half a metre of body, so a near miss counts as a touch the way it reads. */
const PERSON_RADIUS = 0.3

interface Footprint {
  x: number
  z: number
}

/** Where a walking pedestrian stands, in world x/z. Mirrors `WalkerMesh`. */
function walkerPosition(walker: Walker): Footprint {
  const crosswalk = CROSSWALKS.find((candidate) => candidate.arm === walker.crosswalk.arm)!
  const alongCrossing = walker.offset - crosswalk.length / 2
  return {
    x: crosswalk.centre.x + crosswalk.across.x * alongCrossing,
    z: crosswalk.centre.z + crosswalk.across.z * alongCrossing,
  }
}

function insideVehicle(
  point: Footprint,
  vehicle: { heading: number; position: Footprint; spec: { length: number; width: number } },
): number {
  const forwardX = Math.sin(vehicle.heading)
  const forwardZ = Math.cos(vehicle.heading)
  const sideX = Math.cos(vehicle.heading)
  const sideZ = -Math.sin(vehicle.heading)
  const dx = point.x - vehicle.position.x
  const dz = point.z - vehicle.position.z
  const along = Math.abs(dx * forwardX + dz * forwardZ)
  const across = Math.abs(dx * sideX + dz * sideZ)
  const penetration = Math.min(
    vehicle.spec.length / 2 + PERSON_RADIUS - along,
    vehicle.spec.width / 2 + PERSON_RADIUS - across,
  )
  return penetration > 0 ? penetration : 0
}

function measure(minutes: number) {
  const steps = Math.round(minutes * 60) / DT
  let contacts = 0
  let worst = 0
  let crossings = 0
  let walkers = 0
  const samples: string[] = []

  for (const seed of SEEDS) {
    const world = new IntersectionWorld({ seed })
    const previous = new Map<number, Walker['state']>()
    const startFrame = new Map<number, number>()

    for (let i = 0; i < steps; i += 1) {
      world.step(DT)

      for (const walker of world.walkers) {
        const before = previous.get(walker.id)
        if (before === 'walking' && walker.state === 'done') {
          crossings += 1
        }
        if (before === undefined) {
          walkers += 1
        }
        if (walker.state === 'walking' && before !== 'walking') {
          startFrame.set(walker.id, i)
        }
        previous.set(walker.id, walker.state)

        if (walker.state !== 'walking') {
          continue
        }
        const point = walkerPosition(walker)
        for (const vehicle of world.vehicles) {
          const depth = insideVehicle(point, vehicle)
          if (depth > 0) {
            contacts += 1
            if (depth > worst) {
              worst = depth
            }
            if (samples.length < 40) {
              const age = ((i - (startFrame.get(walker.id) ?? i)) * DT).toFixed(1)
              samples.push(
                `seed ${seed} t=${(i * DT).toFixed(1)} walker@${walker.crosswalk.arm} age=${age}s ` +
                  `veh ${vehicle.kind} ${vehicle.lane.arm}->${vehicle.movement.destination.arm} ` +
                  `${vehicle.movement.turn} inBox=${vehicle.inBox} depth=${depth.toFixed(2)} ` +
                  `state=${world.controller.current.kind}/${world.controller.current.mode} ` +
                  `reason="${world.controller.current.reason}"`,
              )
            }
          }
        }
      }
    }
  }

  return { contacts, worst, crossings, walkers, samples }
}

const minutesArg = process.argv.find((arg) => /^\d/.test(arg))
const minutes = minutesArg ? Number(minutesArg) : 3

const result = measure(minutes)

for (const line of result.samples) {
  console.log(line)
}
console.log('')
console.log(`ped-safety: ${minutes} min, ${SEEDS.length} semillas, muestreo por frame`)
console.log(`  contactos coche↔peatón   ${result.contacts}`)
console.log(`  peor penetración (m)     ${result.worst.toFixed(3)}`)
console.log(`  cruces completados       ${result.crossings}`)
console.log(`  walkers                  ${result.walkers}`)
console.log('')
console.log(result.contacts === 0 ? 'sin contactos' : 'HAY CONTACTOS')
