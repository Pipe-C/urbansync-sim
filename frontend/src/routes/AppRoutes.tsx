import { Navigate, Route, Routes } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ui'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { ConsoleLayout } from '@/routes/ConsoleLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'

/**
 * The route tree.
 *
 * `/login` sits outside the shell and is reachable whether or not there is a
 * session, so an already-authenticated operator can still get back to it.
 * `/observer` is public and renders without the shell, per the decision recorded
 * in PLAN.md § Open questions: it is a separate route rather than a conditional
 * branch inside `/login`.
 *
 * The `ErrorBoundary` sits above the routes rather than inside one. A panel that
 * throws should not be able to take the 404 page down with it.
 */
export function AppRoutes() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <ProtectedRoute>
              <ConsoleLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/dashboard"
            element={
              <PlaceholderPage
                title="Panel de simulación"
                description="La intersección animada, el panel de métricas y los controles de la simulación."
                plannedIn="Sprint 1-D"
              />
            }
          />
          <Route
            path="/config"
            element={
              <PlaceholderPage
                title="Configuración"
                description="Tasa de llegada, distribución de tipos de vehículo y modo de control."
                plannedIn="Sprint 1-F"
              />
            }
          />
          <Route
            path="/reports"
            element={
              <PlaceholderPage
                title="Informes"
                description="Historial de sesiones simuladas con sus métricas y la comparación entre controladores."
                plannedIn="Sprint 1-F"
              />
            }
          />
        </Route>

        <Route
          path="/observer"
          element={
            <main className="min-h-screen bg-canvas px-5 py-10">
              <div className="mx-auto w-full max-w-shell">
                <PlaceholderPage
                  title="Modo observador"
                  description="La simulación en directo, sin necesidad de iniciar sesión."
                  plannedIn="Sprint 1-D"
                />
              </div>
            </main>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  )
}
