# PLAN.md — UrbanSync Sim
## Implementation Roadmap

> Living document. Update sprint status as work progresses.
> Current focus: **Sprint 1-E — Three.js simulation canvas ✅ complete**
> (engine + canvas green; browser verification pending) — next: Sprint 1-F

---

## Phases overview

| Phase | Name | Status | Outcome |
|---|---|---|---|
| 1 | Frontend Foundation | 🟡 In progress | Visual shell + simulation canvas running |
| 2 | Backend API | ⬜ Pending | REST endpoints + auth working |
| 3 | Simulation Algorithm | ⬜ Pending | Adaptive logic running in backend |
| 4 | Real-time Integration | ⬜ Pending | Frontend ↔ Backend live via WebSocket |
| 5 | Persistence + Reports | ⬜ Pending | Sessions stored, reports exportable |
| 6 | Polish + Deploy | ⬜ Pending | Vercel + Railway live URLs |

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
  read. Must be handled in Sprint 1-F, where the disabled download button shows
  a tooltip explaining why. The component's own docstring already carries the
  contract: anything essential must also appear in the element's label.
- **P3 — `Spinner` is static under `prefers-reduced-motion`.** The global
  reduced-motion kill collapses its rotation. The `role="status"` label survives,
  and Sprint 1-G introduces skeleton loaders that carry the loading state on
  layout instead, so this is not worth an exemption from the global kill.

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
- [x] `SimulationControls.tsx` — Start / Pause / Stop buttons + mode toggle
  (Adaptive vs Fixed cycle)
- [x] `metricsStore.ts` (Zustand) — holds mock metrics, updated on interval
- [x] Mock metrics generator: updates every 2s with plausible values
- [x] `simulationStore.ts` (Zustand) — `{ status, mode, config, state }`

### Sprint 1-D status — ✅ complete

Delivered in four commits, in the order `GUIA_COMMITS.md` requires:
`tailwind-palette-vars.js` → `services/metrics.ts` → `stores` → `pages`.

**Routes.** `/dashboard` renders `DashboardPage` inside the shell.
`/observer` is public, shell-less, and starts itself, so a projector or a second
screen can follow a run without authenticating.

**One clock.** `useSimulationClock` is mounted in `DashboardPage` and nowhere
else, and it is the only thing that advances the simulation. It was tempting to
put a clock in each panel so a component could be dropped into a storybook in
isolation; that gives two simulations running in the same tab, each half as fast
as either. The panels read state and are mounted by the page that owns the clock.

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
  every 250 ms for React. `useSimulationClock` remains the only other ticker and
  still advances only the mock metrics — the runner is the model's clock, not a
  second metrics clock.
- **The canvas shows the engine; the metrics stay mock.** Provenance is stated,
  not implied: the canvas carries a «Motor real» badge, the metrics panel its
  «Simulado» one. The mode toggle (adaptive/fixed) lives in `SimulationControls`
  and affects the mock metrics only; `core/` was not touched.
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
```
/impeccable design simulation configuration form, dark mode, technical audience
```
- [ ] `ConfigPage.tsx` — sliders for vehicles/min, type distribution; radio for mode
- [ ] Form validation (Zod + react-hook-form)
- [ ] `configStore.ts` — persists config to localStorage between sessions
- [ ] Preview panel: shows what the distribution looks like before starting

**Reports page:**
- [ ] `ReportsPage.tsx` — table of past sessions with metrics summary
- [ ] `ReportCard.tsx` — expandable row: session date, duration, avg wait, EVP count
- [ ] Download button (disabled until Phase 5, shows tooltip explaining why) —
      the explanation must also render as visible helper text below `md`, because
      `Tooltip` opens on hover and `focus-within` only. Deferred from the Sprint
      1-B audit; 375px is a hard constraint in `PRODUCT.md`.
- [ ] Empty state for when no sessions exist yet

---

### Sprint 1-G — Cross-cutting concerns
*Before Phase 1 is done, these must be solid.*

- [ ] **Responsive breakpoints:** all pages work at 375px, 768px, 1280px, 1440px
- [ ] **Error states:** every async operation has an error UI
- [ ] **Loading states:** skeleton loaders on metrics, spinner on canvas init
      (skeletons also retire the `Spinner` reduced-motion gap noted in Sprint 1-B)
- [ ] **WebSocket status indicator:** TopBar shows connected/reconnecting/offline
- [ ] **Keyboard navigation:** all interactive elements are focusable
- [ ] **Impeccable final pass:** run `impeccable audit` on every page
- [ ] `README.md` — how to run the frontend locally

**Phase 1 is done when:** A professor can open the app, log in, see the
intersection animate with mock data, read metrics, and navigate all screens
without hitting a broken state.

---

## Phase 2 — Backend API

**Goal:** FastAPI server with auth, session management, and WebSocket stub.

**Stack active:** Python 3.11 · FastAPI · SQLAlchemy 2.0 (async) · Alembic ·
PostgreSQL · python-jose · passlib · python-socketio

### Key deliverables

- [ ] Project structure per AGENTS.md
- [ ] Database models: `User`, `Role`, `Session`, `SimulationSession`,
      `SimulationConfig`, `SimulationMetric`, `SimulationReport`
- [ ] Alembic migrations: initial schema
- [ ] Auth endpoints: `POST /auth/login` → JWT, `POST /auth/logout`
- [ ] Auth middleware: JWT validation via `Depends(get_current_user)`
- [ ] Session endpoints: `POST /sessions`, `GET /sessions`, `PATCH /sessions/{id}`
- [ ] Config endpoints: `POST /configs`, `GET /configs/{id}`
- [ ] WebSocket endpoint: `/ws/simulation/{session_id}` — receives config,
      streams `SimulationState` ticks
- [ ] Health endpoint: `GET /health` → `{ status: "ok", db: "ok" }`
- [ ] CORS configured for `localhost:5173` and Vercel preview URLs
- [ ] Dockerfile for local dev

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

- [ ] `services/algorithm/adaptive_controller.py` — core logic
- [ ] `services/algorithm/fixed_controller.py` — reference implementation
- [ ] `services/simulation/tick_engine.py` — manages per-session tickers
- [ ] `services/simulation/vehicle_generator.py` — spawns vehicles per config
- [ ] `services/simulation/state.py` — `SimulationState` dataclass
- [ ] Unit tests for both controllers (pytest)
- [ ] Benchmark: adaptive vs fixed on the same vehicle sequence → export CSV

---

## Phase 4 — Real-time Integration

**Goal:** Frontend shows live data from the real backend algorithm.

- [ ] Replace `mockTicker.ts` with real Socket.io connection
- [ ] `services/socket.ts` — connection manager with auto-reconnect
- [ ] `useSimulation.ts` hook — subscribes to WebSocket, feeds `simulationStore`
- [ ] Backend pushes: `tick`, `phase_change`, `evp_activated`, `session_ended`
- [ ] Frontend reacts to each event type correctly
- [ ] Metrics panel reflects real algorithm output
- [ ] Latency test: tick → canvas render ≤ 150ms on localhost

---

## Phase 5 — Persistence + Reports

**Goal:** Sessions stored in PostgreSQL, reports exportable as PDF/CSV.

- [ ] Persist `SimulationSession` on start/end
- [ ] Persist `SimulationMetric` on session end
- [ ] `GET /reports/{session_id}` → consolidated metrics JSON
- [ ] PDF export: `reportlab` or `weasyprint` on the backend
- [ ] CSV export: Python `csv` module
- [ ] Frontend download button wired to export endpoints
- [ ] Session history table with real data

---

## Phase 6 — Polish + Deploy

**Goal:** Live URLs, documented, presentable to the professor.

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
| Sprint 1-F | Zod + react-hook-form | Type-safe form validation, minimal re-renders |
| Phase 2 | python-socketio over FastAPI WS | Better rooms, namespaces, auto-reconnect |
| Phase 3 | Rule-based algorithm | Explainable, debuggable, no training data needed |

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
