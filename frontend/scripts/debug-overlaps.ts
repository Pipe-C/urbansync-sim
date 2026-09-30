/**
 * Which pairs of movements are actually colliding?
 *
 * A total count says the model is wrong; a breakdown by pair says which rule is
 * missing. Same-lane pairs diverging inside the box, adjacent-lane pairs swept by
 * a long body, and opposing left turns are three different bugs that happen to
 * all show up as "overlap", and they are fixed in three different places.
 *
 * Run with: npx tsx scripts/debug-overlaps.ts
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

/** Same measure the invariant checker uses. */
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

const world = new IntersectionWorld({ seed: 7 })
const DT = 1 / 60

interface Bucket {
  count: number
  worst: number
  kinds: Set<string>
  lengths: Set<number>
  inBox: number
}

const buckets = new Map<string, Bucket>()

function classify(a: VehicleState, b: VehicleState): string {
  const sameLane = a.lane.id === b.lane.id
  const sameExit = a.movement.destination.id === b.movement.destination.id
  const sameArm = a.lane.arm === b.lane.arm
  const oppositeArm = a.lane.arm !== b.lane.arm
  if (sameLane) return 'same-lane divergence'
  if (sameExit) return 'same-exit merge'
  if (sameArm) return 'adjacent lane, same arm'
  if (oppositeArm) return 'opposite arms'
  return 'other'
}

for (let step = 0; step < 10 * 60 * 60; step += 1) {
  world.step(DT)
  for (let i = 0; i < world.vehicles.length; i += 1) {
    for (let j = i + 1; j < world.vehicles.length; j += 1) {
      const a = world.vehicles[i]
      const b = world.vehicles[j]
      if (!a || !b) continue
      const depth = penetration(a, b)
      if (depth <= 0.02) continue
      const key = `${classify(a, b)} | ${a.movement.id} ↔ ${b.movement.id}`
      const bucket = buckets.get(key) ?? {
        count: 0,
        worst: 0,
        kinds: new Set<string>(),
        lengths: new Set<number>(),
        inBox: 0,
      }
      bucket.count += 1
      bucket.worst = Math.max(bucket.worst, depth)
      bucket.kinds.add(a.kind)
      bucket.kinds.add(b.kind)
      bucket.lengths.add(Math.round(a.spec.length))
      bucket.lengths.add(Math.round(b.spec.length))
      if (a.inBox || b.inBox) bucket.inBox += 1
      buckets.set(key, bucket)
    }
  }
}

const rows = [...buckets.entries()].sort((a, b) => b[1].count - a[1].count)
let total = 0
for (const [, bucket] of rows) total += bucket.count

console.log(`overlaps by movement pair — ${total} total\n`)
for (const [key, bucket] of rows) {
  const lengths = [...bucket.lengths].sort((a, b) => a - b).join('/')
  console.log(
    `${String(bucket.count).padStart(6)}  worst ${bucket.worst.toFixed(2)}m  ` +
      `inBox ${Math.round((bucket.inBox / bucket.count) * 100)}%  ` +
      `L ${lengths.padEnd(8)} ${[...bucket.kinds].join(',').padEnd(24)} ${key}`,
  )
}

const byClass = new Map<string, number>()
for (const [key, bucket] of buckets) {
  const cls = key.split(' | ')[0] ?? 'other'
  byClass.set(cls, (byClass.get(cls) ?? 0) + bucket.count)
}
console.log('\nby class')
for (const [cls, count] of [...byClass.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cls.padEnd(26)} ${count}`)
}
console.log(`\nserved ${world.summary().served}`)
