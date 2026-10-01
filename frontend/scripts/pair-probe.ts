/**
 * The two vehicles in one conflicting pair, at the moment they touch.
 *
 * `overlap-pairs` names the pair and counts the frames; this answers what the
 * two vehicles are actually doing when it happens. Oriented-rectangle overlap by
 * the separating-axis test, which is the same measure the pair scripts use, so
 * the frame it reports is the frame they report.
 *
 * Usage: npx tsx scripts/pair-probe.ts [seed] [movementA] [movementB]
 */
import { IntersectionWorld } from '../src/simulation/core/world'

const DT = 1 / 60
const args = process.argv.slice(2)
const seed = Number(args[0] ?? 6)
const a = args[1] ?? 'north-0:through'
const b = args[2] ?? 'north-1:right'

interface Rect {
  x: number
  z: number
  halfLength: number
  halfWidth: number
  heading: number
}

function rect(x: number, z: number, length: number, width: number, heading: number): Rect {
  return { x, z, halfLength: length / 2, halfWidth: width / 2, heading }
}

function axes(r: Rect): { x: number; z: number }[] {
  const f = { x: Math.sin(r.heading), z: Math.cos(r.heading) }
  const s = { x: Math.cos(r.heading), z: -Math.sin(r.heading) }
  return [f, s]
}

function reach(r: Rect, axis: { x: number; z: number }): number {
  const f = { x: Math.sin(r.heading), z: Math.cos(r.heading) }
  const s = { x: Math.cos(r.heading), z: -Math.sin(r.heading) }
  return (
    r.halfLength * Math.abs(f.x * axis.x + f.z * axis.z) +
    r.halfWidth * Math.abs(s.x * axis.x + s.z * axis.z)
  )
}

/** Separating-axis overlap depth, 0 when the rectangles are apart. */
function penetration(p: Rect, q: Rect): number {
  const dx = q.x - p.x
  const dz = q.z - p.z
  let depth = Infinity
  for (const axis of [...axes(p), ...axes(q)]) {
    const overlap = reach(p, axis) + reach(q, axis) - Math.abs(dx * axis.x + dz * axis.z)
    if (overlap <= 0) {
      return 0
    }
    depth = Math.min(depth, overlap)
  }
  return depth
}

const world = new IntersectionWorld({ seed, baseRate: 0.045, peakRate: 0.075 })

function describe(label: string, m: string): string {
  const vehicle = world.vehicles.find((candidate) => candidate.movement.id === m)
  if (!vehicle) {
    return `${label}: (ninguno)`
  }
  const route = vehicle.movement.route
  const delta = vehicle.s - route.stopS
  const where =
    delta <= 0.05
      ? 'EN su linea'
      : vehicle.s - vehicle.spec.length < route.exitS
        ? 'DENTRO de la caja'
        : 'saliendo'
  return (
    `${label}: #${vehicle.id} ${vehicle.kind} s=${vehicle.s.toFixed(2)} v=${vehicle.v.toFixed(2)}` +
    ` linea=${route.stopS.toFixed(2)} (${delta >= 0 ? '+' : ''}${delta.toFixed(2)}) ${where}` +
    ` inBox=${vehicle.inBox}`
  )
}

let worst = 0
let worstStep = -1

interface Snapshot {
  id: number
  kind: string
  s: number
  v: number
  length: number
  width: number
  stopS: number
  exitS: number
  x: number
  z: number
  heading: number
  inBox: boolean
}

function snapshot(vehicle: {
  id: number
  kind: string
  s: number
  v: number
  position: { x: number; z: number }
  heading: number
  spec: { length: number; width: number }
  inBox: boolean
  movement: { route: { stopS: number; exitS: number } }
}): Snapshot {
  return {
    id: vehicle.id,
    kind: vehicle.kind,
    s: vehicle.s,
    v: vehicle.v,
    length: vehicle.spec.length,
    width: vehicle.spec.width,
    stopS: vehicle.movement.route.stopS,
    exitS: vehicle.movement.route.exitS,
    x: vehicle.position.x,
    z: vehicle.position.z,
    heading: vehicle.heading,
    inBox: vehicle.inBox,
  }
}

let worstPair: Snapshot | null = null
let worstOther: Snapshot | null = null

for (let step = 0; step < 60 * 300; step += 1) {
  world.step(DT)
  const pa = world.vehicles.filter((v) => v.movement.id === a)
  const pb = world.vehicles.filter((v) => v.movement.id === b)
  for (const va of pa) {
    for (const vb of pb) {
      const depth = penetration(
        rect(va.position.x, va.position.z, va.spec.length, va.spec.width, va.heading),
        rect(vb.position.x, vb.position.z, vb.spec.length, vb.spec.width, vb.heading),
      )
      if (depth > worst) {
        worst = depth
        worstStep = step
        // Copy the numbers, not the vehicle: the loop runs on after this frame and
        // a recycled vehicle's `position` is read-only in the here-and-now, so a
        // stored reference prints wherever it ended up rather than where it was.
        worstPair = snapshot(va)
        worstOther = snapshot(vb)
      }
    }
  }
}

if (worst > 0) {
  console.log(`semilla ${seed} - peor solape ${worst.toFixed(3)} m - t=${(worstStep * DT).toFixed(3)} s`)
  for (const [label, v] of [
    ['A', worstPair],
    ['B', worstOther],
  ] as const) {
    if (!v) continue
    console.log(
      `  ${label}: #${v.id} ${v.kind} L=${v.length} W=${v.width}` +
        ` s=${v.s.toFixed(2)} v=${v.v.toFixed(2)} linea=${v.stopS.toFixed(2)} salida=${v.exitS.toFixed(2)}` +
        ` pos=(${v.x.toFixed(2)}, ${v.z.toFixed(2)}) rumbo=${v.heading.toFixed(3)} inBox=${v.inBox}`,
    )
  }
} else {
  console.log('sin solape en 300 s')
}