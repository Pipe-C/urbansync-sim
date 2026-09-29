import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Joins conditional class names and resolves conflicting Tailwind utilities so
 * that a caller's `className` always wins over a component's own defaults.
 *
 * Without `twMerge`, passing `px-8` to a component whose base already sets
 * `px-4` produces both classes and the outcome depends on stylesheet order
 * rather than on intent.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
