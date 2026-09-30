/**
 * Frame-by-frame trace of the two vehicles that actually collide.
 *
 * The overlap reports say *which* pairs collide and how deeply. This says what
 * those two particular vehicles were doing when they did, which is the only way to
 * tell a rule that is missing from a rule that fired too late — and it is the
 * only way to see the difference between "the follower had no leader" and "the
 * leader arrived late", which look identical in a count.
 *
 * Snapshots rather than references: the world mutates its vehicle objects in
 * place, so a buffered frame holding the object prints the state at the end of
 * the run and tells you nothing.
 *
 * Run with: npx tsx scripts/debug-trace.ts [movementA] [movementB] [secondsBefore]
 */

import { IntersectionWorld, type VehicleState } from '../src/simulation/core/index.ts'

function headingAxis(heading: number) {
  return { x: Math.sin(heading), z: Math.cos(heading) }
}

function lateralAxis(heading: number) {
  return { x: Math.cos(heading), z: -Math.sin(heading) }
}

function extent(vehicle: VehicleState, axis: { x: number; z: number }): number {
  const forward = headingAxis(vehicle.heading)
  const lateral = lateralAxis(vehicle.heading)
  return (
    (vehicle.spec.length / 2) * Math.abs(forward.x * axis.x + forward.z * axis.z) +
    (vehicle.spec.width / 2) * Math.abs(lateral.x * axis.x + lateral.z * axis.z)
  )
}

function penetration(a: VehicleState, b: VehicleState): number {
  const axes = [a, b].flatMap((box) => [headingAxis(box.heading), lateralAxis(box.heading)])
  let separation = -Infinity
  for (const axis of axes) {
    const gap =
      Math.abs((b.position.x - a.position.x) * axis.x + (b.position.z - a.position.z) * axis.z) -
      (extent(a, axis) + extent(b, axis))
    separation = Math.max(separation, gap)
  }
  return -separation
}

interface Snap {
  kind: string
  id: number
  length: number
  s: number
  stopS: number
  exitS: number
  v: number
  inBox: boolean
  heading: number
  x: number
  z: number
}

function snap(vehicle: VehicleState): Snap {
  return {
    kind: vehicle.kind,
    id: vehicle.id,
    length: vehicle.spec.length,
    s: vehicle.s,
    stopS: vehicle.movement.route.stopS,
    exitS: vehicle.movement.route.exitS,
    v: vehicle.v,
    inBox: vehicle.inBox,
    heading: vehicle.heading,
    x: vehicle.position.x,
    z: vehicle.position.z,
  }
}

function describe(vehicle: Snap | null): string {
  if (!vehicle) {
    return `${'-'.repeat(52)}`
  }
  return (
    `${vehicle.kind}#${String(vehicle.id).padEnd(3)} L=${vehicle.length.toFixed(1).padStart(4)} ` +
    `s=${vehicle.s.toFixed(2).padStart(6)}/${vehicle.stopS.toFixed(1)} v=${vehicle.v.toFixed(2).padStart(5)} ` +
    `exit=${vehicle.exitS.toFixed(0).padStart(3)} box=${vehicle.inBox ? 1 : 0} hdg=${vehicle.heading.toFixed(2).padStart(5)}`
  )
}

const first = process.argv[2] ?? 'north-0:through'
const second = process.argv[3] ?? 'north-1:right'
const lead = Math.round(Number(process.argv[4] ?? 3) * 60)

const world = new IntersectionWorld({ seed: 7 })
const DT = 1 / 60

interface Frame {
  step: number
  a: Snap | null
  b: Snap | null
  depth: number
}

const ring: Frame[] = []
let found = false

for (let step = 0; step < 10 * 60 * 60; step += 1) {
  world.step(DT)

  const aLive = world.vehicles.filter((v) => v.movement.id === first)
  const bLive = world.vehicles.filter((v) => v.movement.id === second)

  let depth = 0
  let pairA: VehicleState | null = null
  let pairB: VehicleState | null = null
  for (const a of aLive) {
    for (const b of bLive) {
      const d = penetration(a, b)
      if (d > depth) {
        depth = d
        pairA = a
        pairB = b
      }
    }
  }

  ring.push({
    step,
    a: pairA ? snap(pairA) : (aLive[0] ? snap(aLive[0]) : null),
    b: pairB ? snap(pairB) : (bLive[0] ? snap(bLive[0]) : null),
    depth,
  })
  if (ring.length > lead + 1) {
    ring.shift()
  }

  if (!found && depth > 0.02) {
    found = true
    const tail = 120
    console.log(
      `\nfirst contact: ${first} x ${second} at t=${(step / 60).toFixed(2)}s  pen=${depth.toFixed(3)}m`,
    )
    for (const frame of ring) {
      const mark = frame.depth > 0.02 ? '  <<< OVERLAP' : ''
      console.log(
        `t=${(frame.step / 60).toFixed(2)}  ${describe(frame.a)}  |  ${describe(frame.b)}  ` +
          `pen=${frame.depth.toFixed(3)}${mark}`,
      )
    }
    void tail
    break
  }
}

if (!found) {
  console.log(`no contact between ${first} and ${second} in 10 minutes`)
}
