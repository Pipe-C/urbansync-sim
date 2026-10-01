/**
 * The live rule, captured as it runs.
 *
 * `corner-why.ts` reconstructed `holdForBodyConflict` from the outside and got the
 * wrong answer twice, which is the point: a rule with four sequential clauses and a
 * race at the end of it cannot be debugged by re-deriving it. This reads the trace
 * that the rule itself emits (`TRACE_BODY=1`) and prints only the frames in which
 * the offending pair was actually considered, so the clause that drops it is the
 * one that gets blamed - not the one that looks wrong.
 *
 * Usage:
 *   npx tsx scripts/corner-live.ts [seed]
 */
import { IntersectionWorld, setBodyTrace } from '../src/simulation/core/world'

setBodyTrace(true)

const DT = 1 / 60
const BACK = 6 // frames of history to keep

const numeric = process.argv.filter((a) => /^\d+$/.test(a))
const seed = numeric.length > 0 ? Number(numeric[0]) : 11

/** The held movement, whose clamp line is also worth printing. */
const WATCH = { left: process.env.CORNER_WATCH ?? 'south-0:left' }

const world = new IntersectionWorld({ seed, baseRate: 0.045, peakRate: 0.075 })

interface Body {
  heading: number
  position: { x: number; z: number }
  spec: { length: number; width: number }
  movement: { id: string; turn: string }
  s: number
  v: number
  lane: { id: string; arm: string }
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
  for (const axis of [heading(a.heading), lateral(a.heading), heading(b.heading), lateral(b.heading)]) {
    const gap =
      Math.abs((b.position.x - a.position.x) * axis.x + (b.position.z - a.position.z) * axis.z)
    worst = Math.max(worst, gap - (extent(a, axis) + extent(b, axis)))
  }
  return -worst
}

const history: { t: number; lines: string[] }[] = []
let hit = -1

for (let step = 0; step < 60 * 300; step += 1) {
  world.step(DT)
  const lines = world.takeTrace()
  const t = step * DT

  const touching = (() => {
    for (let a = 0; a < world.vehicles.length; a += 1) {
      for (let b = a + 1; b < world.vehicles.length; b += 1) {
        const first = world.vehicles[a] as unknown as Body
        const second = world.vehicles[b] as unknown as Body
        const pair =
          (first.movement.id.endsWith(':left') && second.movement.id.endsWith(':right')) ||
          (second.movement.id.endsWith(':left') && first.movement.id.endsWith(':right'))
        if (pair && first.lane.arm === second.lane.arm && penetration(first, second) > 0) {
          return true
        }
      }
    }
    return false
  })()

  history.push({ t, lines })
  if (history.length > BACK) {
    history.shift()
  }

  if (touching) {
    hit = t
    break
  }
}

if (hit < 0) {
  console.log(`semilla ${seed}: sin solapamiento left x right`)
  process.exit(0)
}

console.log(`semilla ${seed} · PRIMER solape en t=${hit.toFixed(3)} s`)
console.log('')
console.log('Decisiones reales de holdForBodyConflict en los frames previos:')
console.log('')

for (const frame of history) {
  const relevant = frame.lines.filter(
    (line) =>
      (line.includes(':left') && line.includes(':right')) ||
      line.includes(`CLAMP [${WATCH.left}`),
  )
  console.log(`  t=${frame.t.toFixed(3)} s   (${relevant.length} decisiones left x right)`)
  for (const line of relevant) {
    console.log(`    ${line}`)
  }
  if (relevant.length === 0) {
    console.log('    (la regla ni siquiera llego a considerar el par)')
  }
}
