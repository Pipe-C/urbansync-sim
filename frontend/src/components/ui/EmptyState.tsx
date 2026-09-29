import type { ReactNode } from 'react'

import { SignalIcon } from './Icon'
import { cn } from '@/utils/cn'

export interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
  className?: string
}

/** An unbuilt intersection, seen from above. Drawn, not photographed. */
function EmptyIntersectionMark() {
  return (
    <svg viewBox="0 0 120 120" width="112" height="112" aria-hidden="true" className="text-muted">
      <g stroke="currentColor" strokeWidth="1" strokeDasharray="4 5" fill="none" opacity={0.7}>
        <path d="M60 6v36M60 78v36M6 60h36M78 60h36" />
        <rect x="38" y="38" width="44" height="44" rx="2" />
      </g>
      <circle cx="60" cy="60" r="5" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  )
}

/**
 * Shown when a surface has no data because nothing has happened yet, as
 * opposed to failing. The distinction matters: an empty reports table is a
 * normal first-run state, a failed request is an error, and they must not look
 * the same.
 */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 rounded-lg border border-line bg-surface px-6 py-12',
        'text-center',
        className,
      )}
    >
      <div className="rounded-md border border-line bg-canvas p-4">
        <EmptyIntersectionMark />
      </div>

      <div className="flex max-w-sm flex-col gap-2">
        <h3 className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
          <SignalIcon className="text-accent" />
          {title}
        </h3>
        <p className="text-sm text-muted">{description}</p>
      </div>

      {action && <div className="pt-1">{action}</div>}
    </div>
  )
}
