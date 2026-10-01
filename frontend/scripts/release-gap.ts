/**
 * Throwaway: the arithmetic that releases a left turner, at the frame it happens.
 *
 * `box-holds` settled that these overlaps are racing vehicles, not vehicles pinned
 * inside the junction, so the release decision is the place to look.
 * `opposingStreamBlocks` compares two numbers and blocks only when the second is
 * smaller than the first:
 *
 *   clearing    = (arc - turner.s + turner.spec.length) / launch + MARGIN
 *   arrivalTime = max(sqrt(2d/accel), d/max(v, maxSpeed))
 *   blocked     = arrivalTime < clearing
 *
 * Both formulas are reproduced here rather than read off the model, because the
 * private method cannot be called and a script that guesses the rule would be the
 * same class of mistake as the ones this file is meant to prevent. They are
 * transcribed from world.ts; if that code changes, check this first.
 *
 * The measurement: every frame in which the turner crosses its own stop line,
 * print the whole comparison for each opposing vehicle — what the turner believed
 * about itself, what it believed about the opponent, and the margin by which it
 * decided the gap was real.
 *
 * Run with: npx tsx scripts/release-gap.ts [turnerId] [minutes] [base] [peak]
 */

import { IntersectionWorld, conflictTableFor, type VehicleState } from '../src/simulation/core/index.ts'

const LAUNCH = 5.5
const MARGIN = 0.8

const turnerId = Number(process.argv[2] ?? 40)
const MINUTES = Number(process.argv[3] ?? 5)
const baseRate = Number(process.argv[4] ?? 0.045)
const peakRate = Number(process.argv[5] ?? 0.075)

function arrivalTime(other: VehicleState, arc: number): number {
  const distance = Math.max(0, arc - (other.s - other.spec.length))
  if (distance === 0) return 0
  const spec = other.spec
  const fromRest = Math.sqrt((2 * distance) / spec.accel)
  const atSpeed = distance / Math.max(other.v, spec.maxSpeed)
  return Math.max(fromRest, atSpeed)
}

const world = new IntersectionWorld({ seed: 7, baseRate, peakRate })
const DT = 1 / 60
const STEPS = Math.round(MINUTES * 60) / DT

let previousS = 0
let released = 0

for (let step = 0; step < STEPS; step += 1) {
  const turner = world.vehicles.find((v) => v.id === turnerId)
  const wasAbove = previousS
  world.step(DT)

  const now = world.vehicles.find((v) => v.id === turnerId)
  previousS = now ? now.s : 0

  // Only the frame the nose passes the stop line: the release happened at or
  // before it, and this is the last moment the decision was still in play.
  if (!now || wasAbove <= now.movement.route.stopS || now.s <= now.movement.route.stopS) continue

  released += 1
  const aspects = world.controller.aspects()
  const stopS = now.movement.route.stopS
  const table = conflictTableFor(now.movement.id)

  console.log(
    `\n=== release #${released} at t=${(step / 60).toFixed(2)}s : ${now.kind}#${now.id} ` +
      `${now.movement.id} crosses stopS=${stopS.toFixed(1)} at v=${now.v.toFixed(2)} m/s, ` +
      `aspect=${aspects[now.lane.arm]} ===`,
  )

  for (const [otherId, arc] of Object.entries(table)) {
    const otherArc = conflictTableFor(otherId)?.[now.movement.id]
    if (otherArc === undefined) continue

    // What the turner believed about its own occupancy of the crossing.
    const clearing = (arc - stopS + now.spec.length) / LAUNCH + MARGIN
    const trueClearing = (now.movement.route.exitS - stopS) / Math.max(now.v, 1)

    const rivals = world.vehicles.filter((v) => v.movement.id === otherId)
    if (rivals.length === 0) continue

    console.log(
      `  vs ${otherId.padEnd(18)} arc=${arc.toFixed(2)}  clearing=${clearing.toFixed(2)}s` +
        `   (turner actually needs ~${trueClearing.toFixed(1)}s at its own pace)`,
    )
    for (const other of rivals) {
      const rear = other.s - other.spec.length
      const past = rear > otherArc
      const eta = arrivalTime(other, otherArc)
      const trueEta = Math.max(0, otherArc - rear) / Math.max(other.v, 0.1)
      const margin = eta - clearing
      console.log(
        `     ${other.kind}#${other.id} s=${other.s.toFixed(1)} v=${other.v.toFixed(2)}` +
          `  rear=${rear.toFixed(1)} otherArc=${otherArc.toFixed(2)}` +
          `  ${past ? 'CLEARED (ignored)' : 'live'}` +
          `  arrivalTime=${eta.toFixed(2)}s (really ${trueEta.toFixed(2)}s)` +
          `  margin=${margin >= 0 ? '+' : ''}${margin.toFixed(2)}s` +
          `  -> ${past ? 'not counted' : margin < 0 ? 'WOULD BLOCK' : 'does not block'}`,
      )
    }
  }
  if (released >= 4) break
}

if (released === 0) {
  console.log(`#${turnerId} never crossed its stop line in ${MINUTES} minutes`)
}