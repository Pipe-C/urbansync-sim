/**
 * What does the left-versus-through decision actually look like?
 *
 * The controller has to decide when a protected left phase is worth taking away
 * from the approach that would otherwise be served. Both obvious rules for that
 * decision have been measured and both are wrong:
 *
 *   - left pressure must beat through pressure: never fires, 0 requests in 73
 *     phase changes, because a left is roughly one movement in six;
 *   - fire on the left's own clock: collapses the junction, `served` = 13 in ten
 *     minutes, one vehicle entered on red.
 *
 * So the constant between them has to come from the distribution rather than from
 * an intuition, and this prints it: on every frame where a left is waiting, how
 * much left pressure there is against how much through pressure the decision
 * would be denying. The ratio's distribution is the answer, and where the mass
 * sits is where the threshold belongs.
 *
 * Usage:
 *   npx tsx scripts/left-share.ts [minutes] [--default|--calibrated]
 */
import { IntersectionWorld } from '../src/simulation/core/world'

const DT = 1 / 60

const numeric = process.argv.filter((a) => /^\d+$/.test(a))
const minutes = numeric.length > 0 ? Number(numeric[0]) : 5

const demand = process.argv.includes('--default')
  ? { baseRate: 0.115, peakRate: 0.29 }
  : { baseRate: 0.045, peakRate: 0.075 }

const ARMS = ['north', 'east', 'south', 'west'] as const
type Arm = (typeof ARMS)[number]

const ratios: number[] = []
let framesWithLeft = 0
let framesTotal = 0
let leftWaitSamples: number[] = []

const world = new IntersectionWorld({ seed: 7, ...demand })
const steps = Math.round(minutes * 60) / DT

for (let step = 0; step < steps; step += 1) {
  world.step(DT)
  framesTotal += 1

  const waiting: Record<Arm, number[]> = { north: [], east: [], south: [], west: [] }
  const lefts: Record<Arm, number[]> = { north: [], east: [], south: [], west: [] }

  for (const vehicle of world.vehicles) {
    const vehicleSpec = vehicle as unknown as {
      s: number
      waited: number
      movement: { turn: string; route: { stopS: number } }
      lane: { arm: Arm }
    }
    if (vehicleSpec.s < vehicleSpec.movement.route.stopS + 0.05) {
      waiting[vehicleSpec.lane.arm].push(vehicleSpec.waited)
      if (vehicleSpec.movement.turn === 'left') {
        lefts[vehicleSpec.lane.arm].push(vehicleSpec.waited)
      }
    }
  }

  const pressure = {} as Record<Arm, number>
  const leftPressure = {} as Record<Arm, number>

  for (const arm of ARMS) {
    pressure[arm] = waiting[arm].reduce((sum, w) => sum + 1 + w / 12, 0)
    leftPressure[arm] = lefts[arm].reduce((sum, w) => sum + 1 + w / 12, 0)
  }

  const worstLeft = Math.max(...ARMS.map((arm) => leftPressure[arm]))
  if (worstLeft <= 0) {
    continue
  }

  framesWithLeft += 1

  let best: Arm = 'north'
  let bestPressure = -1
  for (const arm of ARMS) {
    if (pressure[arm] > bestPressure) {
      best = arm
      bestPressure = pressure[arm]
    }
  }

  const denied = pressure[best]
  if (denied > 0) {
    ratios.push(worstLeft / denied)
  }

  const waits = ARMS.flatMap((arm) => lefts[arm])
  if (waits.length > 0) {
    leftWaitSamples.push(Math.max(...waits))
  }
}

ratios.sort((a, b) => a - b)
leftWaitSamples.sort((a, b) => a - b)

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) {
    return 0
  }
  const index = Math.min(sorted.length - 1, Math.floor(q * sorted.length))
  return sorted[index]
}

console.log(`left-share: ${minutes} min, semilla 7, ${demand.baseRate}/${demand.peakRate}`)
console.log('')
console.log(`  frames totales:                ${framesTotal}`)
console.log(`  frames con alguien esperando giro a la izquierda: ${framesWithLeft}`)
console.log(`  (${((framesWithLeft / framesTotal) * 100).toFixed(1)} % del tiempo)`)
console.log('')

if (ratios.length === 0) {
  console.log('  sin muestras: la presión negada fue siempre 0')
  process.exit(0)
}

console.log('  ratio  presión-giro / presión-negada')
console.log('  ─────────────────────────────────────')
for (const q of [0.1, 0.25, 0.5, 0.75, 0.9, 0.99]) {
  const value = quantile(ratios, q)
  console.log(
    `  p${String(Math.round(q * 100)).padStart(3)}   ${value.toFixed(3)}` +
      `   ${ratioBar(value)}`,
  )
}

console.log('')
console.log(`  mínimo ${ratios[0].toFixed(3)}   máximo ${ratios[ratios.length - 1].toFixed(3)}`)
console.log('')
console.log('  espera del girador más antiguo, en segundos')
console.log('  ────────────────────────────────────────────')
for (const q of [0.5, 0.75, 0.9, 0.99]) {
  console.log(`  p${String(Math.round(q * 100)).padStart(3)}   ${quantile(leftWaitSamples, q).toFixed(1)} s`)
}

function ratioBar(value: number): string {
  const width = Math.min(40, Math.round(value * 20))
  return `${'#'.repeat(Math.max(0, width))}${value.toFixed(3)}`
}
