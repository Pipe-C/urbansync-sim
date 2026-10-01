/**
 * Which vehicle sizes can reach behind a stop line at all.
 *
 * The whole last of the overlap work turns on one number: the swept band on the
 * left-turner's own route, and where its *start* falls relative to the left
 * turner's own stop line. A band that begins after the line describes a car that
 * is perfectly safe where the signal tells it to stand, and no rule is needed. A
 * band that begins *before* the line describes a car that is already in the way
 * before it has done anything wrong, and every rule written on the assumption
 * that standing at the line is safe is wrong.
 *
 * `CONTINUIDAD.md` §3.2 measured one pair (sedan × bus, 73,80 against a line at
 * 76,00). This asks the question of the whole catalogue, because if only the long
 * vehicles do it then the arbitration only ever has to deal with them, and if a
 * hatchback does it too then the cost is paid on every queue in the model.
 *
 * Usage: npx tsx scripts/band-matrix.ts
 */
import { bodyBandBetween } from '../src/simulation/core/world'
import { ORDINARY_KINDS, VEHICLE_SPECS, type VehicleKind } from '../src/simulation/core/fleet'
import { APPROACH_LENGTH } from '../src/simulation/core/layout'

const pairs: [VehicleKind, VehicleKind][] = []
for (const turner of ORDINARY_KINDS) {
  for (const held of ORDINARY_KINDS) {
    pairs.push([turner, held])
  }
}

console.log(`line de parada = ${APPROACH_LENGTH.toFixed(2)} m; "detras" = la banda empieza antes de ella`)
console.log('')
console.log('  barreador (:right)   retenido (:left)   largo   banda en la ruta del retenido    alcanza detras de la linea')
console.log('  ' + '-'.repeat(112))

let behind = 0
let total = 0

for (const [turner, held] of pairs) {
  const swept = bodyBandBetween('north-0:left', held, 'north-1:right', turner).a
  total += 1
  if (!swept) {
    console.log(
      `  ${turner.padEnd(20)}   ${held.padEnd(18)}   ${VEHICLE_SPECS[turner].length.toFixed(2).padStart(5)}` +
        `   ${'sin banda'.padEnd(30)}  no`,
    )
    continue
  }
  const reachesBack = swept.start < APPROACH_LENGTH
  if (reachesBack) {
    behind += 1
  }
  console.log(
    `  ${turner.padEnd(20)}   ${held.padEnd(18)}   ${VEHICLE_SPECS[turner].length.toFixed(2).padStart(5)}` +
      `   ${`${swept.start.toFixed(2)} .. ${swept.end.toFixed(2)}`.padEnd(30)}  ` +
      `${reachesBack ? `SI, por ${(APPROACH_LENGTH - swept.start).toFixed(2)} m` : 'no'}`,
  )
}

console.log('')
console.log(`${behind} de ${total} pares de tamanos alcanzan detras de la linea de parada`)
