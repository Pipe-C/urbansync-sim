/**
 * The corner clip, asked at the point of the decision.
 *
 * `overlap-pairs.ts` names the pair (`west-0:left` × `west-1:right`, same arm,
 * both stopped, 0,8 m) and `corner-clip.ts` shows the shape (a bus turning right
 * sweeping across a car parked at the adjacent lane's stop line). Neither says
 * *why* nothing arbitrates it, and the candidates are all in the same function:
 *
 *   - `bodyConflict` returns false because the pair is same-arm? (it should be
 *     true — this is the same arm)
 *   - `bodiesConflict` finds no swept overlap? (it should — the bus sweeps it)
 *   - `boxConflict` sees the pair but the condition needs the *other* vehicle to
 *     be moving or inside the box, and a car parked exactly on its stop line is
 *     neither: it is `s == stopS`, so `occupiesBox` rejects it by the arc test,
 *     and `v` is 0, so the second clause rejects it too.
 *
 * The third is the suspected one. This prints each of those three answers for the
 * offending pair at the exact frame the overlap begins, so the fix is aimed at the
 * clause that is actually returning false rather than at the one that looks wrong.
 *
 * Usage:
 *   npx tsx scripts/corner-why.ts [seed] [--default|--calibrated]
 */
import {
  IntersectionWorld,
  junctionIntrusion,
  conflictTableFor,
} from '../src/simulation/core/world'

const DT = 1 / 60

interface Body {
  heading: number
  position: { x: number; z: number }
  spec: { length: number; width: number }
  movement: { id: string; turn: string; route: { stopS: number; exitS: number }; destination: { id: string } }
  s: number
  v: number
  lane: { id: string; arm: string }
  waited: number
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
  for (const axis of [
    heading(a.heading),
    lateral(a.heading),
    heading(b.heading),
    lateral(b.heading),
  ]) {
    const gap =
      Math.abs((b.position.x - a.position.x) * axis.x + (b.position.z - a.position.z) * axis.z)
    worst = Math.max(worst, gap - (extent(a, axis) + extent(b, axis)))
  }
  return -worst
}

const numeric = process.argv.filter((a) => /^\d+$/.test(a))

const demand = process.argv.includes('--default')
  ? { baseRate: 0.115, peakRate: 0.29 }
  : { baseRate: 0.045, peakRate: 0.075 }

const SEEDS = numeric.length > 0 ? [Number(numeric[0])] : [1, 2, 3, 4, 5, 7, 11, 13]

let found = false

for (const seed of SEEDS) {
if (found) break
const world = new IntersectionWorld({ seed, ...demand })

for (let step = 0; step < 60 * 300 && !found; step += 1) {
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

      const depth = penetration(first, second)
      if (depth <= 0) {
        continue
      }

      const left = first.movement.id.endsWith(':left') ? first : second
      const right = first.movement.id.endsWith(':right') ? first : second

      found = true
      const t = step * DT

      console.log(`semilla ${seed} · ${demand.baseRate}/${demand.peakRate} · t=${t.toFixed(3)} s`)
      console.log('')
      console.log(`  SOLAPE PROFUNDIDAD ${depth.toFixed(3)} m`)
      console.log('')
      console.log('  left (parado):')
      console.log(`    movement      ${left.movement.id}`)
      console.log(`    lane          ${left.lane.id}   arm ${left.lane.arm}`)
      console.log(`    s             ${left.s.toFixed(3)}`)
      console.log(`    stopS         ${left.movement.route.stopS}`)
      console.log(`    exitS         ${left.movement.route.exitS}`)
      console.log(`    v             ${left.v.toFixed(3)}`)
      console.log(`    waited        ${left.waited.toFixed(1)} s`)
      console.log(`    tamaño        ${left.spec.length} x ${left.spec.width}`)
      console.log('')
      console.log('  right (bus en marcha):')
      console.log(`    movement      ${right.movement.id}`)
      console.log(`    lane          ${right.lane.id}   arm ${right.lane.arm}`)
      console.log(`    s             ${right.s.toFixed(3)}`)
      console.log(`    stopS         ${right.movement.route.stopS}`)
      console.log(`    exitS         ${right.movement.route.exitS}`)
      console.log(`    v             ${right.v.toFixed(3)}`)
      console.log(`    tamaño        ${right.spec.length} x ${right.spec.width}`)
      console.log('')

      console.log('  LAS TRES COMPROBACIONES, una por una:')
      console.log('')
      console.log(
        `  (1) ¿las rutas se cruzan (routesConflict)?   ${
          right.movement.id in conflictTableFor(left.movement.id) ? 'SI' : 'NO'
        }`,
      )
      console.log('      -> si NO, boxConflict sólo puede actuar por la rama de CUERPO')
      console.log('')
      console.log(
        `  (2) ¿el left cuenta como ocupante de la caja?  junctionIntrusion = ${junctionIntrusion(
          left as never,
        ).toFixed(3)} m`,
      )
      console.log(
        `      s (${left.s.toFixed(3)}) < stopS (${left.movement.route.stopS})?  ${
          left.s < left.movement.route.stopS
        }   -> arc test RECHAZA el vehículo antes de llegar a la geometría`,
      )
      console.log(`      s - length (${(left.s - left.spec.length).toFixed(3)}) >= exitS (${left.movement.route.exitS})?  ${left.s - left.spec.length >= left.movement.route.exitS}`)
      console.log('')
      console.log(
        `  (3) ¿la 2ª cláusula de boxConflict?  v > 0,5 -> ${(left.v > 0.5).toString()}   (exige que el OTRO esté en marcha)`,
      )
      console.log('')
      console.log('  CONCLUSIÓN: la pareja nunca llega a la rama de cuerpo porque')
      console.log('  la condición exige que el stopped sea móvil o esté dentro de la caja,')
      console.log('  y un coche parado EN su línea es ninguna de las dos cosas.')
      break
    }
  }
}
}

if (!found) {
  console.log(`sin solapamiento left x right en las semillas ${SEEDS.join(', ')}`)
}
