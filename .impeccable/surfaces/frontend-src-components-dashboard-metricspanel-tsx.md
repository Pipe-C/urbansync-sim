---
version: 1
slug: "frontend-src-components-dashboard-metricspanel-tsx"
primary_target: "frontend/src/components/dashboard/MetricsPanel.tsx"
related_targets:
  - "frontend/src/services/socket.ts"
  - "frontend/src/store/metricsStore.ts"
  - "frontend/src/hooks/useSimulationClock.ts"
  - "frontend/src/components/dashboard/FlowChart.tsx"
  - "frontend/src/types/metrics.ts"
  - "frontend/src/services/metrics.ts"
  - "backend/app/services/simulation/tick_engine.py"
---

# Live measurement panel (Fase 4) - surface brief

Scope: the dashboard's narrow metrics column, rewired from a pure function of the
tick (`MOCK_sample`) to a **readout of the Socket.io stream** the backend now
emits. It is the one place in the product where the adaptive-vs-fixed comparison
is shown as evidence, so it stays Operate mode inside the existing Control Room
world: no new palette, no new type, no new animation. What is new is that the
numbers can be **live, stale, or absent**, and the panel has to say which. The
canvas and its browser engine are out of scope and untouched.

## Direction contract

THESIS: The panel is the evidence bench beside the monitor. Its job is the
product's whole claim - the same vehicle sequence read by both controllers at
once - so the honest state of that evidence (is it live?) belongs next to the
numbers, not in a footer. A panel that keeps showing the last frame after the
stream dies is the one way this surface can lie, and it is the failure this brief
exists to prevent.

OWN-WORLD: The Control Room, inherited verbatim. Mono + tabular for every measured
value (The Mono Means Measured Rule); teal reserved for the one interactive voice;
Flow Green / Warning Amber / Congestion Red / Emergency Blue reserved for traffic
state only; 1px hairlines and tonal depth. The single addition is a **provenance
strip**: a connection Badge and the engine named in mono, at the head of the
panel. The Badge is read-only status with a text name, never a bare dot.

STORY: The evaluator opens the console mid-run. Above the chart, a strip names the
engine and reports whether the stream is live. The two lines on the chart are the
adaptive and fixed controllers on the same traffic; the gap between them is the
product. If the socket drops, the badge says so and the numbers stop pretending to
be current; when it returns, the strip goes live again without a page reload.

FOCAL MOMENT: the two-series FlowChart driven by real ticks - the same shape the
mock drew, now backed by the algorithm, so the evaluator can point at the delta
and believe it.

## Brief

### 1. Job and audience
The evaluator or operator, mid-run, reading the narrow column beside the canvas to
answer one question: is the adaptive controller ahead of the fixed one, right now,
on this traffic? They are reading evidence, not exploring. Success is being able to
point at the delta and trust it.

### 2. Outcome and proof
- The same arrival sequence read by **both** controllers, live (`adaptive` and
  `fixed` frames in every tick). A single-series panel would be a simulator, not
  evidence.
- Whether the numbers are **live or stale**. A dead socket showing the last frame
  must not read as current - the connection state is part of the evidence.
- The numbers come from the rule-based law (pressure `Sum(1 + waited/12)`, the
  green interlocks, emergency preemption), traceable to a decision. No learned
  policy.

### 3. Selected direction
- Authority: the incumbent tokens and rules above; nothing new invented.
- Thesis: a **provenance strip** at the head of the panel replaces the mock's
  "Simulado" label with what the numbers actually are and whether they are alive
  (PRODUCT.md principle 1, prove don't decorate, applied to the panel's own
  honesty).
- Focal moment and implementation consequence: the panel stops being a pure
  function of `tick` and becomes a stream readout, so it gains loading, stale,
  reconnecting and error states the mock never had.

### 4. Scope and boundaries
- In: `services/socket.ts` (new); the hook that subscribes and samples
  (`useSimulationClock.ts` or a new stream hook); `store/metricsStore.ts` fed by
  real frames; `types/metrics.ts` extended with the stream and connection types; a
  connection/provenance strip in `MetricsPanel.tsx`; `FlowChart.tsx` wired to real
  data. `services/metrics.ts` is **deleted** (decision): with no backend the panel
  shows the error/empty state, never invented numbers.
- Prerequisite (backend, decided): `SimulationEngine` runs **both** controllers
  over the one arrival list and its `tick` carries `adaptive` **and** `fixed`
  frames plus per-approach `queued`/`meanWaitSeconds`, `vehiclesProcessed` and
  `congestedShare` - the exact `MetricsFrame` the panel already expects.
- Untouched: the Three.js canvas and the browser engine behind it; `/config`;
  auth; the reports store's record shape.
- Anti-goals: no fabricated fallback numbers; no new colour; no second looping
  animation (the preemption pulse stays the only one); no retrofitting the canvas
  to the backend.

### 5. States and ranges
- States: idle (no run), connecting, live, stale (connected, ticks overdue),
  reconnecting (socket dropped), error (config rejected / hub at capacity - the
  message from `simulation_status.error`), ended (`session_ended`).
- Ranges: backend ticks at 10 Hz feed the headline numbers; the chart keeps one
  point per 2 s window (`TICK_SECONDS`, to confirm) and 40 points. Queue per
  approach roughly 0-200; waits 0-200 s.
- "Not measured yet" and "measured at zero" stay distinguishable.

### 6. Interaction and layout
- The panel keeps its place: 30% column, drops beneath the canvas below 1024 px,
  single column below 768 px, nothing truncated at 375 px.
- The **provenance strip** sits above the chart: a connection Badge (Live / Stale /
  Reconnecting) plus the engine named in mono. Decision: the connection state
  lives **here**, not in the header.
- The mode toggle keeps its meaning: it selects which of the two already-present
  readings is the live headline (`rebase` semantics unchanged). No animated number
  counting; state changes only.

### 7. Constraints and open decisions
- Provenance copy flips from "Simulado" to the algorithm's own output, and both
  engines are named so a reader cannot confuse which produced what: the canvas is
  the browser model, the panel is the backend model, same law, two realizations.
- Cadence mapping (10 Hz ticks to the 2 s sample window) - confirm whether
  `TICK_SECONDS` changes.
- Build pass loads `craft-floor.md` before editing and runs `impeccable detect`
  once finished, per the skill.
