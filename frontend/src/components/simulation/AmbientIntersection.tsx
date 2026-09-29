import { cn } from '@/utils/cn'

import './AmbientIntersection.css'

/**
 * The intersection, running behind the login form.
 *
 * Right-hand traffic: on a road running north–south, southbound traffic holds
 * the western half and northbound the eastern one, and the mirror applies to the
 * east–west road. Every lane below is placed from that rule rather than by eye,
 * so the two directions never share a lane and no car crosses the centre line.
 *
 * Inbound lanes start off-stage and stop at the stop line. Outbound lanes start
 * at the far edge of the intersection and drive away, which is why they need no
 * keyframes of their own: they ride the same timeline, because a road runs both
 * ways on the same green.
 *
 * The whole scene is decorative. It carries no state, takes no input, and is
 * hidden from assistive technology — the login form is the page, and this is the
 * evidence that what is on the other side of the door is real.
 */
interface Lane {
  direction: 'down' | 'up' | 'right' | 'left'
  /** East-west approaches run half a cycle behind the north-south ones. */
  ew: boolean
  /** Base position on the stage. */
  position: string
  /** Cross-axis extent of the lane. */
  box: string
  colour: string
}

const INBOUND_LANES: Lane[] = [
  {
    direction: 'down',
    ew: false,
    position: 'left-[46.5%] top-0',
    box: 'w-[3.5%]',
    colour: 'bg-primary/45',
  },
  {
    direction: 'up',
    ew: false,
    position: 'left-[50%] top-[96.5%]',
    box: 'w-[3.5%]',
    colour: 'bg-primary/40',
  },
  {
    direction: 'right',
    ew: true,
    position: 'left-0 top-[50%]',
    box: 'h-[3.5%]',
    colour: 'bg-secondary/45',
  },
  {
    direction: 'left',
    ew: true,
    position: 'left-[96.5%] top-[46.5%]',
    box: 'h-[3.5%]',
    colour: 'bg-secondary/40',
  },
]

const OUTBOUND_LANES: Lane[] = [
  {
    direction: 'up',
    ew: false,
    position: 'left-[50%] top-[56%]',
    box: 'w-[3.5%]',
    colour: 'bg-primary/25',
  },
  {
    direction: 'down',
    ew: false,
    position: 'left-[46.5%] top-[44%]',
    box: 'w-[3.5%]',
    colour: 'bg-primary/25',
  },
  {
    direction: 'left',
    ew: true,
    position: 'left-[56%] top-[46.5%]',
    box: 'h-[3.5%]',
    colour: 'bg-secondary/25',
  },
  {
    direction: 'right',
    ew: true,
    position: 'left-[44%] top-[50%]',
    box: 'h-[3.5%]',
    colour: 'bg-secondary/25',
  },
]

const VEHICLES_PER_LANE = 4

function LaneTraffic({ lane }: { lane: Lane }) {
  return (
    <>
      {Array.from({ length: VEHICLES_PER_LANE }, (_, index) => (
        <span
          key={index}
          data-slot={index}
          style={{ '--queue': index } as React.CSSProperties}
          className={cn(
            'ambient-vehicle aspect-[4/3]',
            `ambient-vehicle--${lane.direction}`,
            lane.box,
            lane.position,
            lane.ew && 'ambient-vehicle--ew',
            lane.colour,
          )}
        />
      ))}
    </>
  )
}

function SignalHead({ position, ew }: { position: string; ew: boolean }) {
  return (
    <div
      className={cn('absolute flex flex-col gap-1', position, ew && 'ambient-head--ew')}
      aria-hidden="true"
    >
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
    <div className={cn('pointer-events-none select-none', className)} aria-hidden="true">
      <div className="ambient-stage relative mx-auto aspect-square w-full max-w-[min(100%,78vh)]">
        {/* Asphalt, kerbs, centre dashes and four crosswalks, drawn rather than
            styled so the line weights stay exact at any stage size. */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" role="presentation">
          <path d="M46.5 0h7v100h-7zM0 46.5h100v7H0z" className="fill-elevated" />
          <path
            d="M46.5 0v46.5M53.5 0v46.5M46.5 53.5V100M53.5 53.5V100M0 46.5h46.5M0 53.5h46.5M53.5 46.5H100M53.5 53.5H100"
            className="stroke-line"
            strokeWidth="0.35"
            fill="none"
          />
          <path
            d="M50 4v40M50 56v40M4 50h40M56 50h40"
            className="stroke-line"
            strokeWidth="0.5"
            strokeDasharray="3 3"
            fill="none"
          />
          {/* Crosswalks sit between the stop line and the intersection, which is
              where a car on red is actually standing. */}
          <path
            d="M44.5 38v-3M47.5 38v-3M50.5 38v-3M53.5 38v-3M44.5 62v3M47.5 62v3M50.5 62v3M53.5 62v3M38 44.5h-3M38 47.5h-3M38 50.5h-3M38 53.5h-3M62 44.5h3M62 47.5h3M62 50.5h3M62 53.5h3"
            className="stroke-muted"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.35"
            fill="none"
          />
        </svg>

        {INBOUND_LANES.map((lane) => (
          <LaneTraffic key={`in-${lane.direction}`} lane={lane} />
        ))}
        {OUTBOUND_LANES.map((lane) => (
          <LaneTraffic key={`out-${lane.direction}`} lane={lane} />
        ))}

        <SignalHead position="left-[56%] top-[34%]" ew={false} />
        <SignalHead position="left-[56%] top-[58%]" ew={false} />
        <SignalHead position="left-[34%] top-[56%]" ew={true} />
        <SignalHead position="left-[58%] top-[56%]" ew={true} />
      </div>
    </div>
  )
}
