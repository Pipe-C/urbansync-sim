import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout'
import { ReportCard } from '@/components/reports/ReportCard'
import { Badge, Button, EmptyState, Tooltip } from '@/components/ui'
import { DownloadIcon } from '@/components/ui/Icon'
import { useSessionsStore } from '@/store/sessionsStore'

/**
 * The session history.
 *
 * Phase 1 reads the local log the console writes on every stop; there is no
 * backend yet, and an empty table here is the honest first-run state rather
 * than a failure. The download is present but unavailable on purpose — the
 * button exists so the screen's shape is final, and the explanation is visible
 * text rather than only a tooltip, because a tooltip that cannot be opened on
 * a 375px screen is an explanation that does not exist there.
 */
export function ReportsPage() {
  const sessions = useSessionsStore((state) => state.sessions)
  const newestFirst = [...sessions].reverse()

  return (
    <>
      <PageHeader
        title="Informes"
        description="Historial local de corridas detenidas, con la comparación entre controladores sobre el mismo tráfico."
        action={<Badge tone="warning">Datos simulados</Badge>}
      />

      {sessions.length === 0 ? (
        <EmptyState
          title="Sin corridas registradas todavía"
          description="Cada vez que detienes una corrida con datos, queda aquí con su duración y la comparación entre el control adaptativo y el ciclo fijo."
          action={
            <Link to="/dashboard">
              <Button size="sm">Ir al panel</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-secondary">
              <span className="tabular font-mono text-primary">{newestFirst.length}</span> corridas
              · se conservan las últimas 50
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Tooltip content="La exportación de archivos llega en la Fase 5 del plan.">
                <Button variant="secondary" size="sm" disabled leftIcon={<DownloadIcon />}>
                  Descargar
                </Button>
              </Tooltip>
              <p id="reports-download-note" className="text-xs text-muted">
                La exportación llega en la Fase 5.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <caption className="sr-only">
                Corridas registradas localmente, de la más reciente a la más antigua
              </caption>
              <thead>
                <tr className="bg-elevated">
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-mono text-micro uppercase tracking-wider text-muted"
                  >
                    Fecha
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-mono text-micro uppercase tracking-wider text-muted"
                  >
                    Duración
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-mono text-micro uppercase tracking-wider text-muted"
                  >
                    Modo
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 font-mono text-micro uppercase tracking-wider text-muted"
                  >
                    Espera adapt. / fijo
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    <span className="sr-only">Detalle</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {newestFirst.map((session) => (
                  <ReportCard key={session.id} session={session} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
