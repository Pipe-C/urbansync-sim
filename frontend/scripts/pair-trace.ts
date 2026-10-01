/**
 * Throwaway: the seconds before two vehicles touch, and nothing else.
 *
 * `debug-trace` keeps the *deepest* overlapping pair on each frame, so on a road
 * with ordinary traffic its history is a stream of unrelated vehicles and the two
 * that actually met are only present on the frame of contact. Following two ids
 * instead of two movement ids is the only way to see the approach: which one was
 * held, where, at what speed, and on whose authority it was let go.
 *
 * Snapshots, not references — the world mutates vehicle objects in place, so a
 * buffered frame that holds the object prints its state at the end of the run and
 * tells you nothing at all.
 *
 * The demand arguments are not optional in practice. At the committed defaults the
 * junction is two to five times over capacity and never reaches the state this
 * script exists to show: it gridlocks instead. The collision needs demand near the
 * junction's measured saturation of roughly 0.5 veh/s, which is what 0.045 and
 * 0.075 per lane ask for.
 *
 * Run with: npx tsx scripts/pair-trace.ts [idA] [idB] [secondsBefore] [baseRate] [peakRate]
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
  id: number
  kind: string
  length: number
  s: number
  stopS: number
  exitS: number
  v: number
  x: number
  z: number
  heading: number
  inBox: boolean
  aspect: string
}

function snap(vehicle: VehicleState | null, aspect: string): Snap | null {
  if (!vehicle) return null
  return {
    id: vehicle.id,
    kind: vehicle.kind,
    length: vehicle.spec.length,
    s: vehicle.s,
    stopS: vehicle.movement.route.stopS,
    exitS: vehicle.movement.route.exitS,
    v: vehicle.v,
    x: vehicle.position.x,
    z: vehicle.position.z,
    heading: vehicle.heading,
    inBox: vehicle.inBox,
    aspect,
  }
}

function cell(v: Snap | null): string {
  if (!v) return '  --- gone ---'.padEnd(38)
  return (
    `#${String(v.id).padStart(2)} ${v.kind.padEnd(9)}` +
    ` s=${v.s.toFixed(2).padStart(6)}/${v.stopS.toFixed(0)}` +
    ` v=${v.v.toFixed(2).padStart(5)}` +
    ` x=${v.x.toFixed(2).padStart(6)} z=${v.z.toFixed(2).padStart(6)}` +
    ` ${v.inBox ? 'box' : '   '} ${v.aspect.padEnd(5)}`
  )
}

const idA = Number(process.argv[2] ?? 40)
const idB = Number(process.argv[3] ?? 70)
const before = Math.round(Number(process.argv[4] ?? 6) * 60)
const baseRate = Number(process.argv[5] ?? 0.045)
const peakRate = Number(process.argv[6] ?? 0.075)

const DT = 1 / 60
const world = new IntersectionWorld({ seed: 7, baseRate, peakRate })

interface Frame {
  t: number
  a: Snap | null
  b: Snap | null
  pen: number
}

const ring: Frame[] = []
let found = false

for (let step = 0; step < 10 * 60 * 60; step += 1) {
  world.step(DT)
  const aspects = world.controller.aspects()

  const liveA = world.vehicles.find((v) => v.id === idA) ?? null
  const liveB = world.vehicles.find((v) => v.id === idB) ?? null
  const pen = liveA && liveB ? penetration(liveA, liveB) : 0

  ring.push({
    t: step / 60,
    a: snap(liveA, liveA ? aspects[liveA.lane.arm] : '-'),
    b: snap(liveB, liveB ? aspects[liveB.lane.arm] : '-'),
    pen,
  })
  if (ring.length > before + 1) ring.shift()

  if (!found && pen > 0) {
    found = true
    const contact = step / 60
    console.log(`first contact #${idA} x #${idB} at t=${contact.toFixed(2)}s  pen=${pen.toFixed(3)}m\n`)
    for (const f of ring) {
      console.log(
        `${f.t.toFixed(2).padStart(7)}  ${cell(f.a)} | ${cell(f.b)} ${f.pen.toFixed(2).padStart(7)}${f.pen > 0 ? '  <<<' : ''}`,
      )
    }
    break
  }
}

if (!found) {
  console.log(
    `#${idA} and #${idB} never touched in 10 minutes at ${baseRate}/${peakRate} per lane` +
      (baseRate === 0.115 ? ' — that is the committed default, which gridlocks before this state exists' : ''),
  )
}