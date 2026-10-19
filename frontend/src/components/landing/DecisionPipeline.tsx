import { useEffect, useRef, useState } from 'react'

import { Reveal } from '@/components/landing/Reveal'
import { useEngineReadout } from '@/hooks/useEngineReadout'
import { ARM_LABEL, type Arm } from '@/simulation/core'
import { cn } from '@/utils/cn'

const RULES = [
  {
    label: 'Pesaje',
    body: 'Cada vehículo esperando en un acceso suma 1; cada 12 s de espera suman otro punto. La espera se cuenta hasta 120 s, para que una cola vieja no secuestre el cruce.',
  },
  {
    label: 'Decisión',
    body: 'El acceso con más presión pide el verde. Si uno lleva más de tres turnos sin ser servido, pasa primero aunque su presión sea menor: la equidad es un límite, no una preferencia.',
  },
  {
    label: 'Límites',
    body: 'El verde dura entre 11 s y 21 s; el de giro a la izquierda, entre 5 s y 12 s. Después, un todo-rojo vacía la caja antes de liberar el cruce perpendicular.',
  },
  {
    label: 'Emergencia',
    body: 'Una ambulancia en camino interrumpe el turno y se lleva el verde. Al pasar, el control vuelve solo a decidir por presión.',
  },
] as const

export interface DecisionPipelineProps {
  className?: string
}

/**
 * The control law, and the live sentence it is currently producing.
 *
 * Two halves that have to sit together. On the left, the four rules the
 * controller is actually made of, in the order they act. On the right, the
 * engine's own `reason` for the phase it is in right now — the same string the
 * console's footer prints, fading on each change of phase.
 *
 * That pairing is the argument. A list of rules on its own is documentation; a
 * rule list beside the sentence that rule just produced is explainability, and it
 * is the one thing this product claims that a screenshot cannot fake. The left
 * column slides in from the margin, the right one comes into focus like a
 * printout, because they are not the same kind of object and should not arrive
 * the same way.
 */
export function DecisionPipeline({ className }: DecisionPipelineProps) {
  const readout = useEngineReadout()
  const [phaseChanges, setPhaseChanges] = useState(0)
  const lastArm = useRef<Arm | null | undefined>(undefined)

  const arm = readout?.activeArm ?? null
  useEffect(() => {
    if (lastArm.current !== undefined && lastArm.current !== arm) {
      setPhaseChanges((count) => count + 1)
    }
    lastArm.current = arm
  }, [arm])

  return (
    <div
      className={cn('grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12', className)}
    >
      <Reveal variant="slide">
        <ol className="divide-y divide-line border-y border-line">
          {RULES.map((rule) => (
            <li
              key={rule.label}
              className="grid grid-cols-[5.5rem_1fr] gap-4 py-4 sm:grid-cols-[8rem_1fr]"
            >
              <span className="font-mono text-micro uppercase text-muted">{rule.label}</span>
              <p className="text-sm leading-relaxed text-secondary">{rule.body}</p>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal variant="focus">
        <section
          className="flex h-full flex-col rounded-lg border border-line bg-surface p-4"
          aria-label="Trazabilidad en vivo"
        >
          <span className="font-mono text-micro uppercase text-muted">Trazabilidad en vivo</span>

          <div key={phaseChanges} className="mt-4 animate-phase-fade">
            <p className="font-mono text-micro uppercase text-muted">
              Fase {arm === null ? '—' : ARM_LABEL[arm]}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-primary">
              {readout?.reason ?? 'Esperando al motor…'}
            </p>
          </div>

          <p className="mt-auto border-t border-line pt-4 text-xs leading-relaxed text-muted">
            La consola publica la regla que disparó cada cambio de fase, no solo el color. Cualquier
            transición de esta pantalla se puede rastrear hasta una de las cuatro reglas de la
            izquierda.
          </p>
        </section>
      </Reveal>
    </div>
  )
}
