import { Navigate, Route, Routes } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ui'
import { ConfigPage } from '@/pages/ConfigPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ObserverPage } from '@/pages/ObserverPage'
import { ReportsPage } from '@/pages/ReportsPage'
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
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>

        <Route path="/observer" element={<ObserverPage />} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  )
}
