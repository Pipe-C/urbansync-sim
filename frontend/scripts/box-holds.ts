/**
 * Throwaway: are overlapping vehicles *racing* or are they *pinned*?
 *
 * The collision this exists to explain is between a left turner crawling through
 * the junction and a through vehicle at 12.5 m/s that never brakes. That reads as
 * a timing problem. But every attempt to make entry more conservative made the
 * overlaps worse — slower fleet, 18; a later arc, 14; a slower turn launch, 146 —
 * and a rule that only ever fails one way does not have that shape.
 *
 * The alternative is structural: hold points are computed from swept bodies, and
 * a swept body can put the waiting point *past* the stop line. A vehicle held
 * there is pinned in the middle of the junction, where nothing arbitrates it any
 * more, because `boxConflict` and `holdForBodyConflict` both return early once
 * `s >= stopS`. More blocking would then mean more pinned vehicles in the box,
 * which is exactly the direction the numbers went.
 *
 * So: measure the two populations directly, from public state only.
 *
 *   racing  — an overlap between vehicles that are both moving. A timing problem.
 *   pinned  — an overlap where at least one vehicle is barely moving while inside
 *             the junction. Something is holding it there.
 *
 * "Pinned inside the box" is counted independently of overlaps too, because if
 * the hypothesis is right the condition exists whether or not it happens to
 * collide on a given frame.
 *
 * Run with: npx tsx scripts/box-holds.ts [minutes] [baseRate] [peakRate]
 */

import {
  IntersectionWorld,
  type VehicleState,
} from '../src/simulation/core/index.ts'

const DT = 1 / 60
const MINUTES = Number(process.argv[2]) || 5
const baseRate = Number(process.argv[3] ?? 0.045)
const peakRate = Number(process.argv[4] ?? 0.075)

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

/** A vehicle barely moving while past its own stop line: nothing but a rule holds it. */
function pinnedInBox(v: VehicleState): boolean {
  return v.s > v.movement.route.stopS && v.v < 0.5 && !v.emergency
}

const world = new IntersectionWorld({ seed: 7, baseRate, peakRate })
const STEPS = Math.round(MINUTES * 60) / DT

let overlapFrames = 0
let racingFrames = 0
let pinnedOverlapFrames = 0
let deepest = 0
const worstPair = new Map<string, number>()

let pinnedFrames = 0
let liveFrames = 0
const pinnedPastLine = new Map<string, number>()

let pinSamples = 0
const samples: string[] = []

for (let step = 0; step < STEPS; step += 1) {
  world.step(DT)
  const aspects = world.controller.aspects()

  liveFrames += 1
  for (const vehicle of world.vehicles) {
    if (!pinnedInBox(vehicle)) continue
    pinnedFrames += 1
    const key = `${vehicle.movement.id}${vehicle.movement.turn}`
    pinnedPastLine.set(key, (pinnedPastLine.get(key) ?? 0) + 1)

    if (pinSamples < 8 && step % 600 === 0) {
      pinSamples += 1
      const over = vehicle.s - vehicle.movement.route.stopS
      samples.push(
        `  t=${(step / 60).toFixed(0).padStart(4)}s  ${vehicle.kind}#${vehicle.id} ` +
          `${vehicle.movement.id.padEnd(18)} s=${vehicle.s.toFixed(1)} ` +
          `(stopS ${vehicle.movement.route.stopS.toFixed(1)}, +${over.toFixed(1)} past it) ` +
          `v=${vehicle.v.toFixed(2)} aspect=${aspects[vehicle.lane.arm]}`,
      )
    }
  }

  let frameDepth = 0
  for (let i = 0; i < world.vehicles.length; i += 1) {
    const a = world.vehicles[i]!
    for (let j = i + 1; j < world.vehicles.length; j += 1) {
      const b = world.vehicles[j]!
      const d = penetration(a, b)
      if (d <= 0) continue

      overlapFrames += 1
      if (d > deepest) deepest = d
      const key = `${a.movement.id} x ${b.movement.id}`
      worstPair.set(key, Math.max(worstPair.get(key) ?? 0, d))

      const pinned = pinnedInBox(a) || pinnedInBox(b)
      if (pinned) pinnedOverlapFrames += 1
      else racingFrames += 1
      if (d > frameDepth) frameDepth = d
    }
  }
}

console.log(`--- ${MINUTES} simulated minutes at ${baseRate}/${peakRate} per lane ---\n`)

console.log('OVERLAP FRAMES')
console.log(`  total            ${overlapFrames}`)
console.log(`  both moving      ${racingFrames}   (${pct(racingFrames, overlapFrames)})`)
console.log(`  >=1 pinned       ${pinnedOverlapFrames}   (${pct(pinnedOverlapFrames, overlapFrames)})`)
console.log(`  deepest          ${deepest.toFixed(3)} m\n`)

console.log('  by movement pair:')
for (const [key, depth] of [...worstPair].sort((x, y) => y[1] - x[1])) {
  console.log(`    ${key.padEnd(46)} deepest ${depth.toFixed(3)} m`)
}

console.log('\nVEHICLES PINNED INSIDE THE BOX  (past their own stop line, v < 0.5)')
console.log(`  ${pinnedFrames} vehicle-frames of ${liveFrames * world.vehicles.length} total`
  + `  (${pct(pinnedFrames, liveFrames * world.vehicles.length)})`)
if (pinnedFrames === 0) {
  console.log('  none: nothing is ever held past its stop line')
}
console.log('\n  by movement:')
for (const [key, count] of [...pinnedPastLine].sort((x, y) => y[1] - x[1])) {
  console.log(`    ${key.padEnd(22)} ${String(count).padStart(6)} frames`)
}
if (samples.length > 0) {
  console.log('\n  samples:')
  for (const line of samples) console.log(line)
}

function pct(n: number, d: number): string {
  return d === 0 ? '  0.0%' : `${((n / d) * 100).toFixed(1).padStart(5)}%`
}