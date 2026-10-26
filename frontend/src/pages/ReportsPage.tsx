import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout'
import { ReportCard, ReportSkeleton } from '@/components/reports'
import { AlertIcon, Badge, Button, EmptyState, RefreshIcon } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useSessionsStore } from '@/store/sessionsStore'

/**
 * The session history, read from wherever the run was filed.
 *
 * A signed-in operator reads their account's runs from the backend; an observer
 * with no account reads the browser's own log. The table is the same either way
 * and every row names its origin, because the two sources are not equally
 * durable and pretending otherwise on an evidence screen would be the one lie
 * this page cannot afford.
 *
 * Three states beyond "has rows", all real: loading (a request is in flight),
 * failed (the request was refused or the server is down — with a retry and the
 * local rows still visible), and empty (nothing has been run yet). The empty
 * state is not an error and does not look like one.
 */
export function ReportsPage() {
  const sessions = useSessionsStore((state) => state.sessions)
  const status = useSessionsStore((state) => state.status)
  const source = useSessionsStore((state) => state.source)
  const error = useSessionsStore((state) => state.error)
  const load = useSessionsStore((state) => state.load)
  const clearError = useSessionsStore((state) => state.clearError)
  const { isAuthenticated } = useAuth()

  // Re-read on arrival and whenever the identity changes: a login must not keep
  // showing the guest log as if it were the account's history.
  useEffect(() => {
    void load()
  }, [load, isAuthenticated])

  const loading = status === 'loading' && sessions.length === 0
  const failed = status === 'error'
  const hasLocalRows = sessions.some((session) => session.origin === 'local')

  return (
    <>
      <PageHeader
        title="Informes"
        description="Historial de corridas detenidas, con la comparación entre controladores sobre el mismo tráfico y los archivos de cada una."
        action={
          <Badge tone="neutral">
            {source === 'remote' ? 'Guardado en el servidor' : 'Solo este navegador'}
          </Badge>
        }
      />

      {error !== null && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3"
        >
          <div className="flex min-w-0 items-start gap-2">
            <AlertIcon className="mt-0.5 shrink-0 text-warning" />
            <p className="text-xs leading-relaxed text-secondary">{error}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {failed && (
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                Reintentar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={clearError}>
              Descartar
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <ReportSkeleton rows={4} />
      ) : sessions.length === 0 ? (
        <EmptyState
          title={
            source === 'remote'
              ? 'Sin corridas guardadas en tu cuenta'
              : 'Sin corridas registradas todavía'
          }
          description={
            source === 'remote'
              ? 'Cada corrida que detengas con la sesión iniciada se guarda en el servidor, con su comparación y sus lecturas, y desde aquí puedes descargar el CSV o el PDF.'
              : 'Las corridas detenidas en este navegador quedan aquí con su comparación. Al iniciar sesión, se guardan en tu cuenta y habilitan las descargas.'
          }
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
              <span className="tabular font-mono text-primary">{sessions.length}</span> corridas
              {' · '}
              {source === 'remote' ? 'guardadas en tu cuenta' : 'guardadas en este navegador'}
              {hasLocalRows && source === 'remote' && (
                <span className="text-muted">
                  {' '}
                  · las marcadas como Local aún no están en tu cuenta
                </span>
              )}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted">
                CSV y PDF se generan en el servidor desde las lecturas guardadas.
              </p>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RefreshIcon />}
                isLoading={status === 'loading'}
                onClick={() => void load()}
              >
                Actualizar
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[44rem] border-collapse text-left">
              <caption className="sr-only">
                Corridas registradas, de la más reciente a la más antigua
              </caption>
              <thead>
                <tr className="bg-elevated">
                  {['Fecha', 'Duración', 'Modo', 'Origen'].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-4 py-2.5 font-mono text-micro uppercase tracking-wider text-muted"
                    >
                      {label}
                    </th>
                  ))}
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
                {sessions.map((session) => (
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
