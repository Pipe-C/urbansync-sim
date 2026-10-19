import { useRovingRadioGroup } from '@/hooks/useRovingRadioGroup'
import { useSimulationStore } from '@/store/simulationStore'
import { cn } from '@/utils/cn'
import type { ControlMode } from '@/types/metrics'

/**
 * Which of the two readings the panel headlines.
 *
 * This is not a settings switch. Both strategies are always simulated over the
 * same arrivals; this control changes which one is promoted to the headline and
 * which one becomes the baseline. The label under it says so, because a toggle
 * that looks like it changes the simulation would be lying about the model.
 *
 * The selected state is a sliding plate rather than two repainted buttons. One
 * short move on change is the feedback; there is no loop, and under reduced
 * motion the plate simply arrives.
 */

const OPTIONS: { value: ControlMode; label: string }[] = [
  { value: 'adaptive', label: 'Adaptativo' },
  { value: 'fixed', label: 'Ciclo fijo' },
]

export interface ModeToggleProps {
  className?: string
}

export function ModeToggle({ className }: ModeToggleProps) {
  const mode = useSimulationStore((state) => state.mode)
  const setMode = useSimulationStore((state) => state.setMode)
  const { getRadioProps } = useRovingRadioGroup(
    OPTIONS.map((option) => option.value),
    mode,
    setMode,
  )

  return (
    <div
      role="radiogroup"
      aria-label="Política de control"
      className={cn('relative flex rounded-md border border-line bg-elevated p-0.5', className)}
    >
      {/* The plate is the selection, so it is hidden from assistive tech: the
          radios below carry `aria-checked` and the plate carries no meaning. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0.5 left-0.5 w-[calc(50%_-_0.125rem)] rounded bg-accent',
          'transition-transform duration-200 ease-signal',
          mode === 'fixed' && 'translate-x-full',
        )}
      />

      {OPTIONS.map((option, index) => {
        const isActive = mode === option.value

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setMode(option.value)}
            {...getRadioProps(index)}
            className={cn(
              'relative z-10 flex-1 rounded px-2 py-1.5 font-mono text-micro uppercase tracking-wider',
              // 44px touch target below md, console density above it.
              'min-h-11 md:min-h-0',
              'transition-colors duration-200 ease-signal',
              isActive ? 'text-canvas' : 'text-secondary hover:text-primary',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
