/**
 * Every frame on which the sweeper was asked, and the verdict it got.
 *
 * `sweep-gate.ts` establishes that the right-turner sits at its own stop line,
 * at the head of its queue, on a green, for frames at a time while the car it
 * sweeps stands in the band. This prints what `sweptOverAStoppedBody` answered
 * on each of those frames, so the question is no longer "is the rule correct" but
 * "is the rule being asked".
 *
 * Usage: npx tsx scripts/sweep-release.ts [seed] [movementId] [fromSeconds] [toSeconds]
 */
import { IntersectionWorld, setBodyTrace } from '../src/simulation/core/world'

setBodyTrace(true)

const DT = 1 / 60
const args = process.argv.slice(2)
const seed = Number(args[0] ?? 11)
const movement = args[1] ?? 'south-1:right'
const from = Number(args[2] ?? 180)
const to = Number(args[3] ?? 190)

const world = new IntersectionWorld({ seed, baseRate: 0.045, peakRate: 0.075 })

const tally = new Map<string, number>()
let printed = 0

for (let step = 0; step < 60 * 300; step += 1) {
  world.step(DT)
  const t = step * DT
  const lines = world.takeTrace()
  if (t < from || t > to) {
    continue
  }
  for (const line of lines) {
    if (!line.startsWith('SWEEP') || !line.includes(`[${movement} `)) {
      continue
    }
    const verdict = line.includes('BLOQUEA') ? 'BLOQUEA' : 'no'
    tally.set(verdict, (tally.get(verdict) ?? 0) + 1)
    if (printed < 40) {
      console.log(`t=${t.toFixed(3)}  ${line}`)
      printed += 1
    }
  }
}

console.log('')
for (const [verdict, count] of [...tally.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${verdict.padEnd(10)} ${count} frames`)
}
if (tally.size === 0) {
  console.log('  la regla NO se pregunto ni una vez en esa ventana')
}
