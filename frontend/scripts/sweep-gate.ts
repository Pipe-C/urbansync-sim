/**
 * The offending pair, backwards, with the arbitration state on each frame.
 *
 * `CONTINUIDAD.md` §3.5 established that `holdForBodyConflict` computes the right
 * hold point and that the point reaches the clamp. The clamp cannot use it,
 * because the held vehicle is already past it. So the question this answers is the
 * other one: on the frames *before* the contact, was the sweeping vehicle still
 * somewhere it could have been held?
 *
 * A sweeper counts as "still holdable" when it is at its own stop line, it is the
 * head of its queue, and its movement has a green — that is, when the only thing
 * standing between it and the junction is `mayRelease`, which is a decision this
 * model gets to make. A right-turner queued behind another right-turner does not
 * count: nothing was ever going to be released.
 *
 * Usage: npx tsx scripts/sweep-gate.ts [seed] [secondsOfHistory]
 */
import { IntersectionWorld, bodyBandBetween } from '../src/simulation/core/world'
import type { VehicleKind } from '../src/simulation/core/fleet'

const DT = 1 / 60
const numeric = process.argv.filter((a) => /^\d+$/.test(a))
const seed = numeric.length > 0 ? Number(numeric[0]) : 11
const history = numeric.length > 1 ? Number(numeric[1]) : 5

const world = new IntersectionWorld({ seed, baseRate: 0.045, peakRate: 0.075 })

interface Body {
  id: number
  kind: VehicleKind
  heading: number
  position: { x: number; z: number }
  spec: { length: number; width: number }
  movement: { id: string; turn: string; route: { stopS: number } }
  s: number
  v: number
  lane: { arm: string; id: string }
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

interface Snap {
  s: number
  v: number
  head: boolean
  atLine: boolean
  inBand: boolean
}

const ring: { t: number; snap: Map<number, Snap> }[] = []
let hit = -1
let hitPair: [number, number] = [0, 0]

for (let step = 0; step < 60 * 300; step += 1) {
  world.step(DT)
  const t = step * DT
  const aspects = world.controller.aspects()
  const snap = new Map<number, Snap>()

  for (const raw of world.vehicles) {
    const vehicle = raw as unknown as Body
    const stopS = vehicle.movement.route.stopS
    // Head of its queue: nothing of the same movement ahead of it on the shared
    // stretch, and nothing of the same lane ahead of it at all.
    let head = true
    for (const otherRaw of world.vehicles) {
      const other = otherRaw as unknown as Body
      if (other === raw) {
        continue
      }
      const sameRoute = other.movement.id === vehicle.movement.id
      const sameLane = other.lane.id === vehicle.lane.id
      if (!sameRoute && !sameLane) {
        continue
      }
      if (sameRoute ? other.s > vehicle.s : other.s - other.spec.length > vehicle.s) {
        head = false
        break
      }
    }
    snap.set(vehicle.id, {
      s: vehicle.s,
      v: vehicle.v,
      head,
      atLine: vehicle.s > stopS - 1.2 && vehicle.s <= stopS + 0.05,
      inBand: false,
      // A right-turner answers to its own arm's aspect; a left-turner may be
      // waiting for an arrow that is not up.
      green: aspects[vehicle.lane.arm] === 'green',
      stopS,
    } as Snap & { green: boolean; stopS: number })
  }

  // Which left-turner is standing inside which right-turner's swept band.
  for (const rawSweep of world.vehicles) {
    const sweep = rawSweep as unknown as Body
    if (!sweep.movement.id.endsWith(':right')) {
      continue
    }
    for (const rawHeld of world.vehicles) {
      const held = rawHeld as unknown as Body
      if (held === sweep || !held.movement.id.endsWith(':left') || held.lane.arm !== sweep.lane.arm) {
        continue
      }
      const swept = bodyBandBetween(held.movement.id, held.kind, sweep.movement.id, sweep.kind).a
      if (!swept) {
        continue
      }
      const entry = snap.get(held.id)
      if (entry && held.s >= swept.start && held.s <= swept.end) {
        entry.inBand = true
      }
    }
  }

  ring.push({ t, snap })
  if (ring.length > history * 60) {
    ring.shift()
  }

  for (let a = 0; a < world.vehicles.length; a += 1) {
    for (let b = a + 1; b < world.vehicles.length; b += 1) {
      const first = world.vehicles[a] as unknown as Body
      const second = world.vehicles[b] as unknown as Body
      if (penetration(first, second) <= 0) {
        continue
      }
      const pair =
        (first.movement.id.endsWith(':left') && second.movement.id.endsWith(':right')) ||
        (second.movement.id.endsWith(':left') && first.movement.id.endsWith(':right'))
      if (pair && first.lane.arm === second.lane.arm) {
        hit = t
        hitPair = [first.id, second.id]
        break
      }
    }
    if (hit >= 0) {
      break
    }
  }
  if (hit >= 0) {
    break
  }
}

const role = (id: number): 'held' | 'sweep' => {
  for (const frame of ring) {
    void frame
    break
  }
  return 'held'
}
void role

if (hit < 0) {
  console.log(`semilla ${seed}: sin solape left x right`)
  process.exit(0)
}

const kinds = new Map<number, string>()
for (const vehicle of world.vehicles) {
  kinds.set(vehicle.id, `${vehicle.kind}/${vehicle.movement.id}`)
}

console.log(`semilla ${seed} · primer solape t=${hit.toFixed(3)} s`)
console.log(`par: #${hitPair[0]} ${kinds.get(hitPair[0]) ?? '?'}  x  #${hitPair[1]} ${kinds.get(hitPair[1]) ?? '?'}`)
console.log('')
console.log('  t        held: s / v / dentro de la banda   sweep: s / v / en su linea / cabeza / verde')
console.log('  ' + '-'.repeat(88))

let holdable = 0
for (const frame of ring) {
  const held = frame.snap.get(hitPair[0])
  const sweep = frame.snap.get(hitPair[1])
  if (!held || !sweep) {
    continue
  }
  const holdableNow = sweep.atLine && sweep.head && (sweep as unknown as { green: boolean }).green
  if (holdableNow) {
    holdable += 1
  }
  console.log(
    `  ${frame.t.toFixed(3)}   ${held.s.toFixed(2).padStart(6)} ${held.v.toFixed(2).padStart(5)}` +
      `  ${held.inBand ? ' SI' : ' no'}                 ` +
      `${sweep.s.toFixed(2).padStart(6)} ${sweep.v.toFixed(2).padStart(5)}` +
      `   ${sweep.atLine ? 'si' : ' no'}      ${sweep.head ? 'si' : ' no'}      ` +
      `${(sweep as unknown as { green: boolean }).green ? 'si' : ' no'}` +
      `${holdableNow ? '   <<< ARBITRABLE' : ''}`,
  )
}
console.log('')
console.log(`frames en los que el barreador era ARBITRABLE (en su linea, cabeza de cola, verde): ${holdable}`)
