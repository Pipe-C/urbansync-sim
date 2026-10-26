import { cn } from '@/utils/cn'

export interface ReportSkeletonProps {
  rows?: number
  className?: string
}

/**
 * The history's loading state: the table's own geometry, in tonal bars.
 *
 * **It does not pulse.** The console's rule is that nothing moves unless a state
 * changed, and the only loop it allows is the emergency pulse; a shimmer here
 * would be the third animated thing on a screen whose subject is already a live
 * junction. A quiet skeleton still says "a request is in flight" — the
 * announcement below says so in words, which is the part a screen reader gets.
 *
 * The `aria-busy` region is the whole card, and the visible caption is `sr-only`
 * because the table that replaces it will carry its own caption.
 */
export function ReportSkeleton({ rows = 4, className }: ReportSkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn('rounded-lg border border-line bg-surface p-4', className)}
    >
      <p className="sr-only">Cargando el historial de corridas.</p>

      <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
        <span className="h-2.5 w-28 rounded-sm bg-elevated" />
        <span className="h-2.5 w-16 rounded-sm bg-elevated" />
      </div>

      <div className="mt-3 grid gap-3">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4">
            <span className="h-2.5 flex-1 rounded-sm bg-elevated" />
            <span className="hidden h-2.5 w-16 rounded-sm bg-elevated sm:block" />
            <span className="hidden h-2.5 w-24 rounded-sm bg-elevated sm:block" />
            <span className="h-2.5 w-20 rounded-sm bg-elevated" />
          </div>
        ))}
      </div>
    </div>
  )
}
