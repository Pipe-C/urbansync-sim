import type { CSSProperties } from 'react'

import { cn } from '@/utils/cn'

import './AmbientIntersection.css'

/**
 * The junction, running behind the login form and — from Sprint 1-D — standing
 * in for the dashboard canvas until `IntersectionScene` arrives.
 *
 * Right-hand traffic, so the rule that decides every placement below is: on a
 * north–south road, southbound traffic holds the western half and northbound the
 * eastern one, and the mirror applies to the east–west road. No lane is placed by
 * eye. Inbound approaches stop at the stop line; outbound lanes start at the
 * junction mouth and drive away, which is why they need keyframes of their own.
 *
 * The scene exists because a login screen that shows a product's subject working
 * is worth more than a login screen that describes it. So it is built to be read
 * as a place: named streets, kerbs, crosswalks, a lane-use arrow, signal heads
 * in housings, a queue that forms, a car that turns, and pedestrians who are the
 * visible reason the cycle has an all-red interval in it.
 *
 * It is decorative. It carries no state, is hidden from assistive technology, and
 * never takes focus — the one exception being a vehicle you can hover to freeze,
 * which is the interaction the whole product is about and which a login page is
 * allowed to offer because it blocks nothing.
 */

/** The four arms of the junction, named for the road they sit on. */
type Approach = 'north' | 'south' | 'east' | 'west'

interface Lane {
  id: string
  approach: Approach
  direction: 'down' | 'up' | 'right' | 'left'
  /** East–west lanes run half a cycle behind the north–south ones. */
  ew: boolean
  /** Outbound lanes are already inside the junction; they leave rather than queue. */
  outbound?: boolean
  /** Cross-axis and along-axis placement. Percentages of the stage. */
  box: string
  position: string
  /** How many vehicles ride this lane. */
  slots: number
  /** Set only on the arm that has a marked right-turn lane. */
  turn?: boolean
}

/**
 * Inbound lanes carry a queue; outbound lanes carry a steady stream, so two is
 * enough. The turn lane is short by design — it is a turn pocket, not an approach.
 */
const INBOUND_SLOTS = 4
const OUTBOUND_SLOTS = 2

const LANES: Lane[] = [
  // North arm, inbound: a marked right-turn pocket on the kerb side and the
  // through lane beside it, because a junction where nothing turns is a diagram.
  {
    id: 'north-turn',
    approach: 'north',
    direction: 'down',
    ew: false,
    box: 'w-[4.4%] aspect-[1/2.1]',
    position: 'left-[38.8%] top-0',
    slots: 2,
    turn: true,
  },
  {
    id: 'north-through',
    approach: 'north',
    direction: 'down',
    ew: false,
    box: 'w-[4.4%] aspect-[1/2.1]',
    position: 'left-[44.8%] top-0',
    slots: INBOUND_SLOTS,
  },
  // The other three approaches have a single lane each side. Turn pockets are
  // added where traffic justifies them, not symmetrically for the sake of it.
  {
    id: 'south-through',
    approach: 'south',
    direction: 'up',
    ew: false,
    box: 'w-[4.4%] aspect-[1/2.1]',
    position: 'left-[53.8%] bottom-0',
    slots: INBOUND_SLOTS,
  },
  {
    id: 'east-through',
    approach: 'east',
    direction: 'left',
    ew: true,
    box: 'h-[4.4%] aspect-[2.1/1]',
    position: 'right-0 top-[38.8%]',
    slots: INBOUND_SLOTS,
  },
  {
    id: 'west-through',
    approach: 'west',
    direction: 'right',
    ew: true,
    box: 'h-[4.4%] aspect-[2.1/1]',
    position: 'left-0 top-[53.8%]',
    slots: INBOUND_SLOTS,
  },
  // Outbound lanes, seated in the junction mouth on the correct side of the
  // centre line and leaving the frame rather than stopping at it.
  {
    id: 'north-exit',
    approach: 'north',
    direction: 'up',
    ew: false,
    outbound: true,
    box: 'w-[4.4%] aspect-[1/2.1]',
    position: 'left-[53.8%] top-[38%]',
    slots: OUTBOUND_SLOTS,
  },
  {
    id: 'south-exit',
    approach: 'south',
    direction: 'down',
    ew: false,
    outbound: true,
    box: 'w-[4.4%] aspect-[1/2.1]',
    position: 'left-[44.8%] top-[52%]',
    slots: OUTBOUND_SLOTS,
  },
  {
    id: 'east-exit',
    approach: 'east',
    direction: 'left',
    ew: true,
    outbound: true,
    box: 'h-[4.4%] aspect-[2.1/1]',
    position: 'left-[38%] top-[38.8%]',
    slots: OUTBOUND_SLOTS,
  },
  {
    id: 'west-exit',
    approach: 'west',
    direction: 'right',
    ew: true,
    outbound: true,
    box: 'h-[4.4%] aspect-[2.1/1]',
    position: 'left-[50%] top-[53.8%]',
    slots: OUTBOUND_SLOTS,
  },
]

/**
 * Body colours, drawn from the neutral end of the palette. Vehicles deliberately
 * avoid the semantic channels: green is flow, red is congestion, and a car in
 * either would be making a claim the traffic does not support. The single
 * exception is the emergency vehicle below, which is red because it means it.
 */
const BODY_TONES = [
  'bg-slate-400/70',
  'bg-slate-300/60',
  'bg-slate-500/70',
  'bg-slate-200/55',
  'bg-slate-400/55',
] as const

const STREETS: { name: string; position: string }[] = [
  { name: 'Av. Norte', position: 'left-[3%] top-[3%]' },
  { name: 'Calle Este', position: 'right-[3%] top-[3%]' },
  { name: 'Av. Sur', position: 'right-[3%] bottom-[3%]' },
  { name: 'Calle Oeste', position: 'left-[3%] bottom-[3%]' },
]

/**
 * One arm of the junction, drawn once and rotated into the other three.
 *
 * `turn` is the exception to the rotation: a marked turn pocket exists on the
 * north approach only, so the other three arms are not copies of it. Rotating
 * the paint rather than repeating it by hand is what keeps the four approaches
 * from drifting apart as the geometry is tuned.
 */
function ArmPaint({ rotation, turn = false }: { rotation: number; turn?: boolean }) {
  return (
    <g transform={`rotate(${rotation} 50 50)`}>
      {/* Divider between opposing flows, both sides of the junction. */}
      <path
        d="M50 0v33M50 67V100"
        className="stroke-line"
        strokeWidth="0.4"
        strokeDasharray="3.5 3.5"
      />
      {/* Zebra crossing across the full carriageway, between the stop line and
          the junction — which is exactly where a car on red is standing. */}
      <path
        d="M40 34.6v3M43.4 34.6v3M46.8 34.6v3M50.2 34.6v3M53.6 34.6v3M57 34.6v3M60.4 34.6v3"
        className="stroke-slate-300"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.22"
      />
      {/* Stop line for the inbound half of the carriageway. Brighter and heavier
          than the lane markings, because it is the only one a driver reads. */}
      <path d="M38.4 33.4h11.2" className="stroke-slate-200" strokeWidth="1.3" opacity="0.4" />

      {turn ? (
        <>
          <path d="M44 0v32" className="stroke-line" strokeWidth="0.35" strokeDasharray="2.5 3" />
          {/* Right-turn arrow: shaft, quarter arc into the kerb, head. An arrow
              you can follow with your eye is what tells you the pocket turns. */}
          <path
            d="M41 15v9a3 3 0 0 1-3 3M40 25.6 38 27l2 1.4"
            className="stroke-slate-200"
            strokeWidth="0.7"
            strokeLinecap="round"
            opacity="0.4"
            fill="none"
          />
        </>
      ) : (
        <path
          d="M47 14v13M44.8 24.4 47 27.2l2.2-2.8"
          className="stroke-slate-200"
          strokeWidth="0.7"
          strokeLinecap="round"
          opacity="0.4"
          fill="none"
        />
      )}
    </g>
  )
}

interface VehicleProps {
  lane: Lane
  slot: number
  /** Only the north turn pocket has one, and it occupies the first slot. */
  turning?: boolean
  emergency?: boolean
}

function Vehicle({ lane, slot, turning = false, emergency = false }: VehicleProps) {
  return (
    <span
      data-slot={slot}
      style={{ '--queue': slot } as CSSProperties}
      className={cn(
        'ambient-vehicle',
        `ambient-vehicle--${lane.direction}`,
        lane.box,
        lane.position,
        lane.ew && 'ambient-vehicle--ew',
        lane.outbound && 'ambient-vehicle--exit',
        turning && 'ambient-vehicle--turning',
        emergency && 'ambient-vehicle--emergency',
        !lane.outbound && BODY_TONES[(lane.id.length + slot) % BODY_TONES.length],
      )}
    >
      <span className="ambient-car-deck" />
      <span className="ambient-car-roof" />
      {emergency && <span className="ambient-beacon" />}
      {!turning && <span className="ambient-vehicle-tag">{`${lane.approach} · en espera`}</span>}
    </span>
  )
}

function SignalHead({ position, ew = false }: { position: string; ew?: boolean }) {
  return (
    <div className={cn('ambient-head', position, ew && 'ambient-head--ew')}>
      <span className="ambient-lamp ambient-lamp--red bg-congested" />
      <span className="ambient-lamp ambient-lamp--amber bg-warning" />
      <span className="ambient-lamp ambient-lamp--green bg-flow" />
    </div>
  )
}

export interface AmbientIntersectionProps {
  className?: string
}

export function AmbientIntersection({ className }: AmbientIntersectionProps) {
  return (
    <div
      className={cn('ambient-scene pointer-events-none select-none', className)}
      aria-hidden="true"
    >
      <div className="ambient-stage">
        {/* City blocks, then the roads cut through them. Drawing the roads as
            the canvas colour means the junction reads as negative space between
            four lit blocks, which is what a road network looks like from above,
            and it keeps the scene invisible where it should be: on the canvas. */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" role="presentation">
          <rect width="100" height="100" className="fill-elevated" opacity="0.55" />
          <path d="M38 0h24v100H38zM0 38h100v24H0z" className="fill-canvas" />
          {/* Kerbs. Without an edge, two crossing bands of colour are a plus
              sign, not a street. */}
          <path
            d="M38 0v38M62 0v38M38 62v38M62 62v38M0 38h38M0 62h38M62 38h38M62 62h38"
            className="stroke-line"
            strokeWidth="0.5"
            fill="none"
          />
          <ArmPaint rotation={0} turn />
          <ArmPaint rotation={90} />
          <ArmPaint rotation={180} />
          <ArmPaint rotation={270} />
        </svg>

        {STREETS.map((street) => (
          <span key={street.name} className={cn('ambient-approach-label', street.position)}>
            {street.name}
          </span>
        ))}

        {/* One head per approach, on the far side of the junction and on the
            approaching driver's right, which is where the real ones are. */}
        <SignalHead position="left-[32.4%] top-[62.6%]" />
        <SignalHead position="left-[63%] top-[31.8%]" />
        <SignalHead position="left-[32.4%] top-[31.8%]" ew />
        <SignalHead position="left-[63%] top-[62.6%]" ew />

        {LANES.map((lane) =>
          Array.from({ length: lane.slots }, (_, slot) => (
            <Vehicle
              key={`${lane.id}-${slot}`}
              lane={lane}
              slot={slot}
              turning={lane.turn && slot === 0}
              emergency={lane.turn && slot === 1}
            />
          )),
        )}

        {/* Crossing during the all-red, which is the only time anyone may. */}
        {[0, 1, 2].map((slot) => (
          <span
            key={slot}
            data-slot={slot}
            className={cn('ambient-walker ambient-walker--east', `left-[38.5%] top-[35.4%]`)}
          />
        ))}
      </div>
    </div>
  )
}
