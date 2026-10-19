import { Badge, Button, type BadgeTone } from '@/components/ui'
import { PauseIcon, PlayIcon, StopIcon } from '@/components/ui/Icon'
import { useSimulationStore } from '@/store/simulationStore'
import { cn } from '@/utils/cn'
import type { SimulationStatus } from '@/types/metrics'

/**
 * Transport for the run, mounted on the canvas bezel.
 *
 * These controls used to live at the bottom of the metrics column, below two
 * cards and a chart. At a 900px viewport the empty state said "Pulsa Iniciar"
 * while the button itself was off-screen — the one instruction on the screen
 * pointed at something the user could not see. Transport belongs with the
 * subject it starts, so it sits directly under the junction's header now.
 *
 * The policy toggle is deliberately *not* here. It does not start or stop
 * anything; it selects which of two already-running readings the panel
 * headlines, so it lives at the head of the measurements column.
 */

const STATUS_TONE: Record<SimulationStatus, BadgeTone> = {
  idle: 'neutral',
  running: 'flow',
  paused: 'warning',
}

const STATUS_LABEL: Record<SimulationStatus, string> = {
  idle: 'En espera',
  running: 'Simulando',
  paused: 'En pausa',
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export interface TransportControlsProps {
  className?: string
}

export function TransportControls({ className }: TransportControlsProps) {
  const status = useSimulationStore((state) => state.status)
  const elapsedSeconds = useSimulationStore((state) => state.elapsedSeconds)
  const start = useSimulationStore((state) => state.start)
  const pause = useSimulationStore((state) => state.pause)
  const stop = useSimulationStore((state) => state.stop)

  const isRunning = status === 'running'
  const hasRun = status !== 'idle'
  const elapsed = formatElapsed(elapsedSeconds)

  return (
    <div
      role="group"
      aria-label="Controles de la ejecución"
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
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

      <div className="ml-auto flex items-center gap-3">
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
        <span
          aria-label={`Tiempo simulado: ${elapsed}`}
          className="flex items-baseline gap-1.5 font-mono text-xs text-muted"
        >
          <span aria-hidden="true" className="text-micro uppercase tracking-wider">
            t
          </span>
          <span className="tabular text-sm text-secondary">{elapsed}</span>
        </span>
      </div>
    </div>
  )
}
