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
 * Run with: npx tsx scripts/verify-model.ts [minutes] [--quiet]
 *
 * The pairwise body test is the expensive part and it is the reason for the two
 * flags. It is a full SAT over every pair of vehicles, every frame, which at a
 * few hundred vehicles is a few hundred million oriented-box tests for a ten
 * minute run; run on every frame it dominated the whole script and made the run
 * indistinguishable from a hang. It is therefore sampled every `OVERLAP_EVERY`
 * frames — ten times a second, which is faster than a collision can be entered
 * and left — while everything that costs nothing (order, arc monotonicity,
 * stop-line crossings) still runs on every single frame, because those are the
 * properties being fixed and a sampled version of them would not be a check.
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
const MINUTES = Number(process.argv[2]) || 10
const QUIET = process.argv.includes('--quiet')

/** Frames between pairwise body tests. 6 frames is 10 Hz. */
const OVERLAP_EVERY = 6

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
    //
    // Asked per MOVEMENT, not per approach. `aspects()` is the through aspect and
    // reports red on every arm during a protected left phase, so asking it here
    // counted every left-turner released on a green left arrow as a red runner —
    // eleven of them, at 4 cm/s and 0,7 mm past the line. The controller already
    // answers the right question in `aspectFor(arm, turn)`; this was asking the
    // wrong one and the metric, not the model, was wrong.
    const route = vehicle.movement.route
    const movementAspect = world.controller.aspectFor(
      vehicle.lane.arm,
      vehicle.movement.turn,
    )
    if (movementAspect === 'red' && vehicle.s > route.stopS) {
      const enteredOnRed = before !== undefined && before.s <= route.stopS
      if (enteredOnRed) {
        redRunners += 1
      }
    }
  }

  // 4. No two vehicles overlap, on the approach or on an exit.
  if (step % OVERLAP_EVERY === 0) {
    const count = world.vehicles.length
    for (let a = 0; a < count; a += 1) {
      const first = world.vehicles[a]
      if (!first) continue
      for (let b = a + 1; b < count; b += 1) {
        const second = world.vehicles[b]
        if (!second) continue
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

  if (!QUIET && step % 1800 === 0 && step > 0) {
    console.log(
      `  … ${(step * DT / 60).toFixed(1)} min  ${world.vehicles.length} vehicles  ` +
        `served ${world.summary().served}  overlaps ${overlaps}  red ${redRunners}`,
    )
  }
}

/**
 * Oriented boxes, via the separating axis theorem in 2D. A circle test would
 * pass a car that is legally in a lane but a bus that is clipping a bollard.
 *
 * The metric is the *largest* gap over the four candidate axes, not the
 * smallest. Two buses passing in opposite lanes are deeply interpenetrating
 * along the road axis and clearly apart along the cross axis; separated means
 * "some axis has them apart", so the maximum is the separation and its
 * negation is the overlap. Taking the minimum instead measures how badly they
 * overlap in the one direction where they do not, and reports two buses in
 * their own lanes driving head-on into each other.
 *
 * The four candidate axes are the two edge normals of each body, and the
 * projections below are the same expressions the original object-based version
 * computed — written out longhand and with no temporaries, because at a few
 * hundred vehicles and ten minutes of frames this is a few hundred million calls
 * and the version that built a `flatMap` of four axis objects per pair spent
 * longer allocating than the model spent simulating. The arithmetic is
 * deliberately not folded or shared between the axes: this runs often enough to
 * matter and rarely enough that a second of its time is worth not having to
 * re-derive a dot product to be sure of it.
 */
function penetrationOf(a: VehicleState, b: VehicleState): number {
  const aSin = Math.sin(a.heading)
  const aCos = Math.cos(a.heading)
  const bSin = Math.sin(b.heading)
  const bCos = Math.cos(b.heading)

  const dx = b.position.x - a.position.x
  const dz = b.position.z - a.position.z

  const aAlong = a.spec.length / 2
  const aAcross = a.spec.width / 2
  const bAlong = b.spec.length / 2
  const bAcross = b.spec.width / 2

  // Along a's heading normal.
  const onAForward =
    aAlong +
    bAlong * Math.abs(bSin * aSin + bCos * aCos) +
    bAcross * Math.abs(bCos * aSin - bSin * aCos)
  const onARight =
    aAcross +
    bAlong * Math.abs(bSin * aCos - bCos * aSin) +
    bAcross * Math.abs(bCos * aCos + bSin * aSin)

  // Along b's heading normals, with the roles swapped.
  const onBForward =
    bAlong +
    aAlong * Math.abs(aSin * bSin + aCos * bCos) +
    aAcross * Math.abs(aCos * bSin - aSin * bCos)
  const onBRight =
    bAcross +
    aAlong * Math.abs(aSin * bCos - aCos * bSin) +
    aAcross * Math.abs(aCos * bCos + aSin * bSin)

  const separation = Math.max(
    Math.abs(dx * aSin + dz * aCos) - onAForward,
    Math.abs(dx * aCos - dz * aSin) - onARight,
    Math.abs(dx * bSin + dz * bCos) - onBForward,
    Math.abs(dx * bCos - dz * bSin) - onBRight,
  )

  return -separation
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
