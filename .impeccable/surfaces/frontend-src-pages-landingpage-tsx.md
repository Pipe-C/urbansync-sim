---
version: 2
slug: "frontend-src-pages-landingpage-tsx"
primary_target: "frontend/src/pages/LandingPage.tsx"
related_targets:
  - "frontend/src/components/landing/HeroJunction.tsx"
  - "frontend/src/components/landing/DecisionPipeline.tsx"
  - "frontend/src/components/landing/ComparisonTrack.tsx"
  - "frontend/src/components/landing/Reveal.tsx"
  - "frontend/src/components/landing/landing.css"
---

# Landing `/` — surface brief

Scope: one public Persuade surface, the first page at `/`. Visitor mode: Persuade.
Audience: a professor/evaluator or student arriving cold. Job: believe the control
is real and that it beats a fixed cycle, then act. Actions: two doors —
**Entrar** (`/login`, operator/demo) and **Observar** (`/observer`, no credentials).
Proof/content: the dashboard's own scene running in the hero with the engine's
live readouts; the controller's four rules beside the sentence they are currently
producing; the paired comparison drawn as two tapes. No fabricated metric: every
figure on the page is the engine's own reading, and the comparison block prints no
figure at all because it is a schematic. Constraints: Control Room world, Spanish
UI, `aria-hidden` scene, no business claims. Anti-goals: headline-over-subcopy-and-
button, a row of equal cards, a painted poster with no working parts, a marketing
page that names a result it cannot compute.

## Direction contract

THESIS: The strongest proof that the control is real is not a picture of the
junction but the junction itself — already running before anything is clicked,
with its own instruments reading it. The page is an argument in three moves: the
live junction, the rule that runs it, the shape of the comparison. It refuses the
category default (headline, subcopy, a row of equal cards) and it refuses the
instrument-rack framing of the first landing, which demonstrated the mechanism
but let the visitor stand outside it — behind an `aria-hidden` picture with no
readings.

OWN-WORLD: The Control Room, inherited verbatim: Console Black ground, Surface
Navy panels, teal as the only interactive voice, the four signal colours reserved
for traffic state, Inter for prose and JetBrains Mono for every machine value, 1px
hairlines, flat-by-default depth. The hero is the console's own bezel; the readout
strip is the console's own instrument geometry, mono and tabular. No new world is
opened and nothing is borrowed from outside it.

STORY: The visitor learns three things in order. The junction is live — the hero
is the real scene, stepped by the real engine, with real numbers under it. Its
whole law is four readable rules, and the panel beside them prints the sentence
the controller is producing right now. Its argument is a pair — the same vehicle
sequence through both policies — whose shape, not whose number, is on the page.
They believe the control is real because they watch it decide before touching
anything.

FIRST VIEWPORT: A thesis in the visitor's own language — "El cruce no espera un
ciclo." — beside the dashboard's scene in a screen bezel, already live, with a
mono caption naming the crossing and a four-cell readout (Fase, Servidos, Espera
máx., Cola máx.) read from the runner. A mono eyebrow states the method: "Sin
modelo entrenado · Cuatro reglas rastreables". Under it, two doors: **Abrir la
consola** (primary, teal) and **Observar sin cuenta** (secondary). The product
name is the wordmark in the header, not the h1; the heading holds its own weight
and carries the argument. The header is a sticky hairline with three anchor links
and the two doors; the page is a single 1440/375 column that ends on references
and the two doors again.

FORM: revised from the instrument-rack lead (seed `eb15258e`) to the live-junction
thesis on the user's read that the rack demonstrated the mechanism from outside.
The world, palette and type are unchanged; only how much of the product the page
is willing to show changed.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
The landing redesign is verified headlessly (Chrome/SwiftShader) at 1440px and
375px, with console errors empty and no horizontal overflow; reduced motion was
captured separately and resolves to the static `Vista estática` hero over a live
readout strip.
