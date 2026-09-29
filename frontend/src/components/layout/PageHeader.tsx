import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  description: string
  /** Right-aligned. A control, a Badge, or a pair of buttons. */
  action?: ReactNode
}

/**
 * The page-level heading, and the document's single `h1`.
 *
 * `TopBar` shows a route label, not a title, so this is where the page's one
 * Display-scale heading lives. It is set at the `display` size from DESIGN.md
 * rather than at a headline size: there is exactly one of these per screen and
 * it has to out-rank every panel header below it.
 */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h1 className="text-display font-semibold text-primary">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-secondary">{description}</p>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
