# AGENTS.md — UrbanSync Sim

> Context file for AI agents working on this codebase.
> Read this before touching any file. If something contradicts it, ask before assuming.

---

## What this project is

**UrbanSync Sim** is a web-based intelligent traffic intersection simulator.
It demonstrates how an adaptive traffic light algorithm outperforms fixed-cycle
semaphores, with real-time prioritization of emergency vehicles.

This is an academic MVP designed to be demonstrable, deployable, and readable by
a professor with a technical background. Code quality matters as much as
functionality — it should look like it was written by a senior developer.

---

## Architecture overview

```
urbansync-sim/
├── frontend/          # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/        # Reusable UI pieces
│   │   │   ├── ui/            # Base components (Button, Badge, Card…)
│   │   │   ├── simulation/    # Phaser.js wrappers
│   │   │   ├── dashboard/     # Metrics panels, charts
│   │   │   └── layout/        # AppShell, Sidebar, Header
│   │   ├── pages/             # Route-level components
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ConfigPage.tsx
│   │   │   └── ReportsPage.tsx
│   │   ├── hooks/             # Custom React hooks
│   │   ├── store/             # Zustand slices
│   │   ├── services/          # HTTP client (Axios) + WebSocket
│   │   ├── simulation/        # Phaser.js scenes and game objects
│   │   │   ├── scenes/        # IntersectionScene, UIScene
│   │   │   ├── entities/      # Vehicle, TrafficLight, Lane
│   │   │   └── events/        # Event bus between Phaser ↔ React
│   │   └── types/             # Shared TypeScript interfaces
│   ├── PRODUCT.md             # Impeccable: audience + goals
│   ├── DESIGN.md              # Impeccable: design system tokens
│   └── package.json
│
├── backend/           # Python 3.11 + FastAPI
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/        # REST endpoints (auth, sessions, reports)
│   │   │   └── ws/            # WebSocket handlers
│   │   ├── core/              # Config, security, dependencies
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── algorithm/     # Adaptive traffic control logic
│   │   │   └── simulation/    # Simulation tick engine
│   │   └── db/                # Session factory, migrations (Alembic)
│   ├── tests/
│   ├── requirements.txt
│   └── main.py
│
├── AGENTS.md          ← you are here
├── PLAN.md            # Implementation roadmap
├── PRODUCT.md         # Impeccable context (audience, goals)
└── DESIGN.md          # Impeccable design tokens and conventions
```

---

## Tech stack — rationale included

| Layer | Technology | Why |
|---|---|---|
| Frontend framework | React 19 + TypeScript + Vite 8 | Fast DX, strict typing, ecosystem |
| Styling | TailwindCSS v3 | Utility-first, consistent spacing |
| Lint + format | oxlint + Prettier | oxlint is Rust-based and ~50x faster; Vite's default |
| Design skill | **Impeccable** (see below) | Gives the agent design expertise |
| 2D Simulation | Phaser.js 3 | Mature game engine, 60 FPS canvas |
| State management | Zustand | Lightweight, no boilerplate |
| Charts | Recharts | React-native, responsive, simple API |
| HTTP client | Axios | Interceptors for auth token injection |
| Real-time | Socket.io-client | Pairs with FastAPI socketio backend |
| Backend | Python 3.11 + FastAPI | Async, typed, auto-docs |
| ORM | SQLAlchemy 2.0 + Alembic | Modern async ORM + migrations |
| Database | PostgreSQL 15 | Relational, free on Railway |
| Auth | JWT (python-jose + passlib bcrypt) | Stateless, standard |
| Deploy (FE) | Vercel | Free, automatic preview URLs |
| Deploy (BE) | Railway | Free tier includes PostgreSQL |

---

## Design skill — Impeccable

Impeccable is installed at the project root (`npx impeccable install`).
It gives the agent design vocabulary and critique capabilities that prevent
generic, uninspired UI.

**When doing any frontend work:**
- Run `/impeccable init` if `PRODUCT.md` or `DESIGN.md` don't exist yet.
- Before building a new page or component: describe it in chat, then use
  `/impeccable` or `impeccable shape <description>` to get a design brief.
- After building: run `impeccable audit` to catch implementation problems.
- Use `impeccable polish` on finished pages before committing.
- Use `impeccable critique` when something feels off but you can't name it.

**Key commands for this project:**
```
/impeccable design the simulation dashboard with dark mode
/impeccable bolder  the traffic light status indicators
/impeccable harden  the WebSocket reconnection UI states
/impeccable typeset the metrics panel
```

The visual target: a **dark-mode city intelligence interface** — professional,
data-dense but readable, with color used purposefully (green = flow, amber =
warning, red = congestion or emergency). Not a generic dashboard template.

---

## Code conventions

### TypeScript (frontend)

```typescript
// ✅ Named exports for components
export function SimulationCanvas({ config }: SimulationCanvasProps) {}

// ✅ Interfaces for props, types for unions
interface SimulationCanvasProps {
  config: SimulationConfig;
  onVehicleEvent?: (event: VehicleEvent) => void;
}

// ✅ Barrel exports per folder
// components/simulation/index.ts
export { SimulationCanvas } from './SimulationCanvas';
export { TrafficLightOverlay } from './TrafficLightOverlay';

// ✅ Explicit return types on hooks
function useWebSocket(url: string): WebSocketState {}

// ❌ Never use `any`. Use `unknown` and narrow it.
// ❌ Never suppress TS errors with @ts-ignore without a comment explaining why.
```

### React patterns

```typescript
// ✅ Collocate state close to where it's used
// ✅ Lift to Zustand only when 2+ unrelated components need it
// ✅ One component per file. File name = component name.
// ✅ Custom hooks extract logic from components

// ✅ Event bus between Phaser and React (not direct coupling)
// frontend/src/simulation/events/SimulationEventBus.ts
```

### Python (backend)

```python
# ✅ Async everywhere — never sync DB calls in route handlers
# ✅ Pydantic schemas for all request/response — never return ORM models directly
# ✅ Services contain business logic — routes only orchestrate
# ✅ Dependency injection via FastAPI Depends()

# Example route:
@router.post("/sessions", response_model=SessionSchema, status_code=201)
async def create_session(
    payload: CreateSessionPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionSchema:
    return await session_service.create(db, user_id=current_user.id, payload=payload)
```

### Git

- Branch: `feat/<feature>`, `fix/<issue>`, `chore/<task>` — **in English**
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)
- **Commit messages are always in English** — type, scope, subject and body.
  Code, identifiers and comments in English too. Project docs may be Spanish.
- One logical change per commit. No "fix stuff" or "wip".
- Every commit must build on its own: no commit may import code that a later
  commit introduces. Verify with `npm run build` before committing.
- Full reference: `GUIA_COMMITS.md` (types, scopes, dependency order, examples).

---

## Simulation architecture — Phaser ↔ React boundary

Phaser owns the canvas. React owns the UI. They communicate through an event
bus — never through direct method calls or shared mutable state.

```
React (Zustand store)
    ↕ dispatch / subscribe
SimulationEventBus (typed EventEmitter)
    ↕ emit / on
Phaser.js Scene (IntersectionScene)
```

The backend pushes simulation ticks over WebSocket:
```
Backend (algorithm tick every ~100ms)
    → WebSocket message: { type: "tick", state: SimulationState }
    → Socket.io client receives it
    → Updates Zustand store
    → SimulationEventBus emits "stateUpdate"
    → Phaser scene reads new state and renders it
```

---

## Environment variables

```bash
# frontend/.env.local
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000

# backend/.env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/urbansync
SECRET_KEY=<random-256-bit-key>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
ENVIRONMENT=development
```

---

## Running the project

```bash
# Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head # run migrations
uvicorn main:app --reload --port 8000

# Database (Docker)
docker run -d -p 5432:5432 \
  -e POSTGRES_DB=urbansync \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=pass \
  postgres:15
```

---

## What NOT to do

- Don't call the database from inside Phaser scenes.
- Don't put business logic in route handlers.
- Don't use `useEffect` to sync derived state — compute it with selectors.
- Don't hardcode colors — use Tailwind tokens and CSS custom properties.
- Don't skip TypeScript types to "move faster" — it always costs more later.
- Don't build UI without running `impeccable audit` first.

---

## Definition of Done (per feature)

A feature is done when:
1. TypeScript compiles with no errors (`tsc --noEmit`).
2. The component works at mobile (375px) and desktop (1440px).
3. Empty state, loading state, and error state are all handled.
4. `impeccable polish` has been run and obvious issues addressed.
5. The feature is reachable from the app's navigation.
