/** @type {import('tailwindcss').Config} */
import { palette } from './tailwind-palette.js'
import { paletteVariables } from './tailwind-palette-vars.js'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      // Defined in `tailwind-palette.js` so the variables plugin and the
      // utility classes read the same object. See that file for the reasoning.
      colors: palette,
      fontSize: {
        // Data-dense UI: tight, deliberate steps rather than the default scale.
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
        // The page title. One per screen, per DESIGN.md — `PageHeader` owns it.
        display: ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.02em' }],
        metric: ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.02em' }],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
      maxWidth: {
        shell: '96rem',
      },
      boxShadow: {
        // The only shadow in the system. Reserved for elements that genuinely
        // float above the page: tooltips, dropdowns, modals.
        popover: '0 8px 24px rgb(0 0 0 / 0.55)',
      },
      transitionTimingFunction: {
        signal: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        // Starts and ends at full opacity so that collapsing the animation
        // under `prefers-reduced-motion` leaves the element readable at its
        // actual state instead of dimmed. The dip is the decorative half.
        'priority-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.35', transform: 'scale(0.94)' },
        },
        'phase-fade': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'priority-pulse': 'priority-pulse 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'phase-fade': 'phase-fade 200ms cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [paletteVariables],
}
