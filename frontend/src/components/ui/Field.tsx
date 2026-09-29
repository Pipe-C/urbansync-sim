import { useId } from 'react'

import { cn } from '@/utils/cn'

export interface FieldProps extends React.ComponentProps<'input'> {
  label: string
  /** Rendered inline beneath the field, never as a toast. */
  error?: string | null
  hint?: string
}

/**
 * A labelled text field with its hint and its error.
 *
 * Two things here are load-bearing rather than stylistic:
 *
 * The border uses `lineStrong` and not `line`. A hairline `line` divider is
 * decorative by design, but the edge of an input is the only thing identifying
 * it as an input, so it has to clear 3:1 against the canvas (WCAG 1.4.11).
 *
 * The error is wired through `aria-describedby` and `aria-invalid`, so it is
 * announced when focus lands on the field rather than only being visible to a
 * sighted user reading the row.
 */
export function Field({ label, error, hint, className, id, ...rest }: FieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="font-mono text-micro uppercase text-muted">
        {label}
      </label>

      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'h-10 w-full rounded-md border bg-canvas px-3 text-sm text-primary',
          'placeholder:text-muted',
          'transition-colors duration-150 ease-signal',
          error ? 'border-congested' : 'border-lineStrong hover:border-accent/60',
          className,
        )}
        {...rest}
      />

      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-xs text-congested">
          {error}
        </p>
      )}
    </div>
  )
}
