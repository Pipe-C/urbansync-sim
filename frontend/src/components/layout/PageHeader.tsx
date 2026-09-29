import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  description: string
  /** Right-aligned. A control, a Badge, or a pair of buttons. */
  action?: ReactNode
}

/**
 * The page-level heading. `h1` lives in `TopBar`; this is an `h2` because the
 * shell already owns the document's single top-level heading.
 */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight text-primary">{title}</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-secondary">{description}</p>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
