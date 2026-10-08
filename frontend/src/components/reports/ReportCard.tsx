import { Fragment, useId, useState } from 'react'

import { Badge } from '@/components/ui'
import { ChevronIcon } from '@/components/ui/Icon'
import type { SessionRecord } from '@/store/sessionsStore'
import { cn } from '@/utils/cn'

export interface ReportCardProps {
  session: SessionRecord
}

function formatStartedAt(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatSeconds(value: number): string {
  return `${formatNumber(value)} s`
}

function formatNumber(value: number): string {
  return value.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function formatCount(value: number): string {
  return value.toLocaleString('es-ES')
}

/**
 * One finished run: the collapsed row, and the comparison behind it.
 *
 * Both strategies' numbers are shown in the detail because both were simulated
 * — the run's whole point is the pair — and the row's wait column carries them
 * as `adaptativo / ciclo fijo` so the comparison is legible without expanding
 * anything. The mode badge is deliberately neutral: green and red are traffic
 * states in this product, and a controller name is not one.
 */
export function ReportCard({ session }: ReportCardProps) {
  const [open, setOpen] = useState(false)
  const detailId = useId()

  const comparison: { label: string; adaptive: string; fixed: string }[] = [
    {
      label: 'Espera media',
      adaptive: formatSeconds(session.adaptive.averageWaitSeconds),
      fixed: formatSeconds(session.fixed.averageWaitSeconds),
    },
    {
      label: 'Caudal',
      adaptive: `${formatNumber(session.adaptive.throughputPerMinute)} veh/min`,
      fixed: `${formatNumber(session.fixed.throughputPerMinute)} veh/min`,
    },
    {
      label: 'Respuesta EVP',
      adaptive: formatSeconds(session.adaptive.emergencyResponseSeconds),
      fixed: formatSeconds(session.fixed.emergencyResponseSeconds),
    },
    {
      label: 'Cola más larga',
      adaptive: `${formatCount(session.adaptive.longestQueue)} veh`,
      fixed: `${formatCount(session.fixed.longestQueue)} veh`,
    },
  ]

  return (
    <>
      <tr className="border-t border-line transition-colors duration-150 ease-signal hover:bg-elevated/60">
        <td className="tabular whitespace-nowrap px-4 py-3 font-mono text-xs text-secondary">
          {formatStartedAt(session.startedAt)}
        </td>
        <td className="tabular whitespace-nowrap px-4 py-3 font-mono text-sm text-primary">
          {formatDuration(session.durationSeconds)}
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          <Badge tone="neutral" dot={false}>
            {session.mode === 'adaptive' ? 'Adaptativo' : 'Ciclo fijo'}
          </Badge>
        </td>
        <td className="tabular whitespace-nowrap px-4 py-3 font-mono text-sm text-primary">
          {formatSeconds(session.adaptive.averageWaitSeconds)}
          <span className="px-1 text-muted">/</span>
          {formatSeconds(session.fixed.averageWaitSeconds)}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => setOpen((current) => !current)}
            className={cn(
              'rounded p-1.5 text-secondary transition-colors duration-150 ease-signal',
              'hover:text-primary',
            )}
          >
            <ChevronIcon
              className={cn('transition-transform duration-150 ease-signal', open && 'rotate-180')}
            />
            <span className="sr-only">
              {open ? 'Ocultar detalle de la corrida' : 'Ver detalle de la corrida'}
            </span>
          </button>
        </td>
      </tr>

      <tr>
        <td id={detailId} colSpan={5} className="p-0">
          {open && (
            <div className="border-t border-line bg-canvas px-4 py-4">
              <h3 className="font-mono text-micro uppercase text-muted">
                Comparación de la corrida
              </h3>

              <div className="mt-3 grid max-w-2xl grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-8 gap-y-2">
                <span aria-hidden="true" />
                <span className="font-mono text-micro uppercase text-muted">Adaptativo</span>
                <span className="font-mono text-micro uppercase text-muted">Ciclo fijo</span>

                {comparison.map((row) => (
                  <Fragment key={row.label}>
                    <span className="text-xs text-secondary">{row.label}</span>
                    <span className="tabular font-mono text-sm text-primary">{row.adaptive}</span>
                    <span className="tabular font-mono text-sm text-primary">{row.fixed}</span>
                  </Fragment>
                ))}
              </div>

              <p className="mt-4 text-xs leading-relaxed text-muted">
                Métricas modeladas del generador simulado · {formatCount(session.vehiclesProcessed)}{' '}
                vehículos atendidos · {formatCount(session.tickCount)} ventanas de muestra. La
                medición real llega con la Fase 3.
              </p>
            </div>
          )}
        </td>
      </tr>
    </>
  )
}
