import { Route, Routes } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ui'
import { ConfigPage } from '@/pages/ConfigPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ObserverPage } from '@/pages/ObserverPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { ConsoleLayout } from '@/routes/ConsoleLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'

/**
 * The route tree.
 *
 * `/` is the public landing, outside the shell: it is what an evaluator opens
 * first and it has to argue for the product before asking anyone to log in.
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
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

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

        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  )
}
