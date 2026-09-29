import { palette } from './tailwind-palette.js'

/**
 * Publishes the palette as CSS custom properties.
 *
 * A chart library takes its colours as strings, not as classes, so `text-flow`
 * cannot reach an SVG `<line stroke="…">`. The usual workaround is to paste the
 * hex into the chart component, which creates a second definition of the
 * palette that nobody remembers to update. This plugin derives the variables
 * from the same object `tailwind.config.js` builds the utilities from, so the
 * hex lives in exactly one place and the chart cannot drift out of sync with
 * the design system.
 *
 * Values are emitted as space-separated RGB channels rather than hex, so they
 * compose with an alpha: `rgb(var(--color-flow) / 0.4)`.
 */

/** `#abc` and `#aabbcc` both have to work; Tailwind configs use both. */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

function toChannels(color) {
  const hex = color.slice(1)
  const full = hex.length === 3 ? [...hex].map((char) => char + char).join('') : hex
  const int = Number.parseInt(full, 16)
  const red = Math.floor(int / 65536) % 256
  const green = Math.floor(int / 256) % 256
  const blue = int % 256

  return `${red} ${green} ${blue}`
}

/**
 * Flattens the nested scale into `--color-<path>` pairs. `accent.DEFAULT`
 * becomes `--color-accent`, matching the class that generates it, and
 * `accent.dim` becomes `--color-accent-dim`.
 *
 * Non-hex entries are skipped rather than parsed. `transparent` in particular
 * would otherwise become `NaN NaN NaN` — not a fallback value but an invalid
 * declaration, and one bad entry makes the minifier discard the entire `:root`
 * rule, taking every other variable with it. A guard that looks paranoid until
 * the day someone adds a keyword colour is the cheapest bug fix in the build.
 */
function flatten(colors, prefix = 'color') {
  const out = {}

  for (const [key, value] of Object.entries(colors)) {
    if (typeof value === 'string') {
      if (HEX.test(value)) {
        out[`--${prefix}-${key}`] = toChannels(value)
      }
      continue
    }

    if (value && typeof value === 'object') {
      const { DEFAULT, ...rest } = value

      if (typeof DEFAULT === 'string' && HEX.test(DEFAULT)) {
        out[`--${prefix}-${key}`] = toChannels(DEFAULT)
      }

      Object.assign(out, flatten(rest, `${prefix}-${key}`))
    }
  }

  return out
}

/**
 * Deliberately not curried.
 *
 * A plugin registered in `plugins: [...]` is invoked for its side effects — the
 * return value is discarded. Writing this as `() => ({ addBase }) => {…}`, the
 * shape the `plugin()` helper produces, looks correct and fails silently: the
 * outer function runs, hands back a function nobody calls, and the variables
 * are simply never emitted. No error, no warning, and a bundle that builds
 * clean with `--color-flow` missing from it.
 */
export function paletteVariables({ addBase }) {
  const vars = flatten(palette)

  // `lineStrong` is the one camelCase token in the palette, and
  // `--color-line-strong` is the spelling anyone would guess. Both resolve, so
  // the guess is never wrong and there is only ever one definition.
  if (vars['--color-lineStrong']) {
    vars['--color-line-strong'] = vars['--color-lineStrong']
  }

  addBase({ ':root': vars })
}
