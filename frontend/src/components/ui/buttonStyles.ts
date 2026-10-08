import { cn } from '@/utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-canvas hover:bg-accent-dim',
  secondary: 'border border-line bg-elevated text-primary hover:border-accent/40',
  ghost: 'text-secondary hover:bg-elevated hover:text-primary',
  danger: 'bg-congested text-canvas hover:brightness-110',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  // `min-h-11` (44px) below the md breakpoint, then the density the console
  // wants above it. A 32px control is fine for a mouse and not fine for a thumb.
  sm: 'min-h-11 px-3 text-xs md:min-h-0 md:h-8',
  md: 'min-h-11 gap-2 px-4 text-sm md:h-10',
  lg: 'min-h-12 gap-2.5 px-6 text-base',
}

const BASE_CLASSES =
  'inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150 ease-signal disabled:pointer-events-none disabled:opacity-60'

export interface ButtonClassOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

/**
 * The button's classes, without the button.
 *
 * A control that navigates has to be a real anchor so the browser can open it in
 * a new tab, copy its address or read it as a link. `Button` renders a `<button>`,
 * so those call sites need the styling without the element — exporting the class
 * builder keeps them from copying the token list and drifting from it.
 *
 * It lives outside `Button.tsx` so that file exports only a component; a module
 * that mixes the two defeats fast refresh.
 */
export function buttonClassName({
  variant = 'primary',
  size = 'md',
  className,
}: ButtonClassOptions = {}): string {
  return cn(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className)
}
