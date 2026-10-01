/**
 * Does the body-geometry layer see the corner pair, and where does it say to stop?
 *
 * `corner-why.ts` proved the pair never reaches `holdForBodyConflict`'s branch,
 * which leaves two candidates and they are separable with one exported call:
 *
 *   - `bodyOverlapSpan` returns `null`  -> the geometry is blind to the pair and
 *     no arbitration built on it can ever fire. The bug is in the swept-band
 *     sampling, not in the priority rule.
 *   - `bodyOverlapSpan` returns a band  -> the geometry is fine and the band is
 *     being discarded by a clause downstream.
 *
 * It also prints the band's start against the stop line, because a band that
 * starts *behind* the stop line is a rule that can never be obeyed by a vehicle
 * that is allowed to stop at its own line - the geometry would be right and the
 * arithmetic unreachable at the same time.
 *
 * Usage:
 *   npx tsx scripts/corner-band.ts
 */
import { bodyBandBetween } from '../src/simulation/core/world'
import { MOVEMENTS } from '../src/simulation/core/layout'
import { VEHICLE_SPECS } from '../src/simulation/core/fleet'

const KINDS = Object.keys(VEHICLE_SPECS)

const pairs: [string, string][] = [
  ['north-0:left', 'north-1:right'],
  ['west-0:left', 'west-1:right'],
  ['south-0:left', 'south-1:right'],
]

console.log('')
console.log('¿La geometría de cuerpos ve el par?  matriz completa (fila = left, columna = right)')
console.log('')
console.log('izquierda           ' + KINDS.map((k) => k.slice(0, 5).padStart(8)).join(''))
console.log('─'.repeat(18 + 8 * KINDS.length))

for (const [left, right] of pairs) {
  const leftRoute = MOVEMENTS.find((m) => m.id === left)!
  const stopS = leftRoute.route.stopS
  const parts = KINDS.map((aKind) => {
    const cell = KINDS.map((bKind) => {
      const band = bodyBandBetween(left, aKind as never, right, bKind as never)
      return (band.a ? band.a.start.toFixed(1) : '·').padStart(8)
    }).join('')
    return `${aKind.slice(0, 8).padEnd(10)}${cell}`
  })
  console.log(`${left.padEnd(18)}${parts.join('\n')}`)
  console.log(`   (stopS de la izquierda = ${stopS.toFixed(2)};  · = sin banda)`)
  console.log('')
}

console.log('Asimetría — la misma pareja de tamaños, preguntada en los dos sentidos:')
console.log('')
for (const [left, right] of pairs) {
  for (const aKind of KINDS) {
    for (const bKind of KINDS) {
      const forward = bodyBandBetween(left, aKind as never, right, bKind as never)
      const backward = bodyBandBetween(right, bKind as never, left, aKind as never)
      const f = forward.a ? `${forward.a.start.toFixed(2)}..${forward.a.end.toFixed(2)}` : 'null'
      const b = backward.b ? `${backward.b.start.toFixed(2)}..${backward.b.end.toFixed(2)}` : 'null'
      const flag = forward.a && !backward.b ? '  <-- ASIMÉTRICO' : ''
      console.log(`  ${aKind.padEnd(11)} x ${bKind.padEnd(11)}  left-first=${f.padEnd(16)} right-first=${b}${flag}`)
    }
  }
  break
}
