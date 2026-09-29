/**
 * The palette. One definition, two consumers.
 *
 * `tailwind.config.js` turns it into utility classes and the variables plugin
 * turns it into CSS custom properties for the chart layer. Neither one owns it,
 * which is the point: the alternative is the hex appearing in three files and
 * drifting in one of them.
 */

/** @type {import('tailwindcss').Config['theme'] extends { extend: infer E } ? E : never} */
export const palette = {
  // Surfaces — navy, darkest first. The canvas sits on `canvas`.
  canvas: '#070B14',
  surface: '#0D1420',
  elevated: '#131C2B',
  // Hairline divider and region border. Decorative, so it sits below the 3:1
  // non-text threshold on purpose — see `lineStrong` for the borders that are a
  // control's only boundary indicator.
  line: '#1F2A3D',
  // Border for inputs and other controls whose boundary must be perceivable.
  // Meets 3:1 against the canvas (WCAG 1.4.11).
  lineStrong: '#526583',
  // Text. `muted` clears 4.5:1 on every surface, including `elevated`, which is
  // the lightest one and therefore the binding constraint.
  primary: '#E6EDF7',
  secondary: '#93A3BC',
  muted: '#7D8CA6',
  // Brand accent — teal, used for interactive and "system" affordances.
  accent: {
    DEFAULT: '#2DD4BF',
    dim: '#14B8A6',
  },
  // Signal semantics. See DESIGN.md — red is congestion, blue is emergency.
  // They are never interchangeable.
  flow: '#34D399',
  warning: '#FBBF24',
  congested: '#F87171',
  emergency: '#60A5FA',
}
