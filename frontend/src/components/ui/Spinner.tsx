import { cn } from '@/utils/cn'

export type SpinnerSize = 'sm' | 'md' | 'lg'

const SIZE_PX: Record<SpinnerSize, number> = {
  sm: 14,
  md: 20,
  lg: 32,
}

export interface SpinnerProps {
  size?: SpinnerSize
  /** Announced to assistive tech and shown to nobody else. Spanish, per PRODUCT.md. */
  label?: string
  className?: string
}

export function Spinner({ size = 'md', label = 'Cargando', className }: SpinnerProps) {
  const px = SIZE_PX[size]

  return (
    <span role="status" className={cn('inline-flex shrink-0', className)}>
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        /* `ui-spinner` is the reduced-motion escape hatch in index.css: rotation
           collapses to a slow opacity breath so the loading signal survives. */
        className="ui-spinner animate-spin text-accent"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={2.5} opacity={0.25} />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}
