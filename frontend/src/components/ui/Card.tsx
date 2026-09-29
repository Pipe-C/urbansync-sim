import { cn } from '@/utils/cn'

export interface CardProps extends React.ComponentProps<'section'> {
  title?: string
  description?: string
  /** Right-aligned in the header row. */
  action?: React.ReactNode
  padding?: 'none' | 'sm' | 'md'
}

const PADDING_CLASSES: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
}

export function Card({
  title,
  description,
  action,
  padding = 'md',
  className,
  children,
  ...rest
}: CardProps) {
  const hasHeader = Boolean(title || description || action)

  return (
    <section
      className={cn(
        'rounded-lg border border-line bg-surface',
        PADDING_CLASSES[padding],
        className,
      )}
      {...rest}
    >
      {hasHeader && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-medium text-primary">{title}</h2>}
            {description && <p className="mt-1 text-xs text-muted">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
