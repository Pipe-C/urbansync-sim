import { Spinner } from './Spinner'
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

export interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Swaps the leading icon for a spinner and blocks interaction. */
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium',
        'transition-colors duration-150 ease-signal',
        'disabled:pointer-events-none disabled:opacity-60',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {isLoading ? <Spinner size="sm" label="Procesando" /> : leftIcon}
      {children}
      {rightIcon}
    </button>
  )
}
