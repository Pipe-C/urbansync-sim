# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Backend: Python 3.11 + FastAPI, SQLAlchemy 2.0 (async) + Alembic, PostgreSQL 15,
python-jose + passlib for JWT auth, python-socketio for realtime.

Frontend: React 19 + TypeScript + Vite 8, TailwindCSS v3, Phaser.js 3, Zustand,
Recharts, Axios, socket.io-client, react-router-dom, mitt, Zod + react-hook-form.
oxlint + Prettier for lint and format. Deployed to Vercel.

Two version and tooling decisions taken during Sprint 1-A, superseding the
original table in `AGENTS.md`:

- **React 19, not React 18.** Vite 8 and TypeScript 6 are what the current
  create-vite template ships; pairing them with React 18 is the untested path.
  No library in the stack depends on React 18 semantics.
- **oxlint, not ESLint.** oxlint is the create-vite default (Rust, roughly 50x
  faster). Prettier handles formatting.

## Users

**Professor / evaluator (primary).** Technical academic reviewing whether the
adaptive algorithm genuinely outperforms the fixed-cycle baseline. Needs the
comparison to be legible, explainable, and reproducible — the code itself is
part of the evaluation, so clarity and honest instrumentation matter more than
visual spectacle.

**Students (primary).** Operating the simulator to observe how queue pressure
drives phase changes, and to understand emergency vehicle preemption by watching
it happen.

**Urban planners (secondary).** Interested in whether the simulated throughput
and wait-time numbers hold up under realistic arrival distributions.

## Product Purpose

UrbanSync Sim is a web simulator of a single four-way intersection that
demonstrates an adaptive traffic light controller outperforming a fixed-cycle
signal, with real-time preemption for emergency vehicles.

Success means an evaluator can open the app, watch the intersection animate, see
the two controllers diverge on measurable metrics, and reach an informed opinion
about adaptive control — without a spoken explanation from the author.

## Positioning

The claim is not "we built a traffic sim". It is the **paired comparison**: the
adaptive controller and the fixed-cycle controller run against the *same vehicle
sequence*, so the metric delta is attributable to the control law rather than to
differing traffic. The control law is rule-based and explainable on purpose —
a pressure score per phase, a minimum-green interlock, and a priority interrupt —
so an evaluator can trace any single phase change back to a stated rule. No
trained model, no black box, no dataset dependency.

## Operating Context

Academic project, built sprint by sprint against `PLAN.md` and evaluated by
opening the deployed URL. The demo runs live: the author operates the
simulation, switches between adaptive and fixed mode, and triggers an emergency
vehicle to show preemption and the time saved versus the fixed cycle. A
short demo video exists to cover the case where the app is not open live.

Deliberately scoped to one intersection, not a network. The value is in the
control law and its instrumentation, not in city-scale traffic.

## Capabilities and Constraints

Confirmed capabilities:

- Four-way intersection with two lanes per direction, animated vehicles, and
  four-phase signal control.
- Adaptive controller (pressure-based, with minimum-green interlock) and
  fixed-cycle reference controller, switchable live.
- Emergency Vehicle Preemption: interrupt, force green on the emergency lane,
  log the event and the time saved versus the fixed cycle.
- Live metrics: average wait time, vehicles processed, EVP response time, flow
  over time.
- Configurable arrival rate and vehicle type distribution, persisted locally.
- Session history and reportable metrics (export lands in Phase 5).
- Observability and demo affordances: 16:9 viewport support for the simulation
  canvas, clear simulation lifecycle, and a Spanish-language UI.

Hard constraints:

- The simulation canvas must hold at least 30 FPS on a mid-range laptop.
- Tick-to-canvas-render latency at most 150ms on localhost.
- The whole flow must work at 375px, 768px, 1280px and 1440px.
- No broken states: every screen has an empty, loading and error state.
- The algorithm must stay explainable — no learned policy.

Naming note: "session" is overloaded. A *simulation session* is one run with its
own configuration, metrics and report. It is not a login session.

Language: the user-facing interface is in **Spanish**. Code, identifiers, comments
and commit messages are in English.

## Brand Commitments

Product name is **UrbanSync Sim** and is fixed. The visual target is a
dark-mode city intelligence interface: professional, data-dense but readable,
colour used purposefully (green = flow, amber = warning, red = congestion or
emergency). Explicitly *not* a generic dashboard template. The audience reads
this as an operations tool, so restraint and legibility beat decoration.

Interface copy is in Spanish. Technical identifiers in the UI that have no
natural Spanish equivalent (EVP) stay in English.

## Evidence on Hand

There is **no empirical evidence yet**. Specifically, future work must not
fabricate any of the following:

- No measured adaptive-versus-fixed comparison. The benchmark that would
  produce one is scheduled for Phase 3.
- No real arrival-rate or vehicle-type data. The distributions driving the
  simulator are modelled, and must be labelled as modelled wherever they are
  presented as a result.
- No testimonials, users, citations, or institutional claims of any kind.
- No screenshots or demo video yet; the recording is scheduled for Phase 6.

`PLAN.md` and `AGENTS.md` are the only prior artifacts, and both are internal
planning documents, not external evidence.

## Product Principles

1. **Prove, don't decorate.** Every visual claim traces to a number the
   algorithm produced. If there is no metric behind it, it does not go in the UI.
2. **The comparison is the product.** A single mode is a simulator; two modes on
   the same vehicle sequence is evidence.
3. **Explainability is a feature.** The control law is inspectable and its
   decisions are narrated, because a professor is the reader.
4. **Simulation is not a game.** No score, no rewards, no playful framing. The
   visual language is operational.
5. **Honest states over optimistic ones.** Empty, loading, reconnecting and
   error states get real design effort, not placeholders.

## Accessibility & Inclusion

Every interactive element must be keyboard reachable with a visible focus ring.
Traffic light state must never be conveyed by colour alone — the signal
component carries a text or shape cue as well, since a red/green distinction is
the single most common form of colour-only encoding in this product.

The console and metrics panel must remain readable at 375px width. Data-dense
panels are permitted to reflow or scroll, not to truncate numbers.
