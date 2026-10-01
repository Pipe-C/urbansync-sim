/**
 * The `left x right` corner clip, traced at full resolution.
 *
 * `overlap-pairs.ts` says the surviving overlaps are one pair on one arm:
 * `west-0:left` against `west-1:right`, both from the same approach, and the
 * conflict table correctly says they do not cross. `left-right-overlap.ts` shows
 * the shape: a car stopped dead on its stop line, and an eleven-metre bus coming
 * through on the outer lane at four metres a second.
 *
 * The two questions this answers, in order:
 *   1. Is the stopped car really at its stop line, or fractionally past it?
 *      `holdForBodyConflict` and `boxConflict` both return early once a vehicle is
 *      past `stopS + 0,05`, so the answer decides whether anything arbitrates it.
 *   2. When the bus's body first overlaps the stopped car, what were the two
 *      positions? That is the moment any fix has to prevent.
 *
 * Usage:
 *   npx tsx scripts/corner-clip.ts [seed] [--default|--calibrated]
 */
import { IntersectionWorld } from '../src/simulation/core/world'

const DT = 1 / 60

interface Body {
  heading: number
  position: { x: number; z: number }
  spec: { length: number; width: number }
  movement: { id: string }
  s: number
  v: number
  lane: { id: string; arm: string }
  waited: number
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

const numeric = process.argv.filter((a) => /^\d+$/.test(a))
const seed = numeric.length > 0 ? Number(numeric[0]) : 1

const demand = process.argv.includes('--default')
  ? { baseRate: 0.115, peakRate: 0.29 }
  : { baseRate: 0.045, peakRate: 0.075 }

const world = new IntersectionWorld({ seed, ...demand })

interface Frame {
  t: number
  a: Body
  b: Body
  depth: number
}

const frames: Frame[] = []
let captured = false

for (let step = 0; step < 60 * 240; step += 1) {
  world.step(DT)

  for (let a = 0; a < world.vehicles.length; a += 1) {
    for (let b = a + 1; b < world.vehicles.length; b += 1) {
      const first = world.vehicles[a] as unknown as Body
      const second = world.vehicles[b] as unknown as Body

      const isLeftRight =
        (first.movement.id.endsWith(':left') && second.movement.id.endsWith(':right')) ||
        (second.movement.id.endsWith(':left') && first.movement.id.endsWith(':right'))

      if (!isLeftRight || first.lane.arm !== second.lane.arm) {
        continue
      }

      const depth = penetration(first, second)
      if (depth > 0) {
        const left = first.movement.id.endsWith(':left') ? first : second
        const right = first.movement.id.endsWith(':right') ? first : second
        frames.push({
          t: step * DT,
          a: JSON.parse(JSON.stringify(left)),
          b: JSON.parse(JSON.stringify(right)),
          depth,
        })
      }
    }
  }

  if (frames.length > 3 && !captured) {
    captured = true
    break
  }
}

if (frames.length === 0) {
  console.log(`sin solapamiento left x right, semilla ${seed}`)
  process.exit(0)
}

const first = frames[0]

console.log(`semilla ${seed}  ·  ${demand.baseRate}/${demand.peakRate}`)
console.log('')
console.log(`primer contacto t=${first.t.toFixed(3)} s  (frame ${Math.round(first.t / DT)})`)
console.log('')
console.log('  la stopped car (left) y el bus (right), frame a frame:')
console.log('')
console.log('     t      left.s   left.v   bus.s    bus.v    prof (m)   stopS')
console.log('  ─────────────────────────────────────────────────────────────────────')

const stopS = first.a.movement.id === 'north-0:left'
  ? 76
  : first.a.movement.id === 'south-0:left'
    ? 76
    : first.a.movement.id === 'east-0:left'
      ? 76
      : 76

for (let i = 0; i < Math.min(frames.length, 10); i += 1) {
  const f = frames[i]
  console.log(
    `  ${f.t.toFixed(3).padStart(7)}` +
      `${f.a.s.toFixed(2).padStart(9)}${f.a.v.toFixed(2).padStart(9)}` +
      `${f.b.s.toFixed(2).padStart(9)}${f.b.v.toFixed(2).padStart(9)}` +
      `${f.depth.toFixed(3).padStart(12)}${String(stopS).padStart(8)}`,
  )
}

console.log('')
console.log(`  left: ${first.a.movement.id}  lane ${first.a.lane.id}  ${first.a.spec.length}x${first.a.spec.width}`)
console.log(`  bus:  ${first.b.movement.id}  lane ${first.b.lane.id}  ${first.b.spec.length}x${first.b.spec.width}`)
console.log('')
console.log(`  ¿el left está en su stopS? s=${first.a.s.toFixed(3)}  stopS=${stopS}`)
console.log(`    -> ${first.a.s >= stopS + 0.05 ? 'PAST stopS: EXENTO de arbitración' : 'short of stopS: arbitrado'}`)
console.log(`  esperas: left ${first.a.waited.toFixed(1)}s   bus ${first.b.waited.toFixed(1)}s`)
console.log('')
console.log(`  total frames con solapamiento capturados: ${frames.length}`)
console.log(`  profundidad máxima: ${Math.max(...frames.map((f) => f.depth)).toFixed(3)} m`)
