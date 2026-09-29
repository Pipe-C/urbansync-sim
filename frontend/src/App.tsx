import { MemoryRouter } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBoundary,
  Spinner,
  Stat,
  Tooltip,
} from '@/components/ui'

/**
 * Temporary harness for Sprint 1-B, so the component library and the shell can
 * be checked in a real browser before the router and the pages exist.
 * Replaced by the real route tree in Sprint 1-C.
 */
export function App() {
  return (
    <MemoryRouter initialEntries={['/dashboard']}>
      <AppShell connectionStatus="reconnecting" userName="Ada Lovelace">
        <PageHeader
          title="Panel de simulación"
          description="Comprobación de la librería base y del armazón de la consola. Esta pantalla desaparece en el Sprint 1-C."
          action={
            <>
              <Button variant="secondary" size="sm">
                Descargar
              </Button>
              <Button size="sm">Iniciar</Button>
            </>
          }
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Botones" description="Cuatro variantes, tres tamaños.">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary">Primaria</Button>
              <Button variant="secondary">Secundaria</Button>
              <Button variant="ghost">Fantasma</Button>
              <Button variant="danger">Peligro</Button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="sm">sm</Button>
              <Button size="md">md</Button>
              <Button size="lg">lg</Button>
              <Button isLoading>Cargando</Button>
              <Button disabled>Deshabilitado</Button>
            </div>
          </Card>

          <Card title="Estados de señal" description="El color nunca va solo.">
            <div className="flex flex-wrap gap-2">
              <Badge tone="flow">Fluyendo</Badge>
              <Badge tone="warning">Moderado</Badge>
              <Badge tone="congested">Congestionado</Badge>
              <Badge tone="emergency">Emergencia</Badge>
              <Badge tone="neutral">Inactivo</Badge>
            </div>
            <div className="mt-4 flex items-center gap-4 text-secondary">
              <Spinner size="sm" />
              <Spinner size="md" />
              <Spinner size="lg" />
            </div>
          </Card>

          <Card title="Métricas" description="Mono, tabular, dirección separada del juicio.">
            <div className="grid grid-cols-2 gap-5">
              <Stat label="Espera media" value={18.4} unit="s" />
              <Stat
                label="Procesados"
                value={1247}
                trend={{ direction: 'up', sentiment: 'positive' }}
              />
              <Stat
                label="Respuesta EVP"
                value={3.1}
                unit="s"
                trend={{ direction: 'down', sentiment: 'positive' }}
              />
              <Stat
                label="Ocupación"
                value={92}
                unit="%"
                hint="Por encima del umbral"
                trend={{ direction: 'up', sentiment: 'negative' }}
              />
            </div>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <EmptyState
            title="Todavía no hay sesiones"
            description="Cuando termines una simulación aparecerá aquí con sus métricas y el tiempo que ahorró el algoritmo respecto al ciclo fijo."
            action={<Button variant="secondary">Configurar simulación</Button>}
          />

          <Card title="Tooltip" description="Se abre con foco, no solo con hover.">
            <div className="flex items-center gap-3">
              <Tooltip content="El ciclo fijo no se adapta a la demanda. Sirve como referencia en la comparación.">
                <Button variant="secondary" size="sm">
                  Ciclo fijo
                </Button>
              </Tooltip>
              <Tooltip
                content="Calcula presión por fase y cambia cuando la fase actual pierde peso, respetando el verde mínimo."
                side="bottom"
              >
                <Button size="sm">Adaptativo</Button>
              </Tooltip>
            </div>
          </Card>
        </div>

        <div className="mt-4">
          <ErrorBoundary>
            <Card title="Frontera de error">
              <p className="text-sm text-secondary">
                Este panel está intacto. Si un subárbol lanzara durante el render, la consola
                sobreviviría y aparecería el panel de recuperación.
              </p>
            </Card>
          </ErrorBoundary>
        </div>
      </AppShell>
    </MemoryRouter>
  )
}

export default App
