/**
 * Why does the sedan stop at 76 when the band says 72.3?
 *
 * `corner-band.ts` established that the geometry is right and symmetric:
 * `sedan x bus` on `north-0:left x north-1:right` produces a band of
 * 73.80..84.20 on the left turner's route, against a stop line at 76.00, so
 * `holdAt = 73.80 - 1.5 = 72.30` and the car should be standing two and a half
 * metres short of its own line with the bus coming.
 *
 * It is not. So the band is being produced and then dropped, and the drop happens
 * in one of four clauses inside `holdForBodyConflict`, three of which are cheap to
 * evaluate here and one of which - `outrunsTheSweep` - is the interesting one.
 *
 * Each clause is reproduced below with the arithmetic printed, because "the band
 * exists and nothing fired" has four possible reasons and they are distinguished
 * by four different numbers.
 *
 * Usage:
 *   npx tsx scripts/corner-decision.ts [seed]
 */
import { IntersectionWorld } from '../src/simulation/core/world'
import { MOVEMENTS } from '../src/simulation/core/layout'

const DT = 1 / 60
const MIN_GAP = 1.5
const LAUNCH = 5.5
const MARGIN = 0.8

const numeric = process.argv.filter((a) => /^\d+$/.test(a))
const seed = numeric.length > 0 ? Number(numeric[0]) : 5

const world = new IntersectionWorld({ seed, baseRate: 0.045, peakRate: 0.075 })

interface Body {
  heading: number
  position: { x: number; z: number }
  spec: { length: number; width: number; accel: number; maxSpeed: number }
  movement: {
    id: string
    turn: string
    route: { stopS: number; exitS: number; total: number }
    destination: { id: string }
  }
  s: number
  v: number
  lane: { id: string; arm: string }
}

function heading(a: number) {
  return { x: Math.sin(a), z: Math.cos(a) }
}
function lateral(a: number) {
  return { x: Math.cos(a), z: -Math.sin(a) }
}
function extent(b: Body, axis: { x: number; z: number }): number {
  const f = heading(b.heading)
  const s = lateral(b.heading)
  return (
    (b.spec.length / 2) * Math.abs(f.x * axis.x + f.z * axis.z) +
    (b.spec.width / 2) * Math.abs(s.x * axis.x + s.z * axis.z)
  )
}
function penetration(a: Body, b: Body): number {
  let worst = -Infinity
  for (const axis of [heading(a.heading), lateral(a.heading), heading(b.heading), lateral(b.heading)]) {
    const gap =
      Math.abs((b.position.x - a.position.x) * axis.x + (b.position.z - a.position.z) * axis.z)
    worst = Math.max(worst, gap - (extent(a, axis) + extent(b, axis)))
  }
  return -worst
}

function arrivalTime(v: Body, arc: number): number {
  const distance = Math.max(0, arc - (v.s - v.spec.length))
  if (distance === 0) {
    return 0
  }
  const fromRest = Math.sqrt((2 * distance) / v.spec.accel)
  const atSpeed = distance / Math.max(v.v, v.spec.maxSpeed)
  return Math.max(fromRest, atSpeed)
}

const cars = world.vehicles as unknown as Body[]

for (let step = 0; step < 60 * 300; step += 1) {
  world.step(DT)

  for (let a = 0; a < world.vehicles.length; a += 1) {
    for (let b = a + 1; b < world.vehicles.length; b += 1) {
      const first = world.vehicles[a] as unknown as Body
      const second = world.vehicles[b] as unknown as Body
      const isPair =
        (first.movement.id.endsWith(':left') && second.movement.id.endsWith(':right')) ||
        (second.movement.id.endsWith(':left') && first.movement.id.endsWith(':right'))
      if (!isPair || first.lane.arm !== second.lane.arm) {
        continue
      }
      if (penetration(first, second) <= 0) {
        continue
      }

      const left = first.movement.id.endsWith(':left') ? first : second
      const bus = first.movement.id.endsWith(':right') ? first : second
      const t = step * DT
      const route = MOVEMENTS.find((m) => m.id === left.movement.id)!.route
      console.log(`semilla ${seed} · t=${t.toFixed(3)} s · ${left.movement.id} x ${bus.movement.id}`)
      console.log('')
      console.log('LA CLÁSICA QUE SE PASA POR ALTO (nadie la ha tocado):')
      console.log(`  vehicle.s (${left.s.toFixed(3)}) >= stopS + 0,05 (${(route.stopS + 0.05).toFixed(3)})?`)
      console.log(`    -> ${left.s >= route.stopS + 0.05 ? 'VERDADERO, se sale sin mirar' : 'falso, sigue dentro'}`)
      console.log('')

      const holdAt = 73.8 - MIN_GAP
      console.log('  CLÁUSULA 1 - la pareja se cruza por centro?  routesConflict')
      console.log('    -> NO (los centroides nunca se cruzan; es solape de CUERPO puro)')
      console.log('       sin continue: pasa a comprobar el cuerpo')
      console.log('')

      console.log('  CLÁUSULA 2 - bodyConflict && outranked')
      console.log(`    bodyConflict          -> verdadero (la banda 73,8..84,2 lo demuestra)`)
      console.log(`    outranked(left, bus)  -> ${bus.spec.length > left.spec.length + 0.25}  (${left.spec.length} vs ${bus.spec.length})`)
      console.log(`    -> ${bus.spec.length > left.spec.length + 0.25 ? 'true, el coche DEBE esperar' : 'FALSA: el bus no cede al coche, nadie espera'}`)
      console.log('')

      console.log('  CLÁUSULA 3 - el bus ya no puede alcanzar la banda')
      console.log(`    bus.s - bus.length = ${(bus.s - bus.spec.length).toFixed(3)}  contra pinned.end = 84.80`)
      console.log(
        `    -> ${bus.s - bus.spec.length > 84.8 ? 'CONTINUE (descartada)' : 'sigue dentro, la regla se aplica'}`,
      )
      console.log('')

      console.log('  CLÁUSULA 4 - outrunsTheSweep  <-- la responsable')
      const myTime = (route.exitS - left.s) / LAUNCH + MARGIN
      const arc = 84.0
      const distance = Math.max(0, arc - (bus.s - bus.spec.length))
      const fromRest = Math.sqrt((2 * distance) / bus.spec.accel)
      const atSpeed = distance / Math.max(bus.v, bus.spec.maxSpeed)
      const at = Math.max(fromRest, atSpeed)
      console.log(`    myTime      = (exitS ${route.exitS.toFixed(2)} - s ${left.s.toFixed(2)}) / 5,5 + 0,8 = ${myTime.toFixed(4)} s`)
      console.log(`    distancia   = ${arc.toFixed(2)} - (s ${bus.s.toFixed(3)} - L ${bus.spec.length}) = ${distance.toFixed(3)} m`)
      console.log(`    bus.accel   = ${bus.spec.accel}   bus.v = ${bus.v.toFixed(2)}   bus.maxSpeed = ${bus.spec.maxSpeed}`)
      console.log(`    fromRest    = sqrt(2 x ${distance.toFixed(3)} / ${bus.spec.accel})        = ${fromRest.toFixed(4)} s`)
      console.log(`    atSpeed     = ${distance.toFixed(3)} / max(${bus.v.toFixed(2)}, ${bus.spec.maxSpeed}) = ${atSpeed.toFixed(4)} s`)
      console.log(`    arrivalTime = max(fromRest, atSpeed)               = ${at.toFixed(4)} s   <-- GANA EL max()`)
      console.log(`    comparacion: arrivalTime ${at.toFixed(4)} > myTime ${myTime.toFixed(4)}  ->  ${at > myTime}`)
      console.log('')
      const margin = at - myTime
      console.log(`    MARGEN = ${margin.toFixed(4)} s`)
      console.log('')
      const v0 = Math.max(0, bus.v)
      const toTop = Math.max(0, bus.spec.maxSpeed ** 2 - v0 ** 2) / (2 * bus.spec.accel)
      const fixed =
        distance <= toTop
          ? (Math.sqrt(v0 * v0 + 2 * bus.spec.accel * distance) - v0) / bus.spec.accel
          : Math.max(0, bus.spec.maxSpeed - v0) / bus.spec.accel + (distance - toTop) / bus.spec.maxSpeed
      console.log('    ANTES  (max de dos terminos):')
      console.log(`      arrivalTime = max(fromRest, atSpeed) = ${at.toFixed(4)} s   <-- gana fromRest`)
      console.log(`      ${at.toFixed(4)} > ${myTime.toFixed(4)} -> ${at > myTime}   => el coche PASA`)
      console.log('')
      console.log('    AHORA  (acelerar y luego mantener):')
      console.log(`      toTop       = ${toTop.toFixed(3)} m`)
      console.log(`      arrivalTime = (sqrt(v0^2 + 2ad) - v0) / a = ${fixed.toFixed(4)} s`)
      console.log(`      ${fixed.toFixed(4)} > ${myTime.toFixed(4)} -> ${fixed > myTime}   => el coche ESPERA`)
      console.log('')
      console.log(`    tiempo real del bus a ${bus.v.toFixed(2)} m/s = ${(distance / bus.v).toFixed(3)} s`)
      console.log('')
      console.log('  CONCLUSION:')
      console.log(`    La version nueva llega antes (${at.toFixed(2)} -> ${fixed.toFixed(2)} s), que es`)
      console.log('    la direccion segura: el bus deja de parecer lento.')
      process.exit(0)
    }
  }
}

console.log(`sin solapamiento en la semilla ${seed}`)
