# PLAN.md — UrbanSync Sim
## Implementation Roadmap

> Living document. Update sprint status as work progresses.
> Current focus: **Sprint 1-D — Dashboard layout and metrics panel**

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

**Goal:** A fully navigable frontend with the simulation canvas running on mock
data, styled with Impeccable, responsive, dark-mode, production-quality.

**Stack active in this phase:**
React 19 · TypeScript · Vite 8 · TailwindCSS v3 · Phaser.js 3 · Zustand ·
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
      npm i zustand axios socket.io-client recharts phaser
      npm i -D @types/node
      ```
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
- [x] **Give the viewer something to do.** Hovering a vehicle freezes it where
      it stands and names the approach it is queueing on. Pure CSS, and it is
      the interaction the whole product is about: stopping traffic by hand. It
      is also the only pointer affordance in the scene, so it cannot interfere
      with the form.
- [x] **Let the panel adjust.** The split is now `clamp(22rem, 34%, 34rem)`
      instead of a fixed column, with a floor that keeps the form readable on a
      laptop and a ceiling that stops it swallowing a 4K monitor.

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
│  Sidebar  │  Simulation Canvas (Phaser.js)  70% width  │
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
- [ ] `DashboardPage.tsx` — assembles the layout above
- [ ] `MetricsPanel.tsx` — 3 `<Stat>` cards + `<FlowChart>` (Recharts LineChart)
- [ ] `SimulationControls.tsx` — Start / Pause / Stop buttons + mode toggle
  (Adaptive vs Fixed cycle)
- [ ] `metricsStore.ts` (Zustand) — holds mock metrics, updated on interval
- [ ] Mock metrics generator: updates every 2s with plausible values
- [ ] `simulationStore.ts` (Zustand) — `{ status, mode, config, state }`

After building: `impeccable polish` on DashboardPage.

---

### Sprint 1-E — Phaser.js simulation canvas
*Target: animated 2D intersection running on mock data. This is the wow factor.*

```
/impeccable design 2D overhead traffic intersection with animated vehicles, traffic lights, dark grid
```

**Architecture note:** Phaser runs inside a React component wrapper.
State flows: `simulationStore → SimulationEventBus → IntersectionScene`.

Files to create:

```
src/simulation/
├── PhaserGame.tsx           # React wrapper that mounts/unmounts Phaser
├── config.ts                # Phaser.Game config object
├── events/
│   └── SimulationEventBus.ts  # Typed EventEmitter (mitt)
├── scenes/
│   ├── IntersectionScene.ts   # Main game scene
│   └── UIScene.ts             # HUD overlay (speed, mode label)
└── entities/
    ├── Vehicle.ts             # Phaser.GameObjects.Sprite subclass
    ├── TrafficLight.ts        # 4-state light (green/amber/red/priority)
    └── Lane.ts                # Lane path and queue logic
```

**IntersectionScene must render:**
- [ ] Dark asphalt grid background with lane markings
- [ ] 4-way intersection: N/S/E/W lanes, 2 lanes each direction
- [ ] Pedestrian crossing strips
- [ ] 4 `TrafficLight` objects (one per direction)
- [ ] Vehicles spawning from edges, queuing, moving when green
- [ ] Vehicle types visually distinct: sedan (white), bus (orange), ambulance (red + flash)
- [ ] Emergency vehicle triggers a visible priority pulse effect
- [ ] Smooth 60 FPS animation with tweens (no frame drops)

**Mock data ticker (until backend is ready):**
```typescript
// src/simulation/mockTicker.ts
// Emits fake SimulationState every 150ms
// Simulates vehicle arrivals and phase changes
```

**Acceptance criteria:**
- Simulation runs at ≥ 30 FPS on a mid-range laptop
- Emergency vehicle clearly distinguishable and visually triggers priority
- Traffic lights change correctly from the mock data
- Canvas resizes gracefully on window resize

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
| Sprint 1-C | CSS keyframes for the ambient intersection, not Phaser | The dashboard runs the real engine in 1-E; a login page should not ship a game runtime |
| Sprint 1-C | Mock auth fails slowly and resolves to `null` | An error state that has never run is not an error state; a rejected login is a form outcome, not an exception |
| Sprint 1-E | Phaser 3 over vanilla Canvas | Physics, tweens, scene management built-in |
| Sprint 1-F | Zod + react-hook-form | Type-safe form validation, minimal re-renders |
| Phase 2 | python-socketio over FastAPI WS | Better rooms, namespaces, auto-reconnect |
| Phase 3 | Rule-based algorithm | Explainable, debuggable, no training data needed |

---

## Open questions

- [x] Should the observer mode (no login) be a separate route or a login bypass?
      → **Decided: its own route, `/observer`,** public and passwordless. Keeps
      `/login` free of conditional logic. The route exists as of Sprint 1-C and
      renders a placeholder until Sprint 1-D gives it the simulation.
- [ ] Max vehicles per session to keep Phaser at ≥ 30 FPS?
- [ ] Store session state in Redis for multi-instance deploy, or PostgreSQL is enough?

## Decisions log (cross-referenced)

| Decision | Where it lives |
| :--- | :--- |
| React 19 + oxlint instead of React 18 + ESLint | `PRODUCT.md` § Stack, `AGENTS.md` tech stack table |
| Interface copy in Spanish, code and commits in English | `PRODUCT.md`, `GUIA_COMMITS.md` § 2 |
| Congestion is red, emergency preemption is blue (resolves an ambiguity in the brief) | `DESIGN.md` § Colors |
| Observer mode is a public `/observer` route | `PRODUCT.md`, above |
