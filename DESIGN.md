---
name: UrbanSync Sim
description: Dark-mode city intelligence console for observing an adaptive intersection under load.
colors:
  canvas: "#070B14"
  surface: "#0D1420"
  elevated: "#131C2B"
  line: "#1F2A3D"
  text-primary: "#E6EDF7"
  text-secondary: "#93A3BC"
  text-muted: "#5D6B84"
  accent-teal: "#2DD4BF"
  accent-teal-dim: "#14B8A6"
  signal-flow: "#34D399"
  signal-warning: "#FBBF24"
  signal-congested: "#F87171"
  signal-emergency: "#60A5FA"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.04em"
  metric:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "1.75rem"
    lineHeight: 1.15
    letterSpacing: "-0.02em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent-teal}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-teal-dim}"
  button-secondary:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-danger:
    backgroundColor: "{colors.signal-congested}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  input-focus:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

<!-- SEED: token set extracted from `frontend/tailwind.config.js`. Components are provisional —
     no component library exists yet. Re-run `/impeccable document` after Sprint 1-B lands
     `src/components/ui/` to capture the real component states. -->

# Design System: UrbanSync Sim

## Overview

**Creative North Star: "The Control Room"**

UrbanSync Sim is a console, not a dashboard. The metaphor is a municipal traffic
control room after hours: a dark room, a bank of instruments, and one very bright
screen that holds the thing you came to watch. Everything else in the frame is
instrumentation around that screen — quiet, legible, and deliberately not
competing for attention.

That metaphor sets the density. A control room is dense because the operator
needs the state of six things at once and cannot afford to wait for a page
transition. Panels sit side by side with hairline borders instead of generous
cards floating in whitespace, labels are set in small mono uppercase, and
numbers are tabular so a digit changing on every tick does not shift the
column it sits in.

The restraint is the point. This is an academic instrument whose audience is a
professor reading the code as much as the screen, so decoration would be a form
of dishonesty — it would imply a confidence the evidence does not support. The
aesthetic is deliberately closer to an oscilloscope than to a consumer app.
The rejection is explicit: no glassmorphism, no gradient hero, no playful
framing, no gamified framing of a queue as a score.

**Key Characteristics:**

- Near-black navy canvas; depth comes from tonal steps, not from shadows.
- Teal is the only interactive colour, and it is rare on screen.
- Signal colours (green / amber / red / blue) mean specific traffic states and
  are never used decoratively.
- Mono type for anything numeric or machine-generated; Inter for everything a
  human wrote.
- Data-dense layouts with hairlines rather than floating cards.

## Colors

A four-step navy surface ramp carrying a single teal accent, plus four signal
colours that are reserved and never decorative.

### Primary
- **Signal Teal** (`#2DD4BF`): the system's one interactive voice — primary
  buttons, focus rings, active navigation, and the "running" state of the
  simulation. Use it to mean "you can act here" or "this is live".
- **Deep Teal** (`#14B8A6`): the pressed and hover state of Signal Teal. It is
  never used to introduce a new meaning.

### Neutral
- **Console Black** (`#070B14`): the page and the simulation canvas ground.
- **Surface Navy** (`#0D1420`): panels, cards, and the sidebar. One step up
  from the canvas.
- **Elevated Slate** (`#131C2B`): nested surfaces — inputs, table rows, hover
  fills.
- **Signal Line** (`#1F2A3D`): every border and divider. Hairlines, always 1px.
- **Primary Text** (`#E6EDF7`): headings and metric values. Off-white, never
  pure `#fff` — pure white against near-black vibrates.
- **Secondary Text** (`#93A3BC`): body copy and descriptions.
- **Muted Text** (`#5D6B84`): timestamps, axis labels, disabled states, empty
  state body copy.

### Signal Colors (reserved)
- **Flow Green** (`#34D399`): traffic is flowing. A green phase, a
  below-threshold queue, a metric trending the right way.
- **Warning Amber** (`#FBBF24`): a queue is building but the intersection is
  still inside its operating band.
- **Congestion Red** (`#F87171`): saturation. The queue exceeds the threshold.
- **Emergency Blue** (`#60A5FA`): emergency vehicle preemption is active.

### Named Rules

**The Reserved Signal Rule.** Green, amber, red and blue are diagnostics. They
appear only next to a traffic state, a queue threshold crossing, or a trend
arrow — never as decoration, never as a background wash, never on a heading. A
reviewer should be able to point at any red pixel on screen and say what is
congested.

**The Congestion and Emergency Are Different Colours Rule.** Red means
congestion; blue means an emergency vehicle. This is a deliberate resolution of
an ambiguity in the product brief, and it exists because the two conditions
demand opposite responses: congestion means "the algorithm is working", an
emergency means "the algorithm was interrupted". A user who sees red and blue
must not have to open a tooltip to know whether the system is failing or
responding.

**The One Voice Rule.** Signal Teal occupies no more than roughly 10% of any
screen. Its rarity is what makes it read as interactive. If teal is everywhere,
nothing on the screen is.

## Typography

**Display Font:** Inter (fallback `system-ui, sans-serif`)
**Body Font:** Inter (fallback `system-ui, sans-serif`)
**Label/Mono Font:** JetBrains Mono (fallback `ui-monospace, monospace`)

**Character:** A geometric sans for human-authored text paired with a mono for
everything the machine produced. The split is not stylistic — it is a
legibility contract. A number that arrived from the algorithm is set in mono
with tabular figures so it is unmistakably data, and so a column of values
changing every 150ms does not shimmer. A label that a human wrote stays in
Inter and reads as prose.

### Hierarchy
- **Display** (600, 1.75rem, 1.2, -0.02em): page titles and the primary metric
  on a `Stat`. One per screen.
- **Headline** (600, 1.25rem, 1.3): section headers inside the metrics panel.
- **Title** (500, 0.875rem, 1.4): card headers, sidebar group labels.
- **Body** (400, 0.875rem, 1.5): descriptions, empty state copy, form help.
  Capped at roughly 70ch.
- **Label** (mono 500, 0.6875rem, 0.04em, uppercase): axis labels, table
  headers, section eyebrows, and every state name — `EN VERDE`, `CONGESTIONADO`.
- **Metric** (mono, 1.75rem, 1.15): every live number. Always mono, always
  tabular.

### Named Rules

**The Mono Means Measured Rule.** Any value the algorithm produced is set in
JetBrains Mono with tabular numerals. Any string a human wrote is set in
Inter. If a number is in Inter, it is a placeholder, not a measurement.

**The Uppercase Label Rule.** Labels are mono, 11px, uppercase, and spaced at
0.04em. They are never bold — the size and the case already carry the weight,
and bolding them turns a control room into a ransom note.

## Layout

A fixed sidebar plus a fluid main column, capped at 96rem (`max-w-shell`).
The dashboard splits the main column 70/30: the simulation canvas takes the wide
track, the metrics panel takes the narrow one. That ratio is the layout's
central decision — the canvas is the subject, the metrics are evidence about
the subject, and evidence does not get equal billing.

Spacing follows Tailwind's 4px base, with the 8/16/24/32 steps carrying nearly
all the weight. Density is intentional: a 16px gap between panels, 24px inside a
card, 8px between a label and its value.

Responsive behaviour collapses in three steps. Below 1024px the sidebar becomes
an overlay and the metrics panel drops beneath the canvas. Below 768px the
simulation canvas keeps its full aspect ratio and the metrics panel becomes a
single column. Below 375px nothing is hidden or truncated — data-dense panels
scroll or reflow, but a number is never cut off. Data-dense does not mean
data-lossy.

## Elevation & Depth

Depth is tonal, not cast. The three-step surface ramp (Console Black → Surface
Navy → Elevated Slate) plus a 1px Signal Line border is the entire system. There
are no resting shadows anywhere in the product.

**The Flat-By-Default Rule.** Surfaces are flat at rest. A shadow appears only
as a response to state — hover, focus, or a popover that must read as
detached from the panel behind it. Even then, a border-weight change or a
one-step tonal jump is preferred over a drop shadow, and a drop shadow is used
only when the element genuinely floats (a tooltip, a dropdown).

The reason is legibility of hierarchy: in a room full of instruments, a
permanent shadow reads as noise. Tonal steps read as structure.

## Shapes

Corners are gently rounded and never fully circular. Inputs and buttons use
6px (`rounded-md`), cards and panels 8px (`rounded-lg`), small chips and badges
4px (`rounded-sm`). The single exception is the status dot on a `Badge`, which
is a true circle because a rounded square would read as a rendering bug.

Borders are always 1px Signal Line. There is no 2px border anywhere except the
active-phase marker in the simulation canvas, where weight is the only channel
available for reading a signal head at a glance.

## Components

The component library is built in Sprint 1-B. The entries below are the
contract those components must satisfy, not a record of what exists.

### Buttons
- **Shape:** gently rounded (6px radius).
- **Primary:** Signal Teal fill with Console Black text — the highest-contrast
  pairing available, because a primary action should be unmistakable. Padding
  8px/16px, label in Inter 500 at 14px.
- **Hover / Focus:** Deep Teal on hover. A 2px Signal Teal focus ring with a
  2px canvas offset, applied globally in `index.css` and never removed without
  a replacement.
- **Secondary / Ghost:** Secondary is Elevated Slate fill with Primary Text.
  Ghost is transparent with Secondary Text, and is the default for
  non-committal actions in dense toolbars.
- **Danger:** Congestion Red fill, used only for destructive actions and the
  stop control on the simulation — never for a neutral warning.

### Chips
- **Style:** Elevated Slate background, 4px radius, no border. Mono uppercase
  label at 11px.
- **State:** a `Badge` is a read-only status label; the four semantic variants
  are Flow, Warning, Congested and Emergency, and each pairs its colour with a
  text name. **Never a coloured dot alone** — a red/green pair is the single
  most common colour-only encoding failure in this product, and a user who
  cannot distinguish them cannot use the metrics panel at all.

### Cards / Containers
- **Corner Style:** 8px radius.
- **Background:** Surface Navy, one tonal step above the canvas.
- **Shadow Strategy:** none at rest (see Elevation & Depth).
- **Border:** 1px Signal Line.
- **Internal Padding:** 24px.

### Inputs / Fields
- **Style:** Console Black background on an Elevated Slate context, 6px radius,
  1px Signal Line border, padding 8px/12px. Placeholder text in Muted Text.
- **Focus:** the border shifts to Signal Teal and the global focus ring appears.
  The field does not glow.
- **Error / Disabled:** the border shifts to Congestion Red with the message
  rendered inline below the field, never as a floating toast. Disabled fields
  drop to Muted Text and 60% opacity but keep their label legible.

### Navigation
- **Style:** the sidebar is a Surface Navy column separated from the canvas by
  a single Signal Line border. Items are Inter 500 at 14px on Elevated Slate
  pills, 8px tall, 6px radius.
- **States:** the active item carries a 2px Signal Teal left marker plus Primary
  Text — the marker alone is not enough, so the colour changes with it. Hover
  is a one-step tonal lift, not a colour change.
- **Mobile:** below 1024px the sidebar becomes an overlay drawer with a scrim.
  It is never collapsed to icons; the labels are the navigation.

### Traffic Lights (signature)
- **Style:** a three-lamp head, the one component permitted to be a true circle
  per lamp. The active lamp is filled with its signal colour; inactive lamps
  are 20% opacity of the same hue rather than grey, so the head keeps its
  identity.
- **Priority state:** during emergency preemption the lamp pulses on
  `animate-priority-pulse` and the head gains a 2px Emergency Blue ring. The
  pulse is the only looping animation in the product; nothing else animates
  indefinitely, so the eye is drawn to the interruption and nowhere else.

## Do's and Don'ts

### Do:
- **Do** set every algorithm-produced number in JetBrains Mono with tabular
  figures, via the `tabular` utility.
- **Do** give every signal colour a text label next to it, using the `Badge`
  component rather than a bare dot.
- **Do** keep Signal Teal to interactive elements and reserve the signal
  colours for traffic state.
- **Do** express depth with the surface ramp plus a 1px Signal Line border.
- **Do** show real empty, loading, reconnecting and error states with the same
  care as populated ones.

### Don't:
- **Don't** use Flow Green, Warning Amber, Congestion Red or Emergency Blue for
  anything that is not a traffic state. No gradient headers, no accent
  highlights on section titles.
- **Don't** use Congestion Red and Emergency Blue interchangeably. Red is
  congestion; blue is preemption.
- **Don't** introduce a permanent resting shadow, glassmorphism, or a blurred
  translucent panel. This is a control room, not a consumer app.
- **Don't** animate anything on a loop other than the emergency priority pulse.
  If it moves, it is responding to a state change.
- **Don't** truncate, abbreviate or scroll-hide a metric to make a narrow
  layout fit. Reflow the layout instead.
- **Don't** exceed roughly 10% teal coverage on a screen, and don't use teal
  for a heading or a decorative rule.
