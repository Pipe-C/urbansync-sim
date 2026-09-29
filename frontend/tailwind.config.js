/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Surfaces — navy, darkest first. The canvas sits on `canvas`.
        canvas: '#070B14',
        surface: '#0D1420',
        elevated: '#131C2B',
        // Hairline divider and region border. Decorative, so it sits below the
        // 3:1 non-text threshold on purpose — see `lineStrong` for the borders
        // that are a control's only boundary indicator.
        line: '#1F2A3D',
        // Border for inputs and other controls whose boundary must be
        // perceivable. Meets 3:1 against the canvas (WCAG 1.4.11).
        lineStrong: '#526583',
        // Text. `muted` clears 4.5:1 on every surface, including `elevated`,
        // which is the lightest one and therefore the binding constraint.
        primary: '#E6EDF7',
        secondary: '#93A3BC',
        muted: '#7D8CA6',
        // Brand accent — teal, used for interactive and "system" affordances
        accent: {
          DEFAULT: '#2DD4BF',
          dim: '#14B8A6',
        },
        // Signal semantics. See DESIGN.md — red is congestion, blue is
        // emergency. They are never interchangeable.
        flow: '#34D399',
        warning: '#FBBF24',
        congested: '#F87171',
        emergency: '#60A5FA',
      },
      fontSize: {
        // Data-dense UI: tight, deliberate steps rather than the default scale.
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
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
  plugins: [],
}
