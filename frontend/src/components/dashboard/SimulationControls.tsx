import { PauseIcon, PlayIcon, StopIcon } from '@/components/ui/Icon'
import { Badge, Button, type BadgeTone } from '@/components/ui'
import { useRovingRadioGroup } from '@/hooks/useRovingRadioGroup'
import { useSimulationStore } from '@/store/simulationStore'
import { cn } from '@/utils/cn'
import type { ControlMode, SimulationStatus } from '@/types/metrics'

/**
 * Transport and policy for the run.
 *
 * The mode toggle is the most important control on this screen and it is
 * deliberately not styled as a settings switch. It does not change what the
 * simulation shows; it changes which strategy the readings are taken from, and
 * the two strategies are always being simulated side by side. So the label says
 * which one you are looking at, and the line beneath says why that is a
 * meaningful question to ask.
 */

const MODE_OPTIONS: { value: ControlMode; label: string }[] = [
  { value: 'adaptive', label: 'Adaptativo' },
  { value: 'fixed', label: 'Ciclo fijo' },
]

const STATUS_TONE: Record<SimulationStatus, BadgeTone> = {
  idle: 'neutral',
  running: 'flow',
  paused: 'warning',
}

const STATUS_LABEL: Record<SimulationStatus, string> = {
  idle: 'En espera',
  running: 'En curso',
  paused: 'En pausa',
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export interface SimulationControlsProps {
  className?: string
}

export function SimulationControls({ className }: SimulationControlsProps) {
  const status = useSimulationStore((state) => state.status)
  const mode = useSimulationStore((state) => state.mode)
  const elapsedSeconds = useSimulationStore((state) => state.elapsedSeconds)
  const start = useSimulationStore((state) => state.start)
  const pause = useSimulationStore((state) => state.pause)
  const stop = useSimulationStore((state) => state.stop)
  const setMode = useSimulationStore((state) => state.setMode)

  const isRunning = status === 'running'
  const hasRun = status !== 'idle'
  const { getRadioProps } = useRovingRadioGroup(
    MODE_OPTIONS.map((option) => option.value),
    mode,
    setMode,
  )

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <div
          role="radiogroup"
          aria-label="Política de control"
          className="flex rounded-md border border-line bg-elevated p-0.5"
        >
          {MODE_OPTIONS.map((option, index) => {
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
                  // 44px touch target below md, console density above it —
                  // the split DESIGN.md imposes on every control.
                  'rounded px-3 py-1.5 font-mono text-micro uppercase tracking-wider',
                  'min-h-11 md:min-h-0',
                  'transition-colors duration-150 ease-signal',
                  isActive ? 'bg-accent text-canvas' : 'text-secondary hover:text-primary',
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>

      <p className="text-xs leading-relaxed text-muted">
        El mismo tráfico bajo las dos políticas. Cambia la que estás leyendo, no lo que ocurre en el
        cruce.
      </p>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={isRunning ? 'secondary' : 'primary'}
          onClick={isRunning ? pause : start}
          leftIcon={isRunning ? <PauseIcon /> : <PlayIcon />}
          aria-label={isRunning ? 'Pausar simulación' : 'Iniciar simulación'}
        >
          {isRunning ? 'Pausar' : hasRun ? 'Reanudar' : 'Iniciar'}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={stop}
          disabled={!hasRun}
          leftIcon={<StopIcon />}
          aria-label="Detener y reiniciar la simulación"
        >
          Detener
        </Button>

        <span className="tabular ml-auto font-mono text-sm text-secondary">
          {formatElapsed(elapsedSeconds)}
        </span>
      </div>
    </div>
  )
}
