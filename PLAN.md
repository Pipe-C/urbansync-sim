# PLAN.md — UrbanSync Sim
## Implementation Roadmap

> Living document. Update sprint status as work progresses.
> Current focus: **Phase 1 — Frontend Foundation**

---

## Phases overview

| Phase | Name | Status | Outcome |
|---|---|---|---|
| 1 | Frontend Foundation | 🟡 In progress | Visual shell + simulation canvas running |

### Sprint 1-A status — ✅ complete

Delivered: Vite 8 + React 19 + TS 6 scaffold, TailwindCSS v3 with the
`DESIGN.md` token set, `@/` path aliases, oxlint + Prettier, `.env.example`,
`PRODUCT.md` + `DESIGN.md`, and the folder structure from `AGENTS.md`.

Deviations from the original plan, both confirmed with the user:
**React 19** instead of React 18, and **oxlint** instead of ESLint. The
rationale is recorded in `PRODUCT.md` § Stack.
| 2 | Backend API | ⬜ Pending | REST endpoints + auth working |
| 3 | Simulation Algorithm | ⬜ Pending | Adaptive logic running in backend |
| 4 | Real-time Integration | ⬜ Pending | Frontend ↔ Backend live via WebSocket |
| 5 | Persistence + Reports | ⬜ Pending | Sessions stored, reports exportable |
| 6 | Polish + Deploy | ⬜ Pending | Vercel + Railway live URLs |

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

- [ ] Init Vite project: `npm create vite@latest frontend -- --template react-ts`
- [ ] Install and configure TailwindCSS v3
- [ ] Install Impeccable: `npx impeccable install` → then `/impeccable init` in Claude Code
- [ ] Fill `PRODUCT.md`: audience = students + professors + urban planners;
      goal = demonstrate adaptive traffic light algorithm
- [ ] Fill `DESIGN.md`: dark theme, navy/teal/amber palette, Inter font
- [ ] Configure path aliases in `vite.config.ts` (`@/` → `src/`)
- [ ] Configure absolute imports in `tsconfig.json`
- [ ] Set up ESLint + Prettier with strict rules
- [ ] Install core dependencies:
  ```
  npm i zustand axios socket.io-client recharts phaser
  npm i -D @types/node
  ```
- [ ] Create folder structure as defined in AGENTS.md
- [ ] Commit: `chore: project scaffolding`

---

### Sprint 1-B — Design system and base components
*Target: a component library that every page will use.*

Before building any component, run:
```
/impeccable design base UI component library for urban intelligence dashboard
```

**Base components to build (`src/components/ui/`):**

- [ ] `Button` — variants: primary, secondary, ghost, danger; sizes: sm, md, lg
- [ ] `Badge` — variants: green (flowing), amber (moderate), red (congested), blue (emergency)
- [ ] `Card` — container with consistent padding, border, optional header
- [ ] `Stat` — metric display: value (large) + label + optional trend arrow
- [ ] `Spinner` — loading indicator used throughout
- [ ] `EmptyState` — illustrated empty state with title + description + optional action
- [ ] `ErrorBoundary` — catches render errors, shows recovery UI
- [ ] `Tooltip` — lightweight wrapper around a native title or custom overlay

**Layout components (`src/components/layout/`):**

- [ ] `AppShell` — root layout: sidebar + top bar + main content area
- [ ] `Sidebar` — navigation links, collapsed state on mobile
- [ ] `TopBar` — page title, user avatar, connection status indicator
- [ ] `PageHeader` — title + description + optional action button (right-aligned)

After building: `impeccable audit` on the component library.

---

### Sprint 1-C — Authentication screens
*Target: login page that validates credentials and redirects.*

Designs first:
```
/impeccable design login page for a dark-mode city intelligence app
```

- [ ] `LoginPage.tsx` — email + password form, error handling, loading state
- [ ] `authStore.ts` (Zustand) — `{ user, token, login(), logout(), isAuthenticated }`
- [ ] `useAuth.ts` hook — wraps store, exposes clean API to components
- [ ] `ProtectedRoute.tsx` — redirects unauthenticated users to `/login`
- [ ] Mock auth service: `services/auth.ts` returns a fake JWT for now
- [ ] React Router setup: `/login`, `/dashboard`, `/config`, `/reports`

**Acceptance criteria:**
- Login with `admin@urbansync.sim` / `admin123` works (mock)
- Failed login shows inline error, not a page redirect
- Loading state visible while "request" is in flight
- Redirects to `/dashboard` on success

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
- [ ] Download button (disabled until Phase 5, shows tooltip explaining why)
- [ ] Empty state for when no sessions exist yet

---

### Sprint 1-G — Cross-cutting concerns
*Before Phase 1 is done, these must be solid.*

- [ ] **Responsive breakpoints:** all pages work at 375px, 768px, 1280px, 1440px
- [ ] **Error states:** every async operation has an error UI
- [ ] **Loading states:** skeleton loaders on metrics, spinner on canvas init
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
| Sprint 1-E | Phaser 3 over vanilla Canvas | Physics, tweens, scene management built-in |
| Sprint 1-F | Zod + react-hook-form | Type-safe form validation, minimal re-renders |
| Phase 2 | python-socketio over FastAPI WS | Better rooms, namespaces, auto-reconnect |
| Phase 3 | Rule-based algorithm | Explainable, debuggable, no training data needed |

---

## Open questions

- [x] Should the observer mode (no login) be a separate route or a login bypass?
      → **Decided: its own route, `/observer`,** public and passwordless. Keeps
      `/login` free of conditional logic. To be designed in Sprint 1-C.
- [ ] Max vehicles per session to keep Phaser at ≥ 30 FPS?
- [ ] Store session state in Redis for multi-instance deploy, or PostgreSQL is enough?

## Decisions log (cross-referenced)

| Decision | Where it lives |
| :--- | :--- |
| React 19 + oxlint instead of React 18 + ESLint | `PRODUCT.md` § Stack, `AGENTS.md` tech stack table |
| Interface copy in Spanish, code and commits in English | `PRODUCT.md`, `GUIA_COMMITS.md` § 2 |
| Congestion is red, emergency preemption is blue (resolves an ambiguity in the brief) | `DESIGN.md` § Colors |
| Observer mode is a public `/observer` route | `PRODUCT.md`, above |
