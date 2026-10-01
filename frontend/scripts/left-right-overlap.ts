/**
 * Which seed reproduces the surviving `left x right` overlap, and what is it?
 *
 * `overlap-pairs.ts` reported `north-0:left x north-1:right` as the top surviving
 * pair, but summed across eight seeds — so the individual seed is not known from
 * it. Seed 1 does not reproduce it in four minutes. This sweeps the seeds, finds
 * one that does, and prints the geometry of the resting overlap.
 *
 * Usage:
 *   npx tsx scripts/left-right-overlap.ts [seed] [seconds] [--default|--calibrated]
 */
import { IntersectionWorld } from '../src/simulation/core/world'

const DT = 1 / 60

interface Body {
  heading: number
  position: { x: number; z: number }
  spec: { length: number; width: number; kind?: string }
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
const explicitSeed = numeric.length > 0 ? Number(numeric[0]) : null
const seconds = numeric.length > 1 ? Number(numeric[1]) : 180

const demand = process.argv.includes('--default')
  ? { baseRate: 0.115, peakRate: 0.29 }
  : { baseRate: 0.045, peakRate: 0.075 }

const SEEDS = explicitSeed !== null ? [explicitSeed] : [1, 2, 3, 4, 5, 7, 11, 13]

interface Snapshot {
  t: number
  a: Body
  b: Body
  depth: number
}

let reported = false

for (const seed of SEEDS) {
  const world = new IntersectionWorld({ seed, ...demand })
  const found: Snapshot[] = []
  const totalSteps = Math.round(seconds * 60)

  for (let step = 0; step < totalSteps; step += 1) {
    world.step(DT)

    for (let a = 0; a < world.vehicles.length; a += 1) {
      for (let b = a + 1; b < world.vehicles.length; b += 1) {
        const first = world.vehicles[a] as unknown as Body
        const second = world.vehicles[b] as unknown as Body
        const firstIsLeft = first.movement.id.endsWith(':left')
        const secondIsRight = second.movement.id.endsWith(':right')
        if (!firstIsLeft || !secondIsRight) {
          continue
        }
        // Same arm, different lane: north-0:left against north-1:right. Compare
        // the ARM, not the lane id — north-0 and north-1 are two lanes of one
        // approach, and comparing the lane ids filtered out every real case.
        if (first.lane.arm !== second.lane.arm) {
          continue
        }
        const depth = penetration(first, second)
        if (depth > 0) {
          found.push({
            t: step * DT,
            a: JSON.parse(JSON.stringify(first)),
            b: JSON.parse(JSON.stringify(second)),
            depth,
          })
        }
      }
    }

    // A couple of seconds of continuous overlap means a resting state, not a
    // single frame of contact while one vehicle is still swinging around.
    if (found.length > 0 && found[found.length - 1].t - found[0].t > 2) {
      break
    }
  }

  if (found.length === 0) {
    console.log(`  semilla ${String(seed).padStart(3)}  sin solapamiento left x right`)
    continue
  }

  if (reported) {
    continue
  }

  reported = true
  const a = found[0].a
  const b = found[0].b

  console.log('')
  console.log(`  semilla ${seed}: PRIMER solapamiento a t=${found[0].t.toFixed(2)} s`)
  console.log('')
  console.log('    vehículo    movimiento      lane     s       v    size       parada?')
  console.log('    ─────────────────────────────────────────────────────────────────────────')
  for (const [label, v] of [
    ['izq', a],
    ['der', b],
  ] as const) {
    console.log(
      `    ${label}          ${v.movement.id.padEnd(15)}${v.lane.id.padEnd(9)}` +
        `${v.s.toFixed(2).padStart(7)}${v.v.toFixed(2).padStart(7)}   ` +
        `${`${v.spec.length}x${v.spec.width}`.padEnd(11)}${v.v < 0.5 ? 'SÍ' : 'no'}`,
    )
  }
  console.log('')
  console.log(`    posiciones:  izq (${a.position.x.toFixed(2)}, ${a.position.z.toFixed(2)})`)
  console.log(`                 der (${b.position.x.toFixed(2)}, ${b.position.z.toFixed(2)})`)
  console.log(`    headings:    izq ${a.heading.toFixed(2)}  der ${b.heading.toFixed(2)} (rad)`)
  console.log(
    `    separación:  ${Math.hypot(b.position.x - a.position.x, b.position.z - a.position.z).toFixed(3)} m`,
  )
  console.log(`    esperas:     izq ${a.waited.toFixed(1)}s   der ${b.waited.toFixed(1)}s`)
  console.log('')
  console.log(`    frames con solapamiento: ${found.length}`)
  console.log(`    profundidad máxima: ${Math.max(...found.map((f) => f.depth)).toFixed(3)} m`)
  console.log(
    `    ventana: ${found[0].t.toFixed(2)}s .. ${found[found.length - 1].t.toFixed(2)}s`,
  )
}

if (!reported) {
  console.log('\nninguna semilla reproduce el par left x right')
}
