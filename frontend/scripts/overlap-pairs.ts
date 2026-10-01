/**
 * Which movement pairs still overlap, and are the vehicles moving?
 *
 * `overlap-seeds.ts` says there are overlaps and `CONTINUIDAD.md` says why the
 * left-turn pair used to be the culprit, but naming the surviving pairs is the
 * only way to know whether the protected left actually fixed its own conflict or
 * just moved the problem somewhere else.
 *
 * Usage:
 *   npx tsx scripts/overlap-pairs.ts [minutes] [--default] [--calibrated]
 */
import { IntersectionWorld, conflictTableFor } from '../src/simulation/core/world'

const DT = 1 / 60
const SEEDS = [1, 2, 3, 4, 5, 7, 11, 13]

const DEMANDS = {
  default: { baseRate: 0.115, peakRate: 0.29 },
  calibrated: { baseRate: 0.045, peakRate: 0.075 },
} as const

interface Body {
  heading: number
  position: { x: number; z: number }
  spec: { length: number; width: number }
  movement: { id: string }
  v: number
}

function heading(a: number) {
  return { x: Math.sin(a), z: Math.cos(a) }
}
function lateral(a: number) {
  return { x: Math.cos(a), z: -Math.sin(a) }
}
function extent(b: Body, axis: { x: number; z: number }): number {
  const f = heading(b.heading)
  const s = lateral(b.heading)
  return (
    (b.spec.length / 2) * Math.abs(f.x * axis.x + f.z * axis.z) +
    (b.spec.width / 2) * Math.abs(s.x * axis.x + s.z * axis.z)
  )
}
function penetration(a: Body, b: Body): number {
  let worst = -Infinity
  for (const axis of [
    heading(a.heading),
    lateral(a.heading),
    heading(b.heading),
    lateral(b.heading),
  ]) {
    const gap =
      Math.abs((b.position.x - a.position.x) * axis.x + (b.position.z - a.position.z) * axis.z)
    worst = Math.max(worst, gap - (extent(a, axis) + extent(b, axis)))
  }
  return -worst
}

const minutesArg = process.argv.find((arg) => /^\d/.test(arg))
const minutes = minutesArg ? Number(minutesArg) : 5
const which = process.argv.includes('--default')
  ? (['default'] as const)
  : process.argv.includes('--calibrated')
    ? (['calibrated'] as const)
    : (['default', 'calibrated'] as const)

for (const name of which) {
  const steps = Math.round(minutes * 60) / DT
  const pairs = new Map<string, { count: number; worst: number; moving: number }>()
  let total = 0

  for (const seed of SEEDS) {
    const world = new IntersectionWorld({ seed, ...DEMANDS[name] })

    for (let i = 0; i < steps; i += 1) {
      world.step(DT)

      for (let a = 0; a < world.vehicles.length; a += 1) {
        for (let b = a + 1; b < world.vehicles.length; b += 1) {
          const first = world.vehicles[a] as unknown as Body
          const second = world.vehicles[b] as unknown as Body
          const depth = penetration(first, second)
          if (depth <= 0) {
            continue
          }
          total += 1
          const key = [first.movement.id, second.movement.id].sort().join('  x  ')
          const entry = pairs.get(key) ?? { count: 0, worst: 0, moving: 0 }
          entry.count += 1
          entry.worst = Math.max(entry.worst, depth)
          if (first.v > 0.5 && second.v > 0.5) {
            entry.moving += 1
          }
          pairs.set(key, entry)
        }
      }
    }
  }

  console.log(`\n=== ${name}, ${minutes} min, ${SEEDS.length} semillas ===`)
  console.log(`total solapamientos: ${total}`)
  console.log('par de movimientos                          frames  peor    ambos en marcha')
  console.log('─'.repeat(92))

  for (const [key, entry] of [...pairs.entries()].sort((a, b) => b[1].count - a[1].count)) {
    const moves = `${entry.moving}/${entry.count}`
    console.log(
      `${key.padEnd(44)}${String(entry.count).padStart(6)}${entry.worst
        .toFixed(3)
        .padStart(8)}${moves.padStart(16)}`,
    )
    const [a, b] = key.split('  x  ')
    console.log(
      `${''.padEnd(44)}  ¿tabla de conflictos dice que se cruzan? ${
        b in conflictTableFor(a) ? 'SI' : 'NO'
      }`,
    )
  }
}
