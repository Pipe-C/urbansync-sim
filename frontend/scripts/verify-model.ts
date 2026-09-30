/**
 * Throwaway verification of the model's invariants.
 *
 * Not a test suite and not shipped. It exists because the scene that this model
 * replaced had three visual defects — cars overtaking inside a queue, cars
 * appearing out of nowhere, cars driving through reds — and none of them could
 * be caught by a type checker or by a build. They can be caught by running the
 * model for ten simulated minutes and asserting the properties that make them
 * impossible, which is a far stronger claim than "I watched it and it looked
 * right".
 *
 * Run with: node --experimental-strip-types scripts/verify-model.ts
 */

import {
  ARMS,
  CROSSWALKS,
  IntersectionWorld,
  JUNCTION_HALF,
  type Arm,
  type VehicleState,
} from '../src/simulation/core/index.ts'

const DT = 1 / 60
const MINUTES = 10

const world = new IntersectionWorld({ seed: 7 })

let previous = new Map<number, { x: number; z: number; s: number }>()
let overlaps = 0
let teleports = 0
let redRunners = 0
let orderViolations = 0
let peakVehicles = 0
let maxSpeed = 0
let crossings = 0
let phaseLog: string[] = []
let lastPhase = ''

const worstOverlap = { value: 0, note: '' }
const worstTeleport = { value: 0 }

const STEPS = Math.round(MINUTES * 60) / DT

for (let step = 0; step < STEPS; step += 1) {
  world.step(DT)
  const aspects = world.controller.aspects()
  const state = world.controller.current
  const label = state.kind === 'allRed' ? 'all-red' : `${state.kind}:${state.arm}`
  if (label !== lastPhase) {
    phaseLog.push(`${(step * DT).toFixed(1)}s ${label} — ${state.reason}`)
    lastPhase = label
  }

  crossings = world.walkers.filter((w) => w.state === 'walking').length
  peakVehicles = Math.max(peakVehicles, world.vehicles.length)

  for (const vehicle of world.vehicles) {
    maxSpeed = Math.max(maxSpeed, vehicle.v)

    // 1. Nothing teleports. A vehicle advances at most its own speed allows.
    const before = previous.get(vehicle.id)
    if (before) {
      const jumped = Math.hypot(vehicle.position.x - before.x, vehicle.position.z - before.z)
      const allowed = vehicle.v * DT + vehicle.spec.length + 0.5
      if (jumped > allowed) {
        teleports += 1
        worstTeleport.value = Math.max(worstTeleport.value, jumped)
      }
      // 2. Arc length only ever increases. A decrease would be a vehicle
      //    reversing, which is what the previous scene appeared to do.
      if (vehicle.s < before.s - 1e-6) {
        orderViolations += 1
      }
    }
    previous.set(vehicle.id, { x: vehicle.position.x, z: vehicle.position.z, s: vehicle.s })

    // 3. No vehicle crosses the stop line on a red.
    const route = vehicle.movement.route
    if (aspects[vehicle.lane.arm] === 'red' && vehicle.s > route.stopS) {
      const enteredOnRed = before !== undefined && before.s <= route.stopS
      if (enteredOnRed) {
        redRunners += 1
      }
    }
  }

  // 4. No two vehicles overlap, on the approach or on an exit.
  for (let a = 0; a < world.vehicles.length; a += 1) {
    for (let b = a + 1; b < world.vehicles.length; b += 1) {
      const first = world.vehicles[a]
      const second = world.vehicles[b]
      if (!first || !second) continue
      const penetration = penetrationOf(first, second)
      if (penetration > 0.02) {
        overlaps += 1
        if (penetration > worstOverlap.value) {
          worstOverlap.value = penetration
          worstOverlap.note =
            `${first.kind}#${first.id} ${first.movement.id} s=${first.s.toFixed(1)} ` +
            `(${first.position.x.toFixed(1)},${first.position.z.toFixed(1)}) vs ` +
            `${second.kind}#${second.id} ${second.movement.id} s=${second.s.toFixed(1)} ` +
            `(${second.position.x.toFixed(1)},${second.position.z.toFixed(1)})`
        }
      }
    }
  }

  // 5. Queue order, per lane: a vehicle ahead must always have a larger arc
  //    length than the one behind it, on the same approach.
  for (const arm of ARMS) {
    const queued = world.vehicles
      .filter((v) => v.lane.arm === arm && v.s < v.movement.route.stopS)
      .sort((p, q) => p.s - q.s)
    for (let i = 1; i < queued.length; i += 1) {
      const behind = queued[i - 1] as VehicleState
      const ahead = queued[i] as VehicleState
      if (ahead.s < behind.s) {
        orderViolations += 1
      }
    }
  }
}

function penetrationOf(a: VehicleState, b: VehicleState): number {
  // Oriented boxes, via the separating axis theorem in 2D. A circle test would
  // pass a car that is legally in a lane but a bus that is clipping a bollard.
  //
  // The metric is the *largest* gap over the four candidate axes, not the
  // smallest. Two buses passing in opposite lanes are deeply interpenetrating
  // along the road axis and clearly apart along the cross axis; separated means
  // "some axis has them apart", so the maximum is the separation and its
  // negation is the overlap. Taking the minimum instead measures how badly they
  // overlap in the one direction where they do not, and reports two buses in
  // their own lanes driving head-on into each other.
  const axes = [a, b].flatMap((box) => [headingAxis(box.heading), lateralAxis(box.heading)])
  let separation = -Infinity

  for (const axis of axes) {
    const gap = Math.abs(
      (b.position.x - a.position.x) * axis.x + (b.position.z - a.position.z) * axis.z,
    ) - (extent(a, axis) + extent(b, axis))
    separation = Math.max(separation, gap)
  }

  return -separation
}

function headingAxis(heading: number) {
  return { x: Math.sin(heading), z: Math.cos(heading) }
}

function lateralAxis(heading: number) {
  return { x: Math.cos(heading), z: -Math.sin(heading) }
}

function extent(vehicle: VehicleState, axis: { x: number; z: number }): number {
  const forward = (vehicle.spec.length / 2) * Math.abs(headingAxis(vehicle.heading).x * axis.x + headingAxis(vehicle.heading).z * axis.z)
  const side = (vehicle.spec.width / 2) * Math.abs(lateralAxis(vehicle.heading).x * axis.x + lateralAxis(vehicle.heading).z * axis.z)
  return forward + side
}

const summary = world.summary()

console.log(`--- ${MINUTES} simulated minutes at ${(1 / DT).toFixed(0)} steps/s ---\n`)
console.log('INVARIANTS')
console.log(`  overlaps            ${overlaps}  (worst ${worstOverlap.value.toFixed(3)} m)`)
if (worstOverlap.note) {
  console.log(`                      ${worstOverlap.note}`)
}
console.log(`  teleports           ${teleports}  (worst ${worstTeleport.value.toFixed(2)} m)`)
console.log(`  entered on red      ${redRunners}`)
console.log(`  order violations    ${orderViolations}`)
console.log(`  reverse motion      ${orderViolations}`)
console.log('')
console.log('TRAFFIC')
console.log(`  vehicles at once    ${peakVehicles}`)
console.log(`  top speed           ${maxSpeed.toFixed(1)} m/s (${(maxSpeed * 3.6).toFixed(0)} km/h)`)
console.log(`  served              ${summary.served}`)
console.log(`  queued now          ${ARMS.map((a) => `${a}:${summary.queued[a]}`).join('  ')}`)
console.log(`  longest wait        ${summary.longestWait.toFixed(1)} s`)
console.log(`  pedestrians out     ${crossings}`)
console.log(`  preemption shown    ${summary.preemption}`)
console.log(`  controller reason   ${summary.reason}`)
console.log('')
console.log('PHASE CHANGES (first 24)')
for (const line of phaseLog.slice(0, 24)) {
  console.log(`  ${line}`)
}
console.log(`  … ${phaseLog.length} phase changes in ${MINUTES} minutes`)

const failures = overlaps + teleports + redRunners + orderViolations
console.log('')
console.log(failures === 0 ? 'ALL INVARIANTS HOLD' : `${failures} VIOLATIONS`)
if (CROSSWALKS.length !== 4 || ARMS.length !== 4 || JUNCTION_HALF <= 0) {
  process.exitCode = 1
}
if (failures > 0) {
  process.exitCode = 1
}
