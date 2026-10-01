import { conflictTableFor } from '../src/simulation/core/world'
import { MOVEMENTS } from '../src/simulation/core/layout'

const lefts = MOVEMENTS.filter((movement) => movement.turn === 'left')
const throughs = MOVEMENTS.filter((movement) => movement.turn === 'through')

const id = (movement: { id: string }) => movement.id

console.log('¿el giro a la izquierda N-S se cruza con el otro giro a la izquierda N-S?')
for (const first of lefts) {
  for (const second of lefts) {
    const opposing = first.lane.arm !== second.lane.arm
    const crossed = second.id in conflictTableFor(first.id)
    console.log(`  ${first.id.padEnd(14)} x ${second.id.padEnd(14)} ${crossed ? 'SE CRUZAN' : 'libres   '}`)
  }
}

console.log('\nFase protegida propuesta: north-0:left + south-0:left en verde a la vez.')
console.log('Todo lo demás rojo. Comprueba que ese par no se estorba:')
for (const first of lefts) {
  const table = conflictTableFor(first.id)
  const inside = new Set([first.id, first.lane.arm === 'north' || first.lane.arm === 'south' ? 'south-0:left' : 'north-0:left'])
  const blockers = [...Object.keys(table), ...throughs.map(id)].filter(
    (candidate) => !inside.has(candidate),
  )
  console.log(`  con ${first.id} verde, quedan bloqueados: ${blockers.length} movimientos`)
}
