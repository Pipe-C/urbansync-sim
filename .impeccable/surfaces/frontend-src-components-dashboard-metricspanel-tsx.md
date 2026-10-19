---
version: 2
slug: "frontend-src-components-dashboard-metricspanel-tsx"
primary_target: "frontend/src/components/dashboard/MetricsPanel.tsx"
related_targets:
  - "frontend/src/pages/DashboardPage.tsx"
  - "frontend/src/components/dashboard/SimulationCanvas.tsx"
  - "frontend/src/components/dashboard/TransportControls.tsx"
  - "frontend/src/components/dashboard/ModeToggle.tsx"
  - "frontend/src/components/dashboard/PhaseTape.tsx"
  - "frontend/src/components/dashboard/StrategyComparison.tsx"
  - "frontend/src/components/dashboard/FlowChart.tsx"
  - "frontend/src/hooks/usePhaseSequence.ts"
  - "frontend/src/hooks/useEngineReadout.ts"
  - "frontend/src/store/metricsStore.ts"
  - "frontend/src/store/streamStore.ts"
  - "frontend/src/types/metrics.ts"
  - "frontend/src/types/stream.ts"
  - "frontend/src/services/socket.ts"
  - "frontend/src/simulation/runner.ts"
  - "backend/app/services/simulation/tick_engine.py"
---

# Dashboard console (Fase 6 rework) - surface brief

Scope: the authenticated dashboard as one console, not a metrics widget. The
canvas is the **local** junction, stepped by the browser's runner; the narrow
column is the **backend** measurement, streamed over Socket.io. Both readouts
are real, but they are not the same run and must not be mistaken for it. This
rework moved transport onto the canvas, gave the junction its own instruments,
and rebuilt the panel around the comparison it exists to defend.

## Direction contract

THESIS: One junction, two readouts. The canvas shows what the local model is
doing; the panel shows what the backend measured. The product's whole claim -
the same arrivals read by both controllers - belongs to the panel, and the
panel has to say which engine produced every number and whether the stream is
still alive. A scene without provenance is decoration; a metric without
provenance is a claim.

OWN-WORLD: The Control Room, inherited verbatim. Mono and tabular for every
measured value; Signal Teal only for the one interactive voice (the mode
selector, the primary start); Flow Green / Warning Amber / Congestion Red /
Emergency Blue only for traffic state; 1px hairlines and tonal depth; no
resting shadows. The one piece of new chrome is the **transport strip** on the
canvas bezel and the **phase tape** under the queue bank - both instruments,
not decoration.

STORY: The operator opens the console. The local junction is already running as
a preview (`Vista local`), and the panel waits for a measured run. Pressing
Iniciar opens the backend channel; the panel's badge turns `En vivo`; the
canvas transport starts its clock. The local readout answers "what is the
junction doing"; the panel answers "what did the backend measure, and which
policy is ahead". If the socket drops, the panel says so and stops implying its
last frame is current. The mode selector changes which reading is headlined,
never which world is running.

FOCAL MOMENT: The wait comparison in the panel - the one number the product
rests on - read beside the two raw seconds and under a named engine. On the
canvas, the phase tape and the four queue cells are the supporting evidence:
the adaptive controller's sequence is visibly irregular, and the worst queue
is visible without opening a tooltip.

## Brief

### 1. Job and audience

The evaluator or operator, mid-run, with the junction in front of them and the
backend's evidence beside it. They need to answer three questions quickly:
what is the local junction doing now, which policy is ahead, and can I trust the
numbers on screen? They are reading an instrument panel, not exploring a
dashboard. Success is being able to point at the wait delta and at the phase
sequence and explain both.

### 2. Outcome and proof

- **Local vs backend, named.** The canvas carries `Motor local`; the panel
  carries `Motor del backend` and the p95 / last one-way latency read from
  `sentAt`. The local scene is stepped by `useEngineReadout`; the panel reads
  `metricsStore` fed by the socket.
- **The comparison is real and mode-safe.** `StrategyFrame` carries both
  policies; `vehiclesProcessed` is a per-policy map; the active reading is
  selected by `simulationStore.mode`. The wire's `queue`, `congestedShare` and
  `preemption` describe the backend's active-at-start policy and are **not**
  used for the dashboard instruments - the local canvas uses the runner's
  `queued`/`wait`/`served`/`longestWait` instead, so no number crosses the
  boundary.
- **The adaptive sequence is visible.** `PhaseTape` records `activeArm` changes
  from the local readout. It answers "in what order", not "for how long": the
  readout cadence cannot support a duration claim, so the tape is a sequence of
  states, with `R` for all-red.
- **Empty is not zero.** Before a run the panel prints `—`, not `0 s` or
  `0 veh/min`; the chart says when its series starts; the table hides its bar
  tracks when a value is absent (including emergency response).
- **A dead channel cannot masquerade as live.** The panel badge and provenance
  strip distinguish connecting, live, stale, reconnecting and error.

### 3. Selected direction

- **Transport belongs to the subject it starts.** Iniciar / Pausar / Reanudar /
  Detener, the run badge and the elapsed clock sit under the canvas header, not
  at the bottom of the metrics column. The old `SimulationControls` was split:
  `TransportControls` owns the run; `ModeToggle` selects a reading and lives at
  the head of the panel. A control that does not start or stop anything does
  not sit with the transport.
- **The canvas is instrumented, not just rendered.** A phase chip (top-left),
  the local `En cola` / `Espera máx.` summary (top-right), a four-cell queue
  bank with an active-phase 2px top marker and a scale of 0-max(12, ceil(max/4)*4),
  the recent phase sequence, and the controller's current rule. The queue bank
  is the breakdown of the summary; both come from the same readout.
- **The panel promotes the claim and demotes the evidence.** The wait delta is
  the headline, with both raw values beside it. The remaining quantities are a
  three-column table - Atendidos, Caudal, Cola máx., Emergencia - with
  per-row bars. Wait is not repeated there; it already has the headline.
- **The baseline stays visible when the series coincide.** The chart draws the
  adaptive line first and the dashed fixed line last; an equal run shows both
  strokes instead of hiding the baseline under the green. The y-axis starts at
  0 with a 100 top tick, so a 91 veh/min run still has a tick above it.
- **The panel's toggle is a reading selector.** The sentence under it says
  "Cambia la que estás leyendo, no lo que ocurre en el cruce." The sliding teal
  plate marks the selected reading; no number counts up, no bar tweens.

### 4. Scope and boundaries

- In: `DashboardPage`, `SimulationCanvas`, `TransportControls`, `ModeToggle`,
  `PhaseTape`, `usePhaseSequence`, `MetricsPanel`, `StrategyComparison`,
  `FlowChart`, the dashboard barrel, the `ExternalLinkIcon`, and the shell
  fixes that surfaced while wiring the dashboard (live connection in the
  TopBar, sticky sidebar, tooltip alignment).
- Untouched: `frontend/src/simulation/core/` and the backend tick engine. No
  engine gate was required.
- Anti-goals: no fabricated fallback numbers; no second clock; no new palette;
  no new looping animation inside the console; no animated number counting; no
  bar width tween; no waiting metric built on the wire's policy-scoped fields.

### 5. States and ranges

- Connection: idle (no run; the local scene still previews), connecting, live,
  stale (socket up, ticks overdue), reconnecting, error (the socket is down).
  The panel badge folds the run's paused state into the same label; the
  provenance sentence says what the channel is doing.
- Run: idle, running, paused. Stop resets the local world and the elapsed clock;
  the phase tape is not cleared by Stop because the local engine keeps running
  in preview.
- Values: waits in seconds; throughput in veh/min; queues in vehicles. The
  local queue scale is a rendering floor, not a threshold. The table's bars are
  scaled per row, with a floor that never changes the printed value.
- Empty states: the dashboard opens on `Vista local` / `Inicia para medir el
  cruce`; the panel prints `—` and the chart's series note; the idle chart does
  not invent a flat line.

### 6. Interaction and layout

- Desktop: 70/30 grid; the canvas has a 32rem minimum; the metrics column is
  sticky below the canvas so the claim stays beside the scene while the chart
  scrolls. The sidebar is sticky at `lg` with a full-height column; its footer
  stays in the viewport instead of falling to the document bottom.
- Mobile: one column, canvas first, panel second. The phase tape and phase chip
  remain visible at 375px; the queue bank reflows to two columns; the transport
  wraps its status line rather than clipping. Tooltips pin to the right edge
  and open downward at the top bar and canvas so they do not create horizontal
  scroll or clip against the card.
- Keyboard: the mode toggle uses a roving radio group; the canvas badge and the
  connection badge are focusable and expose their tooltip text via
  `aria-describedby`; the phase tape's list items carry the phase name and
  `aria-current` instead of a bare letter.
- Reduced motion: the only animations left are state-change fades, the toggle
  plate transition and the existing emergency pulse; nothing loops. The global
  reduced-motion rule applies.

### 7. Constraints and open decisions

- The hard boundary is **local engine vs backend algorithm**. The page copy and
  the two provenance labels are part of the instrument, not marketing.
- The phase tape is a sequence, not a timeline. Do not add durations or a
  playhead; the readout publishes at 4 Hz and a duration would be a second,
  quieter lie.
- The chart's 0-100 scale is a visible context, not a cap: a run above 100
  expands the axis, and the table remains the exact reading.
- The comparison is the backend's same-arrivals run; the local scene is a
  preview of the same control law, not the measurement.
- Verification for this slice: `npm run build` green; `oxlint` only the
  pre-existing `scripts/` warnings; `prettier --check` clean on the touched
  files; `impeccable detect --json` returns `[]`; headless Chrome at 1440x1000
  and 375x812, idle and running, no console errors; the 375px overflow probe
  returns no offenders. The user's own browser look remains pending.
