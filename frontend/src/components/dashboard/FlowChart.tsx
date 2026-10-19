import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'

import type { FlowSample } from '@/types/metrics'

/**
 * Throughput over time, both strategies, always.
 *
 * The two series are the point. A chart with one line would show a number
 * moving and prove nothing; the claim this product makes is comparative, so the
 * comparison has to be on screen rather than in a footnote. The adaptive line
 * sits above the fixed one for the whole run, and the vertical distance between
 * them is the product's entire argument rendered as a shape.
 *
 * Colours come from the Tailwind palette through the CSS variables published by
 * `tailwind-palette-vars.js`, so the series and the badges cannot drift apart.
 * Both are also named in the legend and in the tooltip, so the chart is fully
 * readable without relying on colour at all.
 */

const ADAPTIVE_STROKE = 'rgb(var(--color-flow))'
const BASELINE_STROKE = 'rgb(var(--color-muted))'

/**
 * Fixed so the two lines stay comparable. An auto domain would rescale on every
 * tick and the gap between the series would appear to change even when the
 * traffic did not, which is exactly the wrong way for a comparison to lie. A
 * run above 100 expands the axis, but the visible context starts from zero so
 * a line near the top still has a tick above it.
 */
const Y_DOMAIN: [number, number] = [0, 100]

/**
 * The tooltip is typed from Recharts' own props rather than declaring its own,
 * because the two disagree about which of `active`, `payload` and `label` are
 * required — and a hand-written interface that marks a field Recharts considers
 * mandatory optional fails to type-check at the call site instead. The values
 * are coerced rather than asserted, since `ValueType` is wider than a number.
 */
function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) {
    return null
  }

  const rows = payload
    .filter((entry) => entry.dataKey === 'adaptive' || entry.dataKey === 'fixed')
    .map((entry) => ({ key: String(entry.dataKey), value: Number(entry.value) }))
    .filter((row) => Number.isFinite(row.value))

  if (rows.length === 0) {
    return null
  }

  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 shadow-popover">
      <p className="font-mono text-micro uppercase text-muted">
        t+{Math.round(Number(label ?? 0))}s
      </p>
      <dl className="mt-1.5 flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: row.key === 'adaptive' ? ADAPTIVE_STROKE : BASELINE_STROKE }}
            />
            <dt className="font-mono text-micro uppercase text-secondary">
              {row.key === 'adaptive' ? 'Adaptativo' : 'Ciclo fijo'}
            </dt>
            <dd className="tabular ml-auto font-mono text-xs text-primary">{row.value} veh/min</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export interface FlowChartProps {
  history: FlowSample[]
  className?: string
}

export function FlowChart({ history, className }: FlowChartProps) {
  const last = history[history.length - 1]

  return (
    <div className={className}>
      {/* The legend is not decoration: it is what makes the chart readable
          without colour vision, and it names the baseline explicitly so a reader
          does not mistake the lower line for noise. */}
      <ul className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {[
          { label: 'Adaptativo', colour: ADAPTIVE_STROKE },
          { label: 'Ciclo fijo', colour: BASELINE_STROKE },
        ].map((series) => (
          <li key={series.label} className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-4 rounded-full"
              style={{ background: series.colour }}
              aria-hidden="true"
            />
            <span className="font-mono text-micro uppercase text-secondary">{series.label}</span>
          </li>
        ))}
      </ul>

      <div className="relative h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={history}
            margin={{ top: 4, right: 4, bottom: 0, left: -18 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="rgb(var(--color-line))" strokeDasharray="2 5" vertical={false} />
            <XAxis
              dataKey="t"
              tickFormatter={(value: number) => `${value}s`}
              stroke="rgb(var(--color-line))"
              tick={{ fill: 'rgb(var(--color-muted))', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              domain={Y_DOMAIN}
              stroke="rgb(var(--color-line))"
              tick={{ fill: 'rgb(var(--color-muted))', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
              width={46}
            />
            <Tooltip
              content={ChartTooltip}
              cursor={{ stroke: 'rgb(var(--color-line-strong))', strokeWidth: 1 }}
            />
            {/* The baseline is drawn last so that, when the two series coincide,
                its dashes stay visible over the adaptive stroke instead of
                disappearing beneath it and implying only one series reported. */}
            <Line
              type="monotone"
              dataKey="adaptive"
              stroke={ADAPTIVE_STROKE}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3.5, fill: ADAPTIVE_STROKE, stroke: 'none' }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="fixed"
              stroke={BASELINE_STROKE}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 3, fill: BASELINE_STROKE, stroke: 'none' }}
              isAnimationActive={false}
            />

            {/* The current reading, marked at the end of each line. It moves
                when the series advances; it does not animate, because the line
                is a measurement and a travelling dot would be choreography. */}
            {last && (
              <ReferenceDot
                x={last.t}
                y={last.fixed}
                r={2.5}
                fill={BASELINE_STROKE}
                stroke="none"
              />
            )}
            {last && (
              <ReferenceDot
                x={last.t}
                y={last.adaptive}
                r={3}
                fill={ADAPTIVE_STROKE}
                stroke="none"
              />
            )}
          </LineChart>
        </ResponsiveContainer>

        {history.length === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <p className="rounded-md bg-surface px-3 py-2 text-center font-mono text-micro uppercase tracking-wider text-muted">
              La serie empieza a los 2 s de ejecución
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
