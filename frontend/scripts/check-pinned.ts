/**
 * ¿Es pinned.end quien nos mata la regla?
 */
import { pinnedBandBetween } from '../src/simulation/core/world'

console.log(pinnedBandBetween('north-0:left', 'sedan' as never, 73.8 - 1.5, 76, 'north-1:right', 'bus' as never))
console.log(pinnedBandBetween('north-0:left', 'sedan' as never, 72.3, 76, 'north-1:right', 'bus' as never))
