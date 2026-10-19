import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Joins conditional class names and resolves conflicting Tailwind utilities so
 * that a caller's `className` always wins over a component's own defaults.
 *
 * Without `twMerge`, passing `px-8` to a component whose base already sets
 * `px-4` produces both classes and the outcome depends on stylesheet order
 * rather than on intent.
 *
 * The custom font sizes have to be registered here as sizes. Without this,
 * `twMerge` reads `text-micro` / `text-display` / `text-metric` as unknown
 * `text-*` utilities, puts them in the text-colour group, and silently drops
 * the size when a colour like `text-primary` is merged after it.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'display', 'metric'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
