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
        line: '#1F2A3D',
        // Text
        primary: '#E6EDF7',
        secondary: '#93A3BC',
        muted: '#5D6B84',
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
      transitionTimingFunction: {
        signal: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'priority-pulse': {
          '0%, 100%': { opacity: '0.35', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.08)' },
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
