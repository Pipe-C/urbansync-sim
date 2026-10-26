# PLAN.md — UrbanSync Sim
## Implementation Roadmap

> Living document. Update sprint status as work progresses.
> Current focus: **Phase 6 — Polish**, the visual pass, in progress. Phases 1–4
> are closed and verified (frontend, backend, algorithm and realtime all
> shipped; the dashboard reads the real streamed metrics). Sprint 1-H is closed.
> The visual polish the user asked for has started — dotted turn guides and a
> continental zebra (`70c9016`), a strategy comparison rack and a live latency
> readout (`1c9375e`), a landing redesigned as a three-move argument (`5df96ac`),
> and a **full dashboard rework** that moves transport onto the canvas, instruments
> the junction with a phase tape and queue bank, and rebuilds the metrics column
> around the wait comparison (`271b44a`, `7b64752`, `79cc111`; see the Phase 6
> status block). Still open: the user's browser check at 375px/1440px, reduced
> motion and keyboard.

---

## Phases overview

| Phase | Name | Status | Outcome |
|---|---|---|---|
| 1 | Frontend Foundation | ✅ Complete | Visual shell + simulation canvas running |
| 2 | Backend API | ✅ Complete | REST endpoints + auth working |
| 3 | Simulation Algorithm | ✅ Complete | Adaptive logic running in backend |
| 4 | Real-time Integration | ✅ Complete | Frontend ↔ Backend live via Socket.io |
| 5 | Persistence + Reports | ✅ Complete | Runs stored per user, CSV/PDF exportable |
| 6 | Polish + Deploy | 🟡 In progress | Visual polish started; deploy pending |

### Sprint 1-A status — ✅ complete

Delivered: Vite 8 + React 19 + TS 6 scaffold, TailwindCSS v3 with the
`DESIGN.md` token set, `@/` path aliases, oxlint + Prettier, `.env.example`,
`PRODUCT.md` + `DESIGN.md`, and the folder structure from `AGENTS.md`.

Deviations from the original plan, both confirmed with the user:
**React 19** instead of React 18, and **oxlint** instead of ESLint. The
rationale is recorded in `PRODUCT.md` § Stack.

### Sprint 1-B status — ✅ complete

Delivered: the full `src/components/ui/` library (`Button`, `Badge`, `Card`,
`Stat`, `Spinner`, `EmptyState`, `ErrorBoundary`, `Tooltip`, plus a hand-inlined
`Icon` set) and `src/components/layout/` (`AppShell`, `Sidebar`, `TopBar`,
`PageHeader`). `src/App.tsx` currently hosts a temporary harness page so the
library and the shell could be checked in a browser; Sprint 1-C replaces it with
the real route tree.

`impeccable audit` ran over the library. The bundled detector returned **zero**
findings; the manual pass scored **16/20** and found two real violations of the
design system, both fixed and both now written into `DESIGN.md` as binding
rules:

- **P1 — blurred translucent panels.** `TopBar` and the mobile scrim used
  `backdrop-blur` over a translucent fill, which `DESIGN.md` explicitly forbids.
  Both are now opaque.
- **P1 — inverted heading hierarchy.** The document `h1` sat on the `TopBar`
  route label at `text-sm`, demoting the real page title to an `h2` at `text-xl`.
  `PageHeader` now owns the single `h1` at a new `display` size token, `TopBar`
  renders plain text, and `Card` titles are `h2`.

Deferred, recorded below rather than fixed now:
- **P2 — `Tooltip` is unreachable by touch.** It opens on hover and
  `focus-within`, so at 375px the explanation on a disabled control cannot be
  read. Handled in Sprint 1-F by putting the download explanation in visible
  text beside the button; the component's docstring carries the contract:
  anything essential must also appear in the element's own label.
- **P3 — `Spinner` is static under `prefers-reduced-motion`.** Closed in
  Sprint 1-G: the spinner trades rotation for a slow opacity breath under the
  media query (see that sprint's status block).

---

## Phase 1 — Frontend Foundation

**Goal:** A fully navigable frontend with the simulation canvas running the real
engine (mock metrics until Fase 3), styled with Impeccable, responsive, dark-mode,
production-quality.

**Stack active in this phase:**
React 19 · TypeScript · Vite 8 · TailwindCSS v3 · Three.js · Zustand ·
Recharts · React Router · socket.io-client (mocked) · oxlint + Prettier ·
Impeccable

---

### Sprint 1-A — Project scaffolding
*Target: working skeleton before writing a single feature component.*

- [x] Init Vite project: `npm create vite@latest frontend -- --template react-ts`
- [x] Install and configure TailwindCSS v3
- [x] Install Impeccable: `npx impeccable install` → then `/impeccable init` in Claude Code
- [x] Fill `PRODUCT.md`: audience = students + professors + urban planners;
      goal = demonstrate adaptive traffic light algorithm
- [x] Fill `DESIGN.md`: dark theme, navy/teal/amber palette, Inter font
- [x] Configure path aliases in `vite.config.ts` (`@/` → `src/`)
- [x] Configure absolute imports in `tsconfig.json`
- [x] Set up ESLint + Prettier with strict rules — **oxlint + Prettier**, see Sprint 1-A
- [x] Install core dependencies:
      ```
      npm i zustand axios socket.io-client recharts three
      npm i -D @types/three @types/node
      ```
      **Superseded:** this line originally installed `phaser`. The 2D → 3D decision
      (see Sprint 1-E status) replaced the renderer, so Phaser is not a dependency of
      this project. See `CONTINUIDAD.md` § SIGUIENTE 3 for why the engine was built
      renderer-free before the renderer was chosen.
- [x] Create folder structure as defined in AGENTS.md
- [x] Commit: `chore: project scaffolding` — split across 4 commits per the
      dependency order in `GUIA_COMMITS.md`

---

### Sprint 1-B — Design system and base components
*Target: a component library that every page will use.*

Before building any component, run:
```
/impeccable design base UI component library for urban intelligence dashboard
```

**Base components to build (`src/components/ui/`):**

- [x] `Button` — variants: primary, secondary, ghost, danger; sizes: sm, md, lg
- [x] `Badge` — variants: green (flowing), amber (moderate), red (congested), blue (emergency)
- [x] `Card` — container with consistent padding, border, optional header
- [x] `Stat` — metric display: value (large) + label + optional trend arrow
- [x] `Spinner` — loading indicator used throughout
- [x] `EmptyState` — illustrated empty state with title + description + optional action
- [x] `ErrorBoundary` — catches render errors, shows recovery UI
- [x] `Tooltip` — lightweight wrapper around a native title or custom overlay
- [x] `Icon` — hand-inlined set, not a dependency; see `Icon.tsx` for the rationale

**Layout components (`src/components/layout/`):**

- [x] `AppShell` — root layout: sidebar + top bar + main content area
- [x] `Sidebar` — navigation links, collapsed state on mobile
- [x] `TopBar` — page title, user avatar, connection status indicator
- [x] `PageHeader` — title + description + optional action button (right-aligned)

After building: `impeccable audit` on the component library. **Done — see the
Sprint 1-B status block above for the score and the two P1 fixes.**

---

### Sprint 1-C — Authentication screens
*Target: login page that validates credentials and redirects.*

Designs first:
```
/impeccable design login page for a dark-mode city intelligence app
```

- [x] `LoginPage.tsx` — email + password form, error handling, loading state
- [x] `authStore.ts` (Zustand) — `{ user, token, login(), logout(), isAuthenticated }`
- [x] `useAuth.ts` hook — wraps store, exposes clean API to components
- [x] `ProtectedRoute.tsx` — redirects unauthenticated users to `/login`
- [x] Mock auth service: `services/auth.ts` returns a fake JWT
- [x] React Router setup: `/login`, `/dashboard`, `/config`, `/reports`

**Acceptance criteria:**
- [x] Login with `admin@urbansync.sim` / `admin123` works (mock)
- [x] Failed login shows inline error, not a page redirect
- [x] Loading state visible while "request" is in flight
- [x] Redirects to `/dashboard` on success

### Sprint 1-C status — ✅ complete

Delivered, in the dependency order `GUIA_COMMITS.md` requires:
`types/auth.ts` → `store/authStore.ts` → `services/auth.ts` → `hooks/useAuth.ts`
→ `routes/` → `pages/LoginPage.tsx`. The Sprint 1-B harness in `App.tsx` is
gone, replaced by a real route tree, and `/login` is reachable at a deep link.

Three things beyond the sprint list, each with a reason:

- **`ui/Field.tsx` was built here, not in Sprint 1-B.** `DESIGN.md` specified
  inputs from the start but Sprint 1-B's component list left them out, and a
  login form cannot be built without one. It is where the `lineStrong` token
  from Sprint 1-A finally gets used, which is what that token was for.
- **`services/auth.ts` fails slowly and asynchronously on purpose.** A
  synchronous mock would let the page ship with a loading state and an error
  state that had never actually run, and those are the states a demo is judged
  on. The store's `login` resolves to `null` on failure rather than rejecting,
  so the page's error path is a return value and not an exception handler.
- **`/dashboard`, `/config`, `/reports` and `/observer` render one honest
  placeholder component** that names the sprint that will build it. They do not
  render plausible zero-valued metrics; a stub that fakes evidence teaches an
  evaluator that the product invents numbers, which is the one thing
  `PRODUCT.md` § Evidence forbids.

Design decisions taken with the user before any code was written:

1. **The login is a panel beside a running intersection**, not a card centred on
   an empty canvas. The category default for a login is a centred box; this one
   shows the product working before a character is typed.
2. **The demo credentials are on screen and fill the form on click.** The
   project is evaluated by opening the URL live, and an evaluator should never
   have to go looking for a password.
3. **The looping intersection is an explicit, recorded exception** to the
   design system rule that nothing loops. The rule's purpose is concentration
   inside the console; the login has no console and nothing to compete with. The
   exception and its reasoning are written into `DESIGN.md` § Login so a later
   sprint cannot quietly widen it.

**Known weak, queued for its own pass — not covered by Sprint 1-D:**

Reviewed on screen, the login read as flat, and the user named the reason
precisely: at the junction "you cannot really tell what is happening, they are
just squares moving". The structure was sound but the scene was not doing its
job, and the layout had a third problem — the panel was a fixed 26rem beside an
elastic canvas, so nothing related the two at any viewport other than the one it
was tuned at.

- [x] **Make the junction legible.** The root cause was a timing bug, not a
      styling one: the discharge window in the vehicle keyframes overlapped the
      red it was supposed to obey, so cars were visibly running the lights. A
      demo of a traffic control product that ignores traffic lights is arguing
      against itself, and no amount of road paint would have hidden it. Rebuilt
      on a real four-phase cycle — green, amber, all-red, then the other axis
      half a cycle behind — with the lamp windows and the vehicle windows
      reading against each other in one place.
- [x] **Give the scene something to be.** It is now a place rather than a
      diagram: four named streets, kerbs, crosswalks, a marked right-turn
      pocket, a car that actually turns, three pedestrians who are the visible
      reason the cycle has an all-red interval, and one emergency vehicle whose
      beacon pulses on its own clock rather than in step with the signal.
- [x] **Give the viewer something to do — then take it back.** This was shipped as
      a hover-to-freeze: hovering a vehicle held it where it stood and named the
      approach it was queueing on. It is now removed. A car that stops for exactly
      as long as the pointer rests on it reads as a fault in the simulation, and on
      the login page the pointer crosses the background the whole time someone is
      typing a password. It also made part of an `aria-hidden` decorative scene
      respond to input while the rest ignored it. Stopping traffic by hand belongs
      to the real engine in Sprint 1-E, where there is a control to click.
- [x] **Let the panel adjust.** The split is now `clamp(22rem, 34%, 34rem)`
      instead of a fixed column, with a floor that keeps the form readable on a
      laptop and a ceiling that stops it swallowing a 4K monitor. Both columns are
      pinned to the viewport so the form and the junction are the same height by
      construction rather than by coincidence.

Still to do on this screen: the type hierarchy between the product mark, the
`Canal 01` eyebrow and the `h1` is flat — all three read at the same weight — and
the left panel is a bare column of form controls where the rest of the console is
dense. That is a `/impeccable polish` pass over the route, not a rewrite, and it
is still open.

**Not verified, and it should be before this is called done:** no browser is
installed in this environment, so `impeccable detect` could only scan source, not
the rendered page, and no screenshot round was possible. The login has been
checked by types, by the build and by reading the geometry, not by looking at it.
The mobile composition at 375px in particular is unconfirmed.

---

### Sprint 1-D — Dashboard layout and metrics panel
*Target: the main screen skeleton with real-looking mock data.*

```
/impeccable design dashboard with real-time traffic simulation panel, metrics sidebar, dark mode
```

**Dashboard structure:**
```
┌─────────────────────────────────────────────────────────┐
│  TopBar: UrbanSync Sim · [connection status] · [user]   │
├───────────┬─────────────────────────────────────────────┤
│           │                                             │
│  Sidebar  │  Simulation Canvas (Three.js)   70% width  │
│           │                                             │
│  Nav:     ├──────────────── 30% ────────────────────────┤
│  Dashboard│  Metrics Panel                              │
│  Config   │  ├── Stat: avg wait time                    │
│  Reports  │  ├── Stat: vehicles processed               │
│           │  ├── Stat: EVP response time                │
│           │  ├── Chart: flow over time (Recharts)       │
│           │  └── Controls: Start / Pause / Stop         │
└───────────┴─────────────────────────────────────────────┘
```

Tasks:
- [x] `DashboardPage.tsx` — assembles the layout above
- [x] `MetricsPanel.tsx` — 3 `<Stat>` cards + `<FlowChart>` (Recharts LineChart)
- [x] ~~`SimulationControls.tsx`~~ — split into `TransportControls.tsx` (run
  lifecycle on the canvas bezel) and `ModeToggle.tsx` (reading selector in the
  panel; does not change what the junction runs)
- [x] `metricsStore.ts` (Zustand) — holds mock metrics, updated on interval
- [x] Mock metrics generator: updates every 2s with plausible values
- [x] `simulationStore.ts` (Zustand) — `{ status, mode, config, state }`

### Sprint 1-D status — ✅ complete

Delivered in four commits, in the order `GUIA_COMMITS.md` requires:
`tailwind-palette-vars.js` → `stores` → `pages`.

> `services/metrics.ts` was written here and deleted in Phase 4 when the live
> stream replaced it. `useSimulationClock` was the mock ticker; the canvas runner
> (`runner.ts`) is the model's real clock. Both are gone from the codebase.

**Routes.** `/dashboard` renders `DashboardPage` inside the shell.
`/observer` is public, shell-less, and starts itself, so a projector or a second
screen can follow a run without authenticating.

**One clock.** The engine's RAF runner in `runner.ts` is the only thing that
advances the simulation — no second ticker exists inside the console. The panels
read state from the runner's readout cadence (4 Hz) and from `metricsStore` fed
by the socket.

**Verified numerically, not by eye.** `vehiclesProcessed` integrates the flow
curve per strategy and was checked monotonic across 60 ticks, which is the one
property a cumulative counter can silently lose. `lastSampledTick` lives in
`useMetricsStore` and `sample` is a no-op on a repeat tick, so remounting a
panel — which React does on every route change — no longer appends a duplicate
point to the chart.

**Two things that were wrong and are not obvious from the code.** The wait-time
delta was green whenever it was positive, which is a chart that praises a
regression; it now reads amber when the active strategy is worse. And the palette
was reaching Recharts as raw hex because a CSS custom property cannot be handed
to `stroke` as-is, so the chart layer was a second, unversioned copy of the
colours; the tokens are now emitted as RGB channels and the charts read
`rgb(var(--color-flow) / <alpha>)`.

**Carried into Sprint 1-E.** `SimulationCanvas` is a labelled placeholder around
`AmbientIntersection`, not a renderer. It is deliberately built to accept the real
scene in its place, and the scene inside it is paused by the transport control
rather than restarted by it.

### The ambient scene pass — review findings

Reviewed on screen by the user, who liked the dashboard and observer composition
and disliked the scene in it. Four of the five reports were geometry and timing
rather than taste, and each traced to a specific number:

- **A vehicle welded to the lower edge.** The fourth queue slot computed a stop
  position of `24.3 − 3 × 10.5 = −7.2cqh`, i.e. negative, so the car was parked
  with its tail off the bottom of the frame. The queue is three cars, and the cap
  is arithmetic rather than taste.
- **Cars reappearing at their stop position.** The exit keyframes parked the car
  off-stage and jumped back to the mouth of the junction at `0%` with no opacity
  change, a jump of most of the scene's length. Every keyframe now animates
  `opacity` with its `transform`, and the hidden reposition is two car lengths so
  nothing is ever visible while off-stage.
- **The junction appearing dead on the dashboard and observer.** The stage was
  `aspect-ratio: 1` with `max-width: 92vh`, so on a canvas wider than it was tall
  the stage was taller than its panel and got clipped — the queue, which lives at
  the bottom, was cut off. The stage is now the largest square that fits its
  panel, centred, and a second container was introduced so the `cqh`/`cqw` units
  resolve against the junction rather than the viewport. The junction is fitted
  and never stretched: the two carriageways are the same width in reality.
- **Vehicles that stopped on their own.** This was the hover-to-freeze described
  above, not a keyframe fault.

One further bug was found while reading the timing rather than the screen: the
per-slot animation delays were negative, which is the half-cycle offset read the
other way round, so the car at the back of the queue crossed the junction before
the one it was queueing behind. The crossing window was also widened to 22% of the
cycle so that the last of three cars is clear of the box before the signals go
red at 36% — the alternative was a queue discharging on a red.

Geometry and timing were checked with a throwaway script that models the CSS in
stage-percent units, since nothing in the toolchain reads `cqh` arithmetic. It
confirms no parked car bleeds off the frame, every fade happens while the car is
still on screen, and all six queued cars clear before the red on both axes.

**Still not verified by looking at it:** there is no browser in this environment,
so the redesigned vehicles — body, glasshouse, lamps, wheels — and the dissolve
have been checked by types, by the build and by reading the numbers, not on
screen. That is the outstanding risk on this pass and the reason the commit is
held back rather than pushed.

After building: `impeccable polish` on DashboardPage.

---

### Sprint 1-E status — 🟢 engine closed · 0 overlaps in 8 seeds at both demands

The simulation **engine** (`src/simulation/core/`) is written and verified, and the
overlap count is **0 at both demands across all 8 seeds**. The renderer was started
only after that gate was green: the engine ran ahead of it because the safety
invariants had to be provable before anything was drawn on top of them — and closing
them turned up five further defects, none of which was visible from the outside.
The renderer itself is now written too; see **Sprint 1-E canvas status** below.

**The defect that gated the rest, and how it was closed.** At near-capacity demand
the permissive left turn collided with the opposing through movement
(`east-0:left` × `west-0:through`). Five attempts at tuning the timing arithmetic
failed; all are in `CONTINUIDAD.md` with numbers. Root cause: the decision
compares two time estimates and both err in the unsafe direction (own clearance
3,5 s vs ~5,2 s real; opponent `arrivalTime` 7,1 s vs ~3,4 s real).

**Chosen fix — protected left turn phase**, decided with the user:

- A left phase serves **both opposing lefts of one axis together**
  (`north-0:left` + `south-0:left`), which is safe because the conflict table says
  those two do **not** cross each other. Verified by `scripts/left-conflicts.ts`
  before any code was written.
- It blocks all 13–14 movements that do conflict, so `east-0:left × west-0:through`
  disappeared **by construction** rather than by better arithmetic. Confirmed: 0.
- Real signal engineering: a leading/lagging protected left is how an
  intersection with a continuous opposing flow actually works.

**What building it found — two of these were mine, and neither was visible by reading:**

- **The phase never ran.** 0 left phases in 73 phase changes. `pressure()` counted
  with `s < stopS`, and a vehicle stopped *on* the line fails `76,0 < 76,0`, so the
  hungriest car was the one the controller could not see. Worst wait hit 592 s.
  Fixed to `stopS + 0,05` — the definition `boxConflict` and `holdForBodyConflict`
  already used.
- **A false safety violation.** Fixing the above produced 11 red-entries. Not the
  model: `verify-model` and `red-entry.ts` asked the aspect **per arm**, and during
  a left phase `aspects()` is all red, so they counted left-turners released on a
  green arrow. Both now ask **per movement** via `controller.aspectFor(arm, turn)`.
- **A second, older defect, uncovered.** All remaining overlaps are one pair:
  `:left × :right` on the same arm, both stopped — an 11,2 m bus turning right on
  the outer lane sweeping across a car parked at the adjacent lane's stop line.
  The two do not cross, so this is turn-radius geometry and no signal rule reaches
  it. It was underneath the permissive-left defect the whole time.

**Measured, not guessed:** the rule for when a left phase may take a phase away
from the arm that would otherwise be served. Both obvious versions fail — the
arrow must outrank the throughs (never fires, a left is 1 movement in 6) or fire
on its own clock (collapses: `served` = 13). `scripts/left-share.ts` measures the
real ratio distribution (0,142–0,317, median 0,275) and `LEFT_SHARE_OF_DENIED` is
set from it, not chosen.

**Closing the count to 0 turned up five more defects, and every one of them looked
like a junction that was simply saturated.** That is the trap worth recording: in
all five, `served` stopped rising and the box was empty, which reads as capacity and
is actually an arbitration that cannot resolve. None was found by reading the code.

- **The amber was a relief valve, and it was masking four deadlocks.** Perception-
  reaction was charged as a flat 2,5 m regardless of speed, so a vehicle at rest
  was handed stopping distance it did not need and released straight off the line
  on amber. Reaction is a *time*, so it is now `v * REACTION_SECONDS`
  (`world.ts:661`): 2,5 m at 5 m/s, zero at rest, and a stopped vehicle is never
  released into a conflict the green had correctly refused it. Fixing it cost
  58 → 0 overlaps and, immediately, half the throughput — because the malformed
  amber had been quietly draining queues and unsticking mutual blocks for free.
- **A vehicle could be told to stop behind its own nose.** `clearingJunction`
  asked whether the vehicle's *centre* was in the box while `occupiesBox` asked
  about its *body*. A car with 1 m of nose across the line counted as a blocker —
  holding the signal for everyone else — while being pinned to a hold point 1,06 m
  *behind its own front bumper*, which it cannot reach without reversing. Two of
  those and the junction stopped dead. Both now ask one definition (`world.ts:1844`).
- **The starvation guard was dead code.** `age` was only consulted between arms
  whose pressures were *exactly* equal, which on a float is a coincidence that never
  happens; and it reinforced the wrong way — an arm served keeps the most pressure,
  keeps the most waiting vehicles, and so wins every following green. Measured:
  `east` took every green from 69 s on and `served` froze at 54. Now bounded by
  `MAX_CONSECUTIVE_SKIPS` (`controller.ts:92`).
- **The protected left phase could be unservable by construction.** Lane 0 carries
  left turns *and* through movements (`layout.ts:26`, two lanes per direction is a
  PRODUCT.md commitment), so a left-turner is queued behind the through traffic in
  its own lane and `gapAhead` makes it wait for it whatever the signal says. A
  through car standing on the line is therefore a blocker the arrow cannot get past
  — because the arrow is what holds that car there. Granted in that state, the arrow
  empties nothing, times out, and is requested again: a livelock, with the through
  phase never coming round either. Real signals clear the shared lane first, and so
  does this one (`ControllerInput.leftReady`).
- **A permissive left yielded to a queue that would never arrive.**
  `stillApproaching` decided by position alone — and a stream stopped at a red on the
  far side is short of the crossing and always will be, so a standing queue read as
  a permanent threat. The turner never moved, so it never cleared, so the vehicle
  clearance interlock held the all-red, which is the only state in which the
  controller picks whom to serve next — and the stream it was politely waiting for
  never got its green. Measured: a west left sat **439 s** inside the junction
  yielding to an east through queue that had been standing the whole time. Now the
  test is whether anything on that stream is *rolling*; two standing bodies are
  ordered by `holdForBodyConflict`, which is the test that belongs to them.

`PRESSURE_HORIZON` (120 s) is the backstop behind these: uncapped, `waited` is
self-reinforcing, because the longest-waiting vehicle exerts the most pressure and is
therefore served first, and the queue behind it never accumulates enough to be
served at all. Capping it makes the comparison one about the present and lets `age`,
which does rotate, decide among vehicles that are equally stuck.

**Measured, not guessed:**

| | before | after |
|---|---|---|
| overlaps, 8 seeds, default | 58 | **0** |
| overlaps, 8 seeds, calibrated | 36 | **0** |
| served, 8 seeds, default / calibrated | 437 / 540 | **1167 / 1102** |
| `verify-model` 10 min, seed 7, served | 151 | **319** |
| `verify-model` 10 min, seed 7, longest wait | 119,1 s | **35,3 s** |

`verify-model` seed 7 now reports `overlaps 0, teleports 0, entered on red 0,
order violations 0, reverse motion 0`. Throughput is 2,7× the pre-fix figure and the
worst wait is a third of it, so the corrections are not a trade: the original numbers
were partly an artefact of the amber discharging vehicles that had not moved.

**The toolkit is kept, deliberately.** The traces these five defects were found with
(`setBodyTrace`, `setTraceVehicle`, `takeTrace`) are now documented engine surface
rather than scaffolding: `TRACE_BODY` defaults to false and every guarded block is
behind it, so a default run records nothing and allocates no strings, and
`takeTrace()` hands over the buffer and installs a fresh one so a drainer that keeps
up cannot grow it. `core/` stays renderer-agnostic and Node-free — the earlier
`process.env` switch for the A/B test was reverted precisely because that contract
is not negotiable. `scripts/stall.ts` and `scripts/stranded.ts` are the newest and
were the decisive pair: they separate "refusing to discharge" from "refusing because
it is full", which is the question every one of these defects turned on.

**Process followed, as required:** instrument → change → measure → measure *again
across seeds* → verify 10 min → commit only at 0 violations. Single-seed runs hid
the permissive-left defect for a whole session: `verify-model` runs seed 7 only,
where it is at its mildest (6 overlap frames there, 27–99 elsewhere).
`scripts/overlap-seeds.ts` measures 8 seeds per frame and is the gate. The
second-order lesson is that the 10-minute aggregate run hid the livelocks, which
only a per-30 s time series exposed — a frozen counter looks the same whether the
junction is at capacity or wedged, so the diagnostic has to ask *when* it froze, not
just that it did.

- [x] `leftPhase` in the controller state machine, with the same interlocks
      (`MIN_GREEN`, amber, all-red, box clearance) as the through phases
- [x] Left pressure fed separately, and separately the worst left wait
- [x] Lefts released on the left phase with **no** `opposingStreamBlocks` and no
      `holdAtConflict` — the whole point is that there is no opposing stream
- [x] `LEFT_SHARE_OF_DENIED` measured, not guessed
- [x] Both invariant scripts corrected to ask per movement
- [x] **Corner clip: `:left × :right`, both stopped, long vehicle sweeping the
      adjacent lane.** Closed by geometry, not by a signal rule: only an 11,2 m bus
      reaches behind a stop line (measured 2,20–3,60 m, via `scripts/band-matrix.ts`),
      and an ordering cannot fix it because the give-way point for the car beside it
      (72,45) sits behind the car's own line (76,00). So the rule became asymmetry —
      the car at the line cannot move and the bus can hold, which is the only order
      both halves of the pair can execute (`sweptOverAStoppedBody`).
- [x] Overlap count → 0 across all 8 seeds at both default and calibrated demand
- [x] Demand calibration re-attempted once the count was zero (0,045/0,075)
- [x] Canvas. Built and committed — see **Sprint 1-E canvas status** below.

**The 2D → 3D migration is done, and the boundary held:** the renderer lives in
`src/simulation/three/`, and the hard rule it was built under is unchanged —
`src/simulation/core/` imports nothing from `three/`, no DOM, no `process`. That
boundary is why the engine was testable without a browser and why the trace is a
caller-drained buffer rather than a log call. The model work in this sprint was
independent of the migration and was not reverted when the 3D scene landed. See
`CONTINUIDAD.md` § SIGUIENTE 3.

---

### Sprint 1-E — Three.js simulation canvas
*Target: animated 3D intersection running on the real engine. This is the wow factor.*

```
/impeccable design 3D intersection with animated vehicles, traffic lights, dark city grid
```

**Architecture note:** Three.js runs inside a React component wrapper (`ThreeCanvas`),
mounted and unmounted by it, and reads the engine's state rather than owning it. A
single reference-counted runner steps the model and publishes through the bus; the
boundary is the whole point of the sprint's shape:

```
simulationStore (status: idle/running/paused)
        │
        ▼
runner.ts ──steps──▶ src/simulation/core/  (owns the model)
    │                      ▲
    │ emits 'frame'        │ imports nothing from any of this
    ▼                      │
SimulationEventBus ──▶ src/simulation/three/  (renders, one paint per frame)
        └───────────▶ React (useEngineReadout, ~4 Hz)
```

`core/` is renderer-agnostic and Node-free — no DOM, no `three`, no `process`. That
is why the model could be closed and measured against eight seeds with no browser and
no canvas in the loop, and why the renderer can be replaced without touching a line of
the simulation.

Files created (all committed):

```
src/simulation/
├── runner.ts                  # One shared, refcounted RAF: steps core, emits
│                              #   'frame' at refresh rate + 'readout' at 4 Hz
├── three/
│   ├── scene.ts               # Stage: renderer, camera, lights, fog, resize
│   ├── IntersectionScene.ts   # Mirrors the world onto meshes; one paint per frame
│   └── entities/
│       ├── LanePath.ts        # Road layer derived from layout.ts + approachFrame()
│       ├── VehicleMesh.ts     # Body from VehicleSpec, paint, opacity, light bar
│       ├── WalkerMesh.ts      # Pedestrian, walk cycle from stride
│       └── TrafficLightMesh.ts# Head per approach + preemption bar
├── events/
│   └── SimulationEventBus.ts  # Typed EventEmitter (mitt): frame + readout
└── core/                      # the engine. Unchanged by the migration.

src/components/
├── simulation/ThreeCanvas.tsx     # React wrapper: stage lifecycle, WebGL error state
└── dashboard/SimulationCanvas.tsx # Frame, status + "Motor real" badges, engine footer
src/hooks/useEngineReadout.ts      # The readout subscription React reads through
```

**IntersectionScene renders (all done):**
- [x] Dark asphalt ground plane with lane markings, matching `layout.ts` constants
- [x] 4-way intersection: N/S/E/W lanes, 2 lanes each direction
- [x] Pedestrian crossing strips (zebra bars from `CROSSWALKS`)
- [x] 4 `TrafficLightMesh` objects (one per direction), lamps from `aspects()` +
      `leftOpen()`
- [x] Vehicles spawning from edges, queuing, moving when green — positions read
      from the engine every frame, never integrated by the renderer
- [x] Vehicle types visually distinct — silhouettes from `VehicleSpec.body`
      (saloon/box/long), model paints, taxi roof sign, ambulance light bar
- [x] Emergency vehicle triggers a visible priority pulse effect: alternating
      light bar on the vehicle + blue bar on the served approach's signal head
- [x] Frame-driven animation at refresh rate; the scene paints only when a
      `frame` arrives (on-demand, never a second loop)
- [x] **Lane geometry derived from `layout.ts` rather than hand-placed.** The engine
      already owns lane offsets, turn arcs and box boundaries, and a scene with its
      own copy of them will drift from the model and start lying about it — the same
      failure as the two definitions of "inside the box" that are now one.
      `LanePath.ts` imports only `layout.ts` constants and reads the driver's
      right-hand side back out of `LANES` via `approachFrame()`.

**Mock data ticker — superseded, never written.** The plan originally called for a
`mockTicker.ts` emitting fake `SimulationState` every 150 ms. The real engine
produces the same state, on the same bus, so a fake ticker would have been a second
source of truth for the one thing this product is about. Until the backend exists
(Fases 3–4), the **metrics panel** is the only mock surface, and it says so with the
"Simulado" badge; the canvas footer and queues read the engine through
`useEngineReadout`.

**Acceptance criteria:**
- [x] Simulation runs at ≥ 30 FPS on a mid-range laptop — *implementation meets it
      (one render per engine frame, instanced lane paint, pooled meshes); **not
      measured**: there is no browser in this environment, so FPS and the whole
      visual layer are verified by types, build and reading, not by looking*
- [x] Emergency vehicle clearly distinguishable and visually triggers priority
- [x] Traffic lights change correctly — driven by `controller.aspects()`, i.e. by
      the real signal state, not by mock data
- [x] Canvas resizes gracefully (ResizeObserver, with a repaint even while paused)

### Sprint 1-E canvas status — ✅ complete (browser verification pending)

Delivered in dependency order across 8 commits (`events` → `runner` → `stage` +
`LanePath` → entities → `IntersectionScene` → `ThreeCanvas` → swap → docs). All
gates green: `tsc -b`, `vite build`, `oxlint`, `overlap-seeds.ts 5`,
`verify-model.ts 10`, `impeccable detect --json` on the two touched UI files
(**zero findings**).

Decisions taken while building, all confirmed against the code rather than guessed:

- **One shared RAF runner (`runner.ts`), refcounted.** StrictMode mounts twice and
  the canvas lives on two routes; a loop owned by a component would run parallel
  instances or silently restart the junction on navigation. The world outlives
  its mounts: coming back resumes the same junction. Stepping is skipped only in
  `paused`; `idle` previews (the argument the login screen makes), and crossing
  back into `idle` (Stop) replaces the world on the same seed.
- **Two cadences, one truth.** `frame` at refresh rate for the scene, `readout`
  every 250 ms for React. The runner is the model's only clock; no second ticker
  exists inside the console.
- **The canvas shows the local engine; the panel shows the backend.** Provenance
  is stated explicitly. After the Phase 6 rework the canvas carries `Motor local`
  (with a tooltip) and the panel carries `Motor del backend` (provenance strip
  with live latency). `core/` was not touched.
- **Footer reads the engine, not the store.** Queues and per-approach waits come
  from the same vehicles the canvas draws (`s < stopS`, the model's own
  definition). `—` before the first readout instead of a zero, because "not
  measured yet" and "empty junction" are different states. The last line is the
  controller's own `reason` — the explainability surface.
- **Geometry is model-derived throughout.** Stop lines at `route.stopS`'s
  approach edge, zebras from `CROSSWALKS`, kerbs at the junction box, signal
  heads on the far side at the driver's right — all from `layout.ts` via
  `approachFrame()`. The renderer owns no number that describes the junction.
- **Not verified by eye, and it is recorded everywhere it matters.** No browser
  exists in this environment: the scene has been checked by types, by the build
  and by reading the geometry. First visual tuning candidate is the light rig —
  hemisphere 1.15 + key 1.35 may saturate the near-white ambulance paint.

---

### Sprint 1-F — Configuration and reports screens

**Config page:**
- [x] `ConfigPage.tsx` — sliders for vehicles/min and type distribution; radio for mode
- [x] Form validation (Zod + react-hook-form, one shared schema)
- [x] `configStore.ts` — persists config to localStorage between sessions, versioned and validated on rehydrate
- [x] Preview panel: derived flow rate, peak, and per-kind shares (police fixed) update while dragging

**Reports page:**
- [x] `ReportsPage.tsx` — table of past sessions with metrics summary (horizontal scroll below `md`, numbers never truncated)
- [x] `ReportCard.tsx` — expandable row: session date, duration, mode, adaptive-vs-fixed wait; detail holds the full comparison
- [x] Download button (disabled until Phase 5, tooltip explaining why, visible helper text at every width) —
      deferred from the Sprint 1-B audit; 375px is a hard constraint in `PRODUCT.md`
- [x] Empty state for when no sessions exist yet

### Sprint 1-F status — ✅ complete

Two decisions taken during the sprint, both recorded after the fact:

- **The configuration drives the engine.** `quietRatePerMinute` maps to
  `WorldOptions.baseRate/peakRate` (preserving the model's own quiet-to-peak
  ratio), and the five operator weights become `WorldOptions.typeWeights` — a
  new option in `core/world.ts` that overrides the fleet's spec weights at the
  two spawn sites. A slider that changes nothing is decoration; this one
  rebuilds an idle junction on save and takes effect on the next stop during a
  run. Police keep the fleet's fixed weight and are shown as a fixed row in the
  preview, because the emergency stream belongs to the model, not to the
  operator.
- **Phase 1 reports read a local session log.** Every explicit stop of a run
  with at least one sample appends a record to `sessionsStore` (localStorage,
  last 50, schema-validated on rehydrate). No backend exists until Phase 2, and
  invented rows on an evidence screen would be a lie; the empty state is the
  honest first-run view.

Known deviation from the original bullet list: the session detail shows
**emergency response time** per strategy rather than an "EVP count" — the count
is not measured anywhere in the model, and a column that does not exist in the
data cannot be promised here.

Engine gates re-run after the `core/` change: `overlap-seeds 5` → 0 overlaps,
served 1167/1102 (identical to before); `verify-model 10` → all invariants
hold. `impeccable detect` clean on all seven touched UI files.

---

### Sprint 1-G — Cross-cutting concerns
*Before Phase 1 is done, these must be solid.*

- [x] **Responsive breakpoints:** all pages work at 375px, 768px, 1280px, 1440px
- [x] **Error states:** every async operation has an error UI
- [x] **Loading states:** spinner survives `prefers-reduced-motion`
      (skeletons deferred — see status block; no async data exists in Phase 1)
- [x] **WebSocket status indicator:** TopBar shows connected/reconnecting/offline,
      with an honest tooltip when offline
- [x] **Keyboard navigation:** all interactive elements are focusable; skip link;
      radio groups follow the full WAI-ARIA pattern
- [x] **Impeccable final pass:** run `impeccable audit` on every page
- [x] `README.md` — how to run the frontend locally

**Phase 1 is done when:** A professor can open the app, log in, see the
intersection animate with mock data, read metrics, and navigate all screens
without hitting a broken state.

### Sprint 1-G status — ✅ complete

An inventory-first sprint: the code audit found that several planned items were
already done or smaller than assumed, and that two real defects hid behind them.

**What the inventory changed:**

- **Skeletons are deferred to Phase 3, with the user's confirmation.** There is
  no asynchronous data operation in Phase 1 — metrics derive synchronously from
  the engine tick, sessions and configuration are synchronous `localStorage`
  reads. A skeleton over synchronous data would flash for a single frame, which
  is theatre, not a loading state. What *was* real is the gap noted in Sprint
  1-B: under `prefers-reduced-motion` the global animation kill froze the
  `Spinner` into a static ring, leaving reduced-motion users with no visible
  loading signal. The spinner now trades rotation for a slow opacity breath
  under that media query — implemented as an unlayered `!important` rule,
  because for `!important` declarations the cascade layer order inverts and only
  an unlayered rule can outrank the base-layer kill.
- **Error states needed no new code.** The app has exactly two async surfaces —
  the login submit (already carrying `isLoading`, an inline `role="alert"`
  error, and clear-on-edit) and the Three.js init (already carrying a written
  error panel). Both were audited, neither changed.
- **The connection indicator already existed**; what it lacked was honesty about
  *why* it says "Sin conexión". It now carries a tooltip stating the design
  rather than the defect: the simulation runs locally, the live backend arrives
  in Phase 2. Reachable by keyboard (`tabIndex` + `aria-describedby`).

**Two real defects fixed:**

- **P1 — touch targets below the design system's 44px floor.** `ConfigSlider`
  painted its track on the input itself, pinning the entire touch target to the
  8px track height; and both mode radio groups (~28px) missed the floor. The
  slider now draws its track in the runnable-track pseudo-elements inside a
  44px (touch) / 32px (desktop) hit box — the density split DESIGN.md imposes
  on every control — and both radio groups gained `min-h-11 md:min-h-0`.
- **P1 — radio groups without keyboard semantics.** Both `role="radio"`
  groups were focusable and clickable but had no arrow keys and two tab stops.
  A shared `useRovingRadioGroup` hook now implements the WAI-ARIA radio group
  pattern (roving tabindex, arrows move-and-select, Home/End) and both call
  sites wire it — the Zustand setter in the dashboard, `setValue` with
  `shouldDirty` in the form, so the submit gate stays identical to a click.

**Also in this sprint:** a skip link ("Saltar al contenido") as the first tab
stop of the console shell; the dead `.grid-backdrop` utility removed after the
detector flagged it (defined, never used); root `README.md` with run
instructions, demo credentials, routes and gates, replacing the Vite template
boilerplate.

**Audit score (manual pass, code-level):** A11y 4 · Performance 3 · Responsive 4
· Theming 4 · Implementation Integrity 4 — **19/20**. The bundled detector
returns zero findings across every touched file. The remaining point is the
known informational note that the Vite chunk exceeds 500 kB (three.js), plus
the browser-only verification no headless environment can produce.

Gates: typecheck, build and lint green (`src/` warning-free; the nine `scripts/`
warnings are recorded debt). Engine gates not re-run: `core/` untouched this
sprint. **Browser verification happened after this sprint closed** — see the
Sprint 1-G addendum and Sprint 1-H below.

**Addendum — browser verification (user, after 1-G):** FPS confirmed good
(≥ 30, occasionally a little slow — accepted). Three clarifications recorded so
the checklist cannot mislead a later session: the "sliders under touch" item
refers to the `ConfigSlider` range inputs on the **Configuración** page, not to
the 3D scene — the simulation camera is **fixed by design** (an observation
console, not an orbitable model) and dragging the canvas does nothing on
purpose; the skip link and radio-group arrows were not re-reported, so they
stand verified by code. The visual defects the same review produced are what
Sprint 1-H exists to fix.

---

### Sprint 1-H — Scene fidelity and landing page
*Target: the scene never contradicts the junction it depicts, and the app
opens with a page that says what the product is and why.*

Opened from the user's browser verification of Sprint 1-G: performance passed,
and a list of visual defects followed — every one of them a case where the
drawing disagrees with the model or with a real road, and none of them
catchable by the code gates.

- [x] **P1 — Cars stand on the zebra.** The stop line is painted hard against
      the junction box (`layout.ts` route: `stopS = APPROACH_LENGTH` parks the
      front bumper at the box edge) and the crossing sits *behind* it
      (`CROSSWALK_GAP` places it 12,0–15,2 m from the centre), so a stopped
      4,6 m sedan's body covers the whole 3,2 m crossing — and pedestrians
      released on the red walk through standing cars. Real order:
      **box → zebra → stop line → queue**. Fix: move the crossing adjacent to
      the box and the stop line 4,7 m back, with `route.stopS` moving with it.
      **Touches `core/layout.ts` → engine gates re-run required**
      (`overlap-seeds 5`, `verify-model 10`).
- [x] **P1 — Landing page before login.** A public route at `/` that says what
      UrbanSync Sim is, why adaptive control matters, and what it references —
      then hands off to `/login` and `/observer`. Not in the plan until now;
      added from the user's explicit request. Persuade-mode surface:
      `/impeccable shape` before any code.
- [x] **P2 — Zebra legibility.** Four bars at opacity 0,4 render the crossing
      as a ghost on near-black asphalt; raise it so the stripes read as road
      markings. Orientation is already correct (bars parallel to the traffic
      they cross, which is what "vertical separated lines" looks like from
      above). Closed by `db49c0b` on top of the incidental 0,4 → 0,7 of
      `928aab0`: the zebra now sits on the stop line's own tier (0,85).
- [x] **P2 — Headlights and taillights on every vehicle.** Ordinary cars are
      unlit boxes; only taxi signs and emergency bars emit. Front warm-white
      and rear red emissive strips on all kinds, so a queue reads direction and
      intent from the paint job of light alone. Closed by `819b1db`: per-side
      warm-white and red lamps with a small emissive glow, sized from the body.
- [x] **P2 — Fire truck.** The fleet has an ambulance (spawned deliberately
      every 34–58 s) and a police car; a `firetruck` kind does not exist. Add
      it — spec, paints, mesh, and alternate it with the ambulance in
      `updateEmergency`. **Touches `core/fleet.ts` + `core/world.ts` → gates.**
      Closed by `d866dc8`: 8,4 m so the existing length rule keeps it out of
      left turns, weight 0 so it never enters the arriving stream, and a roof
      ladder so it reads as a fire engine from above. Gates re-run and green.
- [x] **P3 — Approach lane arrows.** `layout.ts`'s own docstring commits to
      painted lane arrows that make the turn discipline mean something; the
      renderer never painted them. Lane 0: straight + left; lane 1: straight +
      right. Closed by `2a4b13b`: two glyphs per approach lane, a car-length
      behind the stop line, read from `lane.turns` so the paint follows the
      model rather than the lane index.

### Sprint 1-H status — ✅ complete

All six items are closed.

- **Cars stand on the zebra** (`928aab0` + `25cdb4c`). Geometry reordered to
  **box → zebra → stop line → queue** (`STOP_LINE_DISTANCE = 15,1`, `route.stopS`
  moved 4,7 m back), and the pedestrian model made honest at the same time:
  walkers step before vehicles, a crossing is occupied per arm, the controller
  yields to crossing arms (clearance extension up to 10 s), and a committed
  turner holds at the zebra entry arc instead of creeping through pedestrians.
- **Landing page before login** (`9069bb9`). `/` is a Persuade surface built
  with the `/impeccable shape` workflow (instrument-rack lead, seed
  `eb15258e`): a live intersection in a screen bezel, two instrument dials and
  two doors — Entrar (`/login`) and Observar (`/observer`). No numbers on the
  page: the mechanism is demonstrated, measurements are computed in the
  dashboard. Surface brief kept at `.impeccable/surfaces`. `typecheck`/`build`/
  `lint` clear, `impeccable detect` → no findings. **Browser check pending
  (user): 375px and 1440px, reduced motion, keyboard.**
- **Scene fidelity** (`db49c0b`, `819b1db`, `d866dc8`, `2a4b13b`) — the four
  P2/P3 items above, on 2026-10-15. Zebra, lamps and arrows are renderer-only;
  the fire truck is the one core change and re-ran the gates:
  `overlap-seeds 5` → 0 overlaps at both demands (served 916 default / 890
  calibrated), `verify-model 10` → all invariants 0, `ped-safety 3` → 0
  vehicle↔pedestrian contacts over 440 crossings, plus `npm run build` and
  `lint`. A measured note for the record: on the verify-model seed the totals
  moved (served 191 → 210, worst wait 179,6 → 227,0 s) because the model's
  spawn path consumes randomness per vehicle size, so a new kind shifts the
  stream; the emergency vehicle in that run is a single ambulance either way,
  since a jammed approach no longer fits the truck. The live demo starts on an
  empty junction, where both kinds fit.

---

## Phase 2 — Backend API

**Goal:** FastAPI server with auth, session management, and WebSocket stub.

**Stack active:** Python 3.11 (image) · FastAPI · SQLAlchemy 2.0 (async) ·
Alembic · PostgreSQL · python-jose · bcrypt · python-socketio

> `passlib` was dropped during implementation: 1.7.4 is from 2020 and cannot drive
> `bcrypt` 5 — it reads the removed `bcrypt.__about__` and hands bcrypt an over-72-
> byte probe it now rejects. `bcrypt` is called directly at the same cost. See the
> tech decisions log.

### Key deliverables

- [x] Project structure per AGENTS.md
- [x] Database models: `User`, `Role`, `Session`, `SimulationSession`,
      `SimulationConfig`, `SimulationMetric`, `SimulationReport`
- [x] Alembic migrations: initial schema (`0001_initial_schema`; reproduces the
      models with `alembic check`, verified on **both SQLite and PostgreSQL** —
      the migration and `check` were run against a real `postgres:15`, and the
      resulting DDL was inspected)
- [x] Auth endpoints: `POST /auth/login` → JWT, `POST /auth/logout`
- [x] Auth middleware: JWT validation via `Depends(get_current_user)`, backed by a
      revocable `sessions` row (logout takes effect immediately, not at expiry)
- [x] Session endpoints: `POST /sessions`, `GET /sessions`, `PATCH /sessions/{id}`
- [x] Config endpoints: `POST /configs`, `GET /configs/{id}`
- [x] Realtime channel: socket.io namespace `/simulation` — the connection and
      rooms are live; **tick streaming is Phase 3** (the stub emits no numbers).
      The literal `/ws/simulation/{session_id}` from earlier drafts is superseded;
      see the tech decisions log
- [x] Health endpoint: `GET /health` → `{ status: "ok", db: "ok" }`
- [x] CORS configured for `localhost:5173` and Vercel preview URLs
- [x] Dockerfile for local dev, plus `docker-compose.yml` (Postgres + API, applies
      migrations and seeds the demo operator on boot). The image builds on
      `python:3.11-slim` and the full stack was exercised end-to-end: boot →
      migrate → seed → login/config/session/list/logout over HTTP, socket.io
      handshake, and the 401 paths

**Not delivered, deferred:** the demo operator is seeded by `python -m app.db.seed`
and by the compose health-gated command, not by an Alembic data migration (schema
and data are kept apart). `GET /sessions` returns the caller's runs only — the
anonymous observer path (`user_id IS NULL`) has no read endpoint yet; that belongs
to Phase 5.

---

## Phase 3 — Simulation Algorithm

**Goal:** The adaptive algorithm that the whole project is about.

### Algorithm design

```
AlgorithmTick (runs every 100ms per session):
  1. Read current vehicle queues per lane from SimulationState
  2. Calculate pressure score per phase:
       pressure(phase) = Σ vehicles_waiting(lane) * weight(lane)
  3. If current phase pressure < threshold AND min_green_time elapsed:
       switch to highest-pressure phase
  4. If emergency vehicle detected in any lane:
       interrupt → EVP mode → force green on emergency lane
       log EventoPrioridad with time_saved vs fixed cycle
  5. Emit new SimulationState over WebSocket
```

### Key deliverables

- [x] `services/algorithm/adaptive_controller.py` — core logic
- [x] `services/algorithm/fixed_controller.py` — reference implementation
- [x] `services/simulation/tick_engine.py` — manages per-session tickers
- [x] `services/simulation/vehicle_generator.py` — spawns vehicles per config
- [x] `services/simulation/state.py` — `SimulationState` dataclass
- [x] Unit tests for both controllers (pytest)
- [x] Benchmark: adaptive vs fixed on the same vehicle sequence → export CSV

**Implemented so far:** the control core, mirroring the browser's measured law
(`frontend/src/simulation/core/controller.ts`) rather than the sketch above — same
pressure formula (`Σ (1 + waited/12)`, capped at the 120 s horizon), same
`MIN_GREEN`/`MAX_GREEN`/amber/all-red interlocks, plus the starvation bound and
emergency preemption. A shared `SignalController` state machine holds the
interlocks; adaptive and fixed differ only in `choose`, which is what makes the
benchmark a comparison rather than two implementations of the same policy.

`tick_engine.py` turns `state.run`'s whole-sequence loop inside out: `step`
advances one tick and returns `tick` / `phase_change` / `evp_activated` /
`session_ended` events, and `run_session` drives it at wall-clock pace, so the
Phase 4 socket has an engine to forward verbatim. `benchmark.py` plays one
generated sequence through both controllers and renders the comparison as CSV
(`python -m app.services.simulation.benchmark`). Through phases only for now — the
protected-left phase needs lane geometry the queueing model does not carry, and is
deferred. What remains is the transport: streaming these events from
`app/api/ws/server.py`, which is Phase 4.

---

## Phase 4 — Real-time Integration

**Goal:** Frontend shows live data from the real backend algorithm.

- [x] Replace the mock metrics generator with a real Socket.io connection
      (`mockTicker.ts` was never written; the mock lived in `services/metrics.ts`,
      now deleted — provenance is the live stream, not a labelled fake)
- [x] `services/socket.ts` — connection manager with auto-reconnect
- [x] `useSimulationStream` hook — installs the stream controller that feeds
      `simulationStore` and `metricsStore` from real ticks
- [x] Backend pushes: `tick`, `phase_change`, `evp_activated`, `session_ended`
- [x] Frontend reacts to each event type: `tick` feeds both stores, `session_ended`
      ends the run, `phase_change`/`evp_activated` are acknowledged (the canvas
      still animates the browser engine, so nothing reads them yet)
- [x] Metrics panel reflects real algorithm output, with a provenance strip and a
      connection badge (live / stale / reconnecting / error), and the empty state
      still a real state
- [x] Transport controls drive the run: Start/Pause/Resume/Stop →
      `submit_config` / `pause_session` / `resume_session` / `stop_session`
- [x] Latency test: tick → client ≤ 150ms on localhost — measured **p95 0.67 ms**,
      max 0.89 ms over 30 ticks. `sentAt` is stamped on the wire in `_emit` and the
      client reads `Date.now() - sentAt`; on one host there is no clock skew. The
      canvas is the browser engine and not the tick's consumer, so this bounds the
      panel's path, which is where a streamed tick actually lands

**Backend side done (the wire):** `app/api/ws/hub.py` owns one `SessionEngine`
task per session and streams its events to the session's room. A `SessionEngine`
runs **both** policies — adaptive and fixed — over the *same* arrival sequence, so
each tick carries `adaptive` and `fixed` metrics and a per-strategy
`vehiclesProcessed` map; the browser toggle simply re-reads the panel, no restart.
`app/api/ws/server.py` validates the payload and drives the lifecycle: a client
starts a run with `submit_config` (`{ sessionId, config }`), pauses and resumes it
with `pause_session` / `resume_session`, and ends it early with `stop_session`
(all `{ sessionId }`). Pausing holds the run at a tick boundary without ending it;
`simulation_status` carries a `paused` flag. The run is scoped to the connection
that started it, so a disconnect stops it.

**Frontend side done (the client):** `frontend/src/services/socket.ts` opens the
`/simulation` namespace and exposes `start/pause/resume/stop` plus a `peek()` the
canvas footer reads; a module-level controller (`ensureSimulationStream`) keeps the
run alive across navigation, because the run's lifetime is the store's, not a
screen's. `useSimulationStream` installs it; `store/streamStore.ts` holds the
connection badge state; `metricsStore.receive()` folds real ticks into the panel.
What remains is only the latency measurement.

---

## Phase 5 — Persistence + Reports

**Goal:** Sessions stored in PostgreSQL, reports exportable as PDF/CSV.

- [x] Persist `SimulationSession` on start/end
- [x] Persist `SimulationMetric` on session end
- [x] `GET /reports/{session_id}` → consolidated metrics JSON
- [x] PDF export: `reportlab` or `weasyprint` on the backend
- [x] CSV export: Python `csv` module
- [x] Frontend download button wired to export endpoints
- [x] Session history table with real data

**Status — ✅ complete** (backend `7d416cd` + `2f16e58`, frontend `191f961`).

**Backend.** `SimulationSession` was already persisted; what was missing was the
evidence and the reading of it. `POST /sessions/{id}/metrics` accepts a batch of
readings — one row per strategy per sample window — and is idempotent on
`(tick, strategy)`, so a retry after a dropped response is safe; the response
returns `{ accepted, duplicates }` rather than swallowing a replayed window,
because a sampler stuck on one window is a bug worth seeing. The batch is capped
at 20 000 rows so one request cannot be used as a memory amplifier.
`GET /reports/{id}` returns `{ session, generatedAt, samples }` — the run's own
read (which already carries both frames and the processed count) nested beside
the samples, so the screen and the exporters read one query instead of two
endpoints that can disagree.

`GET /reports/{id}/export.csv` is the full long-format evidence: one row per
strategy per window, CRLF, UTF-8 BOM (so Excel on Windows reads the accents),
dot decimals. `GET /reports/{id}/export.pdf` is laid out from the report's own
numbers with `reportlab==5.1.0` — summary, a computed and honest verdict, and a
window-paired sample of the evidence rather than a chart. Both are
`Content-Disposition: attachment` with an ASCII filename and `Cache-Control:
no-store`. Every report route resolves the session through `OwnedSession`, so a
foreign id is a 404, not someone else's run.

**Frontend.** The history screen reads `GET /sessions` when there is an account
and the browser's own log when there is not (`/observer` has no account to own a
run), rendering both in one table with every row badged `Servidor` or `Local` —
the two sources are not equally durable and this is an evidence screen. A stopped
run is written locally **first**, synchronously, then posted; on success the local
copy is replaced by the server's row, so there is one copy carrying the id the
export endpoints address. A failed post leaves the row and an error that says so.
Samples are captured at the chart's cadence (two rows per window, capped at 3600)
rather than the tick's, so a flush is always one request and a report reads as a
comparison, not a trace. CSV/PDF buttons fetch the backend's own rendering as a
blob and save it, so the file matches the screen; a local row offers no button it
cannot honour.

**Not done, deliberately.** Runs are filed by the client on stop, not by the
server from the socket wire: the stream's `session_ended` arrives without the
samples' summary, and the run's own lifetime is the store's, so the client is the
only layer that knows a run was stopped *and* has its evidence. Server-side
recording would need the hub to keep the samples it currently streams past.

---

## Phase 6 — Polish + Deploy

**Goal:** Live URLs, documented, presentable to the professor.

### Phase 6 status — 🟡 visual polish in progress

The deploy half of this phase has not begun; the **visual polish the user asked
for** has, and its first slice is **committed** (`70c9016`). It is a renderer-only
change — `core/` is untouched, so no engine gate had to be re-run.

**The diagonal-crossing complaint was a rendering gap, not a model defect.** The
original note below pointed at the turn geometry in `core/`; the diagnosis that
came out of the renderer is that the turn was always drawn correctly, and what was
missing was anything on the ground saying where the turn goes. An empty junction
box reads as blank asphalt, so a car swung through it looks like one crossing the
square on a diagonal.

Two changes, both in `frontend/src/simulation/three/entities/LanePath.ts`:

- **Dotted turn guides inside the box** (`buildTurnGuides`). One dotted line per
  turning movement, sampled straight from that movement's own `route.samples`, so
  the paint a driver reads and the curve a car drives are the same geometry — a
  guide with its own control point would be a second, quieter definition of the
  turn that drifts the first time either is tuned. Only the stretch inside the box
  is painted (`GUIDE_INSET = JUNCTION_HALF − 0,9`): the approach and the exit
  already carry a lane line and a second one beside it would read as a lane that
  is not there. A 0,9 m dash with 0,6 m between, in the dim guidance tier.
  **Left turns only** — a right turn is a tight quarter at the kerb that paints
  itself, and guiding both doubles the arcs into a rosette, decoration not
  guidance. The A/B was rendered: adding the four right arcs joins the set into
  two concentric rings, so the right turns stay unpainted.
- **Zebra laid the continental way.** The bars ran across the road, stacked toward
  the driver; on the three-quarter camera that read as a ladder lying diagonally on
  the asphalt. They now run *along* the road and repeat across the carriageway
  (bar 0,4 m, gap 0,8 m), the count derived from `crosswalk.length` and the depth
  from `CROSSWALK_WIDTH` — both from `layout.ts`, not chosen in the renderer.

`npm run build` (`tsc -b` + `vite build`) passes and `prettier --check` is clean.
The change was **rendered and reviewed headlessly** (Chrome, WebGL via SwiftShader)
at 1440px and 375px: the zebra reads as a continental crossing and the guides
remove the diagonal-crossing illusion. The user's own look in `/observer` is the
only item left on the slice.

The second slice is the dashboard's first real instrument rack, committed in
`1c9375e`, preceded by `da57b80` which fixed the class merge that had been
silently dropping the custom font sizes. The panel now shows **every per-policy
reading at once** instead of one reading per stat:

- **`StrategyComparison.tsx`** draws five rows — mean wait, vehicles served,
  throughput, longest queue, emergency response — as adaptive and fixed bars on a
  per-row scale, with a scale floor so a quiet run does not turn a one-vehicle
  difference into a full bar. Adaptive wears the chart's Flow Green and the fixed
  cycle its muted baseline (the active policy is marked in text colour only), and
  a zero emergency response renders `—`, not `0.0 s`. It replaces the three
  `Stat`s; the promoted wait-time delta stays above it as the headline, and the
  rack is the evidence behind that headline. **The bars do not tween**: at ten
  ticks a second a 300 ms ease spends its life chasing a value it never catches,
  so the bar would disagree with the number printed beside it. The bar steps with
  the tick and the number stays the bar's truth.
- **Live one-way latency.** `sentAt` was already on the wire and ignored; the
  socket controller now reads `Date.now() - sentAt` on every tick, keeps a
  60-tick window (six seconds), and publishes the last reading and the p95 to
  `streamStore`. The provenance strip shows `p95` and `última` in mono/tabular,
  with `—` before the first tick and a reset on every run start and close. The
  reading assumes the browser and backend clocks agree, which holds on the demo
  host; a skew shows up as a skewed number rather than being hidden.
- **`da57b80`** registers the project's custom font sizes (`micro`, `display`,
  `metric`) with `tailwind-merge`, which had been reading them as text colours and
  dropping the size whenever a colour was merged after. The promoted metric had
  been rendering at body size; it is now `text-metric` as designed.

Verified: `npm run build` (`tsc -b` + `vite build`) passes, `oxlint` reports only
the pre-existing warnings in `scripts/`, `prettier --check` is clean on the
changed files, and `impeccable detect` returns no findings. The rack and the
latency strip were **rendered and reviewed headlessly** (Chrome, live stream from
the backend on SQLite) at 1440px and 375px, in adaptive and fixed mode, and in the
stopped/empty state; the 375px overflow probe reports no element wider than the
viewport. The backend used for the check was stopped afterwards.

**The third slice is the landing, redesigned end to end** (`5df96ac`). The first
landing was an instrument rack: a headline, a live picture in a bezel and two
dials. It demonstrated the mechanism but the visitor stood outside it — the scene
was `aria-hidden`, the dials carried no reading, and the page never showed the
controller deciding. The redesign keeps the Control Room world and makes a
three-move argument instead:

- **The hero is the console's own scene, live.** `HeroJunction` seats the real
  `ThreeCanvas` — stepped by the same runner as the dashboard — in a bezel, with
  the engine's four-cell readout (`Fase`, `Servidos`, `Espera máx.`, `Cola máx.`)
  and the `Regla actual` sentence underneath, all from `useEngineReadout`. It
  falls back to `AmbientIntersection` without WebGL or under reduced motion, and
  starts the runner itself on that path, so the strip still reads a real junction
  when the canvas is not animating.
- **The rule list is paired with its own output.** `DecisionPipeline` prints the
  four rules from `core/controller.ts` (Pesaje / Decisión / Límites / Emergencia,
  with the real constants) beside `Trazabilidad en vivo` — the live `reason`,
  fading on each change of phase. That pairing, a rule list next to the sentence
  it is producing, is the explainability claim a screenshot cannot fake.
- **The comparison is a shape, not a figure.** `ComparisonTrack` draws fixed
  against adaptive as a periodic and an irregular tape with one shared playhead,
  explicitly labelled a schematic. No number is printed on the block; the measured
  difference stays in the dashboard, where it is computed.
- **Posed entrances that compose to a still.** `Reveal`, `useInView` and
  `usePrefersReducedMotion` add three reveal variants (rise, slide, focus) whose
  hidden state lives under `prefers-reduced-motion: no-preference`, so a
  reduced-motion visitor gets a composed page rather than blocks waiting on an
  observer. The `focus` variant replaced an earlier `wipe`: Chrome treats
  `clip-path` as a clip for `IntersectionObserver`, so a clipped element could
  never intersect and stayed hidden forever.

Verified headlessly (Chrome, WebGL via SwiftShader) at 1440px and 375px across all
four blocks — `consoleErrors` empty and no horizontal page overflow; reduced
motion captured separately (static `Vista estática` hero over a live readout
strip) and the reveals confirmed composed. `npm run build` passes, `oxlint`
reports only the pre-existing `scripts/` warnings in `scripts/`, `prettier
--check` is clean on the landing files, and `impeccable detect` returns no
findings. The surface brief at `.impeccable/surfaces/` and the `DESIGN.md`
Landing/Instruments sections were rewritten to match. **Still open:** the same
browser look the rest of 1-H waits on — 375px/1440px, reduced motion, keyboard.

**Frontend polish (requested, part done):** the dashboard has been rebuilt as a
console. Before this phase is closed:

- [x] **Dashboard rework** — transport on the canvas bezel (`TransportControls`),
      phase tape + queue bank + idle chip instrumented on the canvas, metrics
      column rebuilt around the wait comparison with the mode toggle
      (`ModeToggle`), FlowChart on a fixed 0–100 axis, tooltip overflow fixed,
      shell connection state wired (`ConsoleLayout` → `TopBar`), sidebar sticky
      on desktop (`271b44a`, `7b64752`, `79cc111`)
- [x] **Fix the diagonal crossings in the animation** — *fixed in the renderer*.
      The complaint was real, but the cause was not the movement: every turn
      already follows its own arc, and the junction box was simply blank, so a
      turning car read as one drifting diagonally across nothing. Fixed in the
      renderer, not in `core/`: dotted turn guides through the box, sampled from
      each turning movement's own route, plus a continental zebra (`LanePath.ts`,
      `70c9016`; see the Phase 6 status block above).

- [ ] Final `impeccable audit` pass — address all flagged issues
- [ ] Environment variables documented in `.env.example`
- [ ] `README.md` complete: setup, usage, screenshots
- [ ] Deploy frontend → Vercel (connect GitHub repo, auto-deploys on main)
- [ ] Deploy backend → Railway (Dockerfile, PostgreSQL add-on)
- [ ] Set production env vars on both platforms
- [ ] Smoke test production URLs
- [ ] Record a 2-minute demo video showing the EVP module in action

---

## Tech decisions log

| Date | Decision | Reason |
|---|---|---|
| Sprint 1-A | Zustand over Redux | No boilerplate, simpler API for this scale |
| Sprint 1-A | Vite over CRA | 10× faster HMR, modern config |
| Sprint 1-B | Inlined icons instead of an icon package | A dozen glyphs does not justify a dependency beside a 30 FPS canvas |
| Sprint 1-B | `PageHeader` owns the `h1`, `TopBar` does not | One Display-scale heading per screen; the route label is not a title |
| Sprint 1-B | No `backdrop-blur` anywhere in the chrome | `DESIGN.md` forbids blurred translucent panels; opacity changes are cheaper |
| Sprint 1-C | Looping animation allowed on the login screen only | The rule exists to stop motion competing with the emergency pulse; there is no console state on the login to compete with |
| Sprint 1-C | CSS keyframes for the ambient intersection, not a renderer | The dashboard runs the real engine in 1-E; a login page should not ship a 3D runtime |
| Sprint 1-C | Mock auth fails slowly and resolves to `null` | An error state that has never run is not an error state; a rejected login is a form outcome, not an exception |
| Sprint 1-E | Three.js over vanilla WebGL or a game engine | The scene is a view of `core/`, not a game: no physics, no tweens, no scene graph to fight. Three.js gives the camera and materials and nothing else, which is the smallest surface that can drift from the model |
| Sprint 1-E | Phaser dropped in favour of Three.js | The 2D plan predated the 3D decision. A game engine would have brought scene management and a sprite model the engine has no use for, and its own update loop competing with the engine's tick |
| Sprint 1-E | One shared, refcounted RAF runner owns the model's clock | StrictMode mounts twice and the canvas lives on two routes; a component-owned loop would run two simulations or restart the junction on navigation. Stop rewinds the world (same seed), Pause freezes it, idle previews it |
| Sprint 1-E | `mockTicker` never written; the canvas runs the real engine, metrics stay mock until Fase 3 | A fake ticker beside a real engine is a second source of truth for the one thing this product proves. Provenance is stated instead: «Motor real» on the canvas, «Simulado» on the metrics |
| Sprint 1-E | Two cadences from one world: `frame` at refresh rate, `readout` at 4 Hz | React re-rendering sixty times a second is dropped frames waiting to happen; the model is sampled at two speeds, never copied |
| Sprint 1-F | Zod + react-hook-form | Type-safe form validation, minimal re-renders; one schema shared by the form and by rehydration |
| Sprint 1-F | Config drives the engine (`WorldOptions.typeWeights`, quiet-rate → base/peak mapping) | A slider that changes nothing is decoration; the preview teaches the mapping and the runner rebuilds an idle junction on save |
| Sprint 1-F | Local session log in localStorage, last 50 | Honest Phase-1 reports with no backend; invented rows on an evidence screen would be a lie the product cannot afford |
| Sprint 1-F | Police share fixed outside the operator's mix | The emergency stream is the model's demonstration, not a parameter; the preview reports the fixed weight rather than hiding it |
| Sprint 1-G | Skeletons deferred to Phase 3; Spinner gains an opacity breath under reduced motion | No async data exists in Phase 1 — a skeleton over synchronous state is theatre; the real gap was the frozen loading signal, confirmed with the user |
| Sprint 1-G | Reduced-motion escape hatch lives unlayered in `index.css` | For `!important` declarations the cascade layer order inverts, so only an unlayered rule can outrank the base-layer animation kill |
| Sprint 1-G | Shared `useRovingRadioGroup` hook rather than two inline handlers | Both mode toggles needed the same WAI-ARIA pattern; the hook owns no state so each call site keeps its own wiring (Zustand setter / RHF `setValue`) |
| Sprint 1-G | Connection badge carries a design-not-defect tooltip when offline | "Sin conexión" reads as a fault; the tooltip states the truth — the simulation runs locally, the backend arrives in Phase 2 |
| Phase 2 | python-socketio over FastAPI WS | Better rooms, namespaces, auto-reconnect |
| Phase 2 | `bcrypt` called directly, `passlib` dropped | `passlib` 1.7.4 cannot drive `bcrypt` 5 (removed `__about__`, 72-byte probe now raises). Same algorithm and cost, one less layer to break on a dependency bump |
| Phase 2 | Socket.io namespace + rooms, not a literal `/ws/simulation/{id}` | Socket.io owns its own handshake path and cannot carry a path parameter; the session id travels as connection data and becomes the room. The three sources that describe the consumer (`AGENTS.md` stack, this log, Phase 4) all say Socket.io |
| Phase 2 | Tests default to SQLite, runtime uses Postgres | The suite has to run anywhere, including CI with no database container; the schema is written portable (`Uuid`, a UTC-normalizing column type, `Enum(native_enum=False)`, JSONB variant → JSON). `TEST_DATABASE_URL` re-runs the identical suite against Postgres, which is how the portability claim was checked rather than assumed |
| Phase 2 | `NoDecode` on `cors_origins`, with an explicit split validator | pydantic-settings JSON-decodes list-typed variables *before* any validator, so the operator-friendly `CORS_ORIGINS=a,b` in a compose file failed at boot with a parse error the validator never saw. `NoDecode` hands the raw string over; the validator accepts both `a,b` and a JSON array (`.env.example` uses the array, compose uses the list) |
| Phase 2 | Test fixtures refuse a database whose name lacks `test` | The fixtures `drop_all`/`create_all`; aiming `TEST_DATABASE_URL` at the app database would erase it. A name check is cheap insurance against an expensive typo |
| Phase 2 | `UTCDateTime` column type, not raw `DateTime(timezone=True)` | SQLite returns naive datetimes and Postgres aware ones; the app both compares (`expires_at <= now`) and serialises (`expiresAt`) them, so the normalisation has to be one place instead of a guard at every use |
| Phase 2 | Anonymous `user_id` on runs, but no anonymous read endpoint yet | The observer path is Phase 4/5; storing the nullable id now avoids a migration then, and inventing a public read endpoint before its consumer exists would be guessing |
| Phase 3 | Rule-based algorithm | Explainable, debuggable, no training data needed |
| Phase 4 | One `SessionEngine` runs both policies over a *single* arrival sequence, and every tick carries both | The product's whole claim is a comparison. Two runs over two random arrival streams would compare the seeds, not the policies; one sequence makes the numbers line up tick for tick |
| Phase 4 | Pause is a backend gate (`asyncio.Event` per session), not a client-side freeze | Pausing in the browser would let the run advance behind the frozen panel and jump on resume. The run belongs to the backend; the client asks it to hold and the hold lands on a tick boundary |
| Phase 4 | Per-strategy `vehiclesProcessed` map in the tick, and the mock generator (`services/metrics.ts`) deleted | The mode toggle re-reads the same run without restarting it, so a single number would relabel one policy's total as the other's; and once the stream is real, a labelled fake beside it is the second source of truth this project exists to disprove |
| Phase 4 | The stream controller is module-level, not hook-owned | The run's lifetime is the store's, not a screen's: a hook-owned connection would reset the run whenever the operator left the dashboard |
| Phase 4 | `sentAt` stamped on every streamed event in `_emit`, not in the engine | One-way latency is unmeasurable without a send time, and putting it in the engine would make the benchmark and its tests time-dependent. A send time is a property of the wire, so it is added where the wire is |
| Phase 5 | Runs are filed by the client on stop, not by the socket hub | `session_ended` carries no evidence, and the run's lifetime is the store's, so the client is the only layer that knows a run stopped *and* has its samples. Recording in the hub would mean keeping the rows it currently only emits |
| Phase 5 | Evidence posted in batches, idempotent on `(tick, strategy)`, duplicates counted | A retry after a dropped response is normal; a sampler stuck replaying one window is a bug. Swallowing duplicates silently would make both look the same in the response |
| Phase 5 | Samples captured at the chart's cadence — two rows per window, capped at 3600 — not the tick's | Ten minutes at 10 Hz is 12 000 near-identical rows. A report is evidence, not a trace; and 3600 stays far below the 20 000 batch cap, so a flush is always one request |
| Phase 5 | One `GET /reports/{id}` that *nests* the session instead of flattening its frames | `adaptive`/`fixed` already live on the session read; copying them alongside gives the same numbers two spellings. Nesting also means the screen and the exporters read one query, so a download cannot disagree with the screen that launched it |
| Phase 5 | PDF laid out with `reportlab` from the report's own numbers, with a computed verdict | A screenshot of the page is not a report, and a fixed verdict sentence would survive being wrong. Building the page from the data keeps the file checkable, and `reportlab` is pure Python, so the image gains no compiler |
| Phase 5 | CSV is long format with CRLF, a UTF-8 BOM and dot decimals | Excel on Windows is the reader that matters and it guesses both wrong: the BOM fixes the accents, CRLF fixes older versions' row breaks. Dot decimals because the file is data, not a locale render |
| Phase 5 | History merges server and browser rows, badged per row; a stopped run is written locally first | A guest run has no account to belong to and cannot be pushed anywhere — hiding it would erase a demo, and showing it unlabelled would let a browser-only row pass for a stored one. Writing locally first means a failed post leaves the evidence visible instead of losing it. A local row offers no download button, because a button that 404s teaches distrust rather than the limit |

---

## Open questions

- [x] Should the observer mode (no login) be a separate route or a login bypass?
      → **Decided: its own route, `/observer`,** public and passwordless. Keeps
      `/login` free of conditional logic. The route exists as of Sprint 1-C and
      renders a placeholder until Sprint 1-D gives it the simulation.
- [ ] Max vehicles per session to keep the scene at ≥ 30 FPS? Real question is
      whether to cap simulation speed rather than vehicle count — the engine already
      clamps `dt` to 1/20 s, so a backgrounded tab cannot fast-forward the junction.
- [ ] Store session state in Redis for multi-instance deploy, or PostgreSQL is enough?

## Decisions log (cross-referenced)

| Decision | Where it lives |
| :--- | :--- |
| React 19 + oxlint instead of React 18 + ESLint | `PRODUCT.md` § Stack, `AGENTS.md` tech stack table |
| Interface copy in Spanish, code and commits in English | `PRODUCT.md`, `GUIA_COMMITS.md` § 2 |
| Congestion is red, emergency preemption is blue (resolves an ambiguity in the brief) | `DESIGN.md` § Colors |
| Observer mode is a public `/observer` route | `PRODUCT.md`, above |
