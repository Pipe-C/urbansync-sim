import { Fragment, useId, useState } from 'react'

import { Badge, Button, DownloadIcon } from '@/components/ui'
import { ChevronIcon } from '@/components/ui/Icon'
import { fetchReportFile } from '@/services/reports'
import type { ReportFormat, SessionRow } from '@/types/report'
import { cn } from '@/utils/cn'
import { saveBlob } from '@/utils/download'

export interface ReportCardProps {
  session: SessionRow
}

function formatStartedAt(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null) {
    return '—'
  }

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
 * One run: the collapsed row, and the comparison behind it.
 *
 * Both strategies' numbers are shown in the detail because both were simulated —
 * the run's whole point is the pair — and the row's wait column carries them as
 * `adaptativo / ciclo fijo` so the comparison is legible without expanding
 * anything. The mode badge is deliberately neutral: green and red are traffic
 * states in this product, and a controller name is not one.
 *
 * A run without a report renders `—`, never `0`: "not measured yet" and
 * "measured at zero" are different claims.
 *
 * The two downloads are the backend's own renderings (`/reports/{id}/export.*`),
 * so the file a professor opens is the same report the screen just showed. A
 * local run has no server row to render, and says so instead of offering a
 * button that would 404.
 */
export function ReportCard({ session }: ReportCardProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<ReportFormat | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const detailId = useId()

  // Captured as a pair so every read below is narrowed: the two frames are
  // present together or not at all, and a run stopped before its first window
  // has neither.
  const frames =
    session.adaptive !== null && session.fixed !== null
      ? { adaptive: session.adaptive, fixed: session.fixed }
      : null

  const comparison =
    frames !== null
      ? [
          {
            label: 'Espera media',
            adaptive: formatSeconds(frames.adaptive.averageWaitSeconds),
            fixed: formatSeconds(frames.fixed.averageWaitSeconds),
          },
          {
            label: 'Caudal',
            adaptive: `${formatNumber(frames.adaptive.throughputPerMinute)} veh/min`,
            fixed: `${formatNumber(frames.fixed.throughputPerMinute)} veh/min`,
          },
          {
            label: 'Respuesta EVP',
            adaptive: formatSeconds(frames.adaptive.emergencyResponseSeconds),
            fixed: formatSeconds(frames.fixed.emergencyResponseSeconds),
          },
          {
            label: 'Cola más larga',
            adaptive: `${formatCount(frames.adaptive.longestQueue)} veh`,
            fixed: `${formatCount(frames.fixed.longestQueue)} veh`,
          },
        ]
      : []

  async function handleDownload(format: ReportFormat): Promise<void> {
    setPending(format)
    setDownloadError(null)

    try {
      const file = await fetchReportFile(session.id, format)
      saveBlob(file.blob, file.filename)
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'No se pudo descargar el informe.')
    } finally {
      setPending(null)
    }
  }

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
        <td className="whitespace-nowrap px-4 py-3">
          <Badge tone="neutral" dot={false}>
            {session.origin === 'remote' ? 'Servidor' : 'Local'}
          </Badge>
        </td>
        <td className="tabular whitespace-nowrap px-4 py-3 font-mono text-sm text-primary">
          {frames !== null ? (
            <>
              {formatSeconds(frames.adaptive.averageWaitSeconds)}
              <span className="px-1 text-muted">/</span>
              {formatSeconds(frames.fixed.averageWaitSeconds)}
            </>
          ) : (
            <span className="text-muted">—</span>
          )}
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
        <td id={detailId} colSpan={6} className="p-0">
          {open && (
            <div className="border-t border-line bg-canvas px-4 py-4">
              <h3 className="font-mono text-micro uppercase text-muted">
                Comparación de la corrida
              </h3>

              {frames !== null ? (
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
              ) : (
                <p className="mt-3 text-xs text-muted">
                  Esta corrida se detuvo antes de producir lecturas: no hay comparación que mostrar,
                  y un cero aquí diría que midió algo.
                </p>
              )}

              <p className="mt-4 text-xs leading-relaxed text-muted">
                Métricas del motor del backend — {formatCount(session.vehiclesProcessed)} vehículos
                atendidos · {formatCount(session.tickCount)} ticks de simulación · ambas políticas
                sobre la misma secuencia de llegadas. No son datos de tráfico real.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {session.origin === 'remote' ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<DownloadIcon />}
                      isLoading={pending === 'csv'}
                      disabled={pending !== null}
                      onClick={() => void handleDownload('csv')}
                      aria-label="Descargar las lecturas de la corrida en CSV"
                    >
                      CSV
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<DownloadIcon />}
                      isLoading={pending === 'pdf'}
                      disabled={pending !== null}
                      onClick={() => void handleDownload('pdf')}
                      aria-label="Descargar el informe de la corrida en PDF"
                    >
                      PDF
                    </Button>
                    <p className="text-xs text-muted">
                      El CSV lleva todas las ventanas; el PDF, el resumen y una muestra.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted">
                    Corrida guardada en este navegador. Los archivos CSV y PDF se generan en el
                    servidor al guardarla con tu cuenta.
                  </p>
                )}
              </div>

              {downloadError !== null && (
                <p role="alert" className="mt-3 text-xs text-congested">
                  {downloadError}
                </p>
              )}
            </div>
          )}
        </td>
      </tr>
    </>
  )
}
