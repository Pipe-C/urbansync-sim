import { useId } from 'react'

import { cn } from '@/utils/cn'

export interface ConfigSliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** Shown beside the label, set in mono — this is a measured value. */
  format?: (value: number) => string
  hint?: string
  error?: string | null
  disabled?: boolean
  onChange: (value: number) => void
}

/**
 * One parameter, one slider, one live value.
 *
 * The readout is mono and tabular like every other number the operator reads,
 * and it moves while the slider is dragged: the configuration screen's whole
 * argument is that these numbers mean something, and a value that only appears
 * on submit would make the slider a guessing game.
 *
 * Hint and error follow `Field`'s contract — wired through `aria-describedby`,
 * error also through `aria-invalid` — so a rejected configuration is announced
 * the same way a rejected login is.
 */
export function ConfigSlider({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  hint,
  error,
  disabled,
  onChange,
}: ConfigSliderProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-mono text-micro uppercase text-muted">
          {label}
        </label>
        <span className="tabular font-mono text-sm text-primary" aria-hidden="true">
          {format ? format(value) : value}
        </span>
      </div>

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className={cn(
          // The hit box is 44px on touch and 32px on desktop, per the density
          // split in DESIGN.md; the visible track is drawn by the track
          // pseudo-elements because the native one disappears the moment the
          // input is restyled. Painting the track on the input itself was the
          // earlier version, and it pinned the whole touch target to 8px.
          'w-full cursor-pointer appearance-none bg-transparent',
          'h-11 md:h-8',
          '[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-elevated',
          '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent',
          '[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full',
          '[&::-webkit-slider-runnable-track]:bg-elevated',
          '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
          '[&::-webkit-slider-thumb]:bg-accent',
          disabled && 'cursor-not-allowed opacity-60',
        )}
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
