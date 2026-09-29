import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useAuth } from '@/hooks/useAuth'

export interface ProtectedRouteProps {
  children: ReactNode
}

/**
 * Gates the console routes on a live session.
 *
 * It redirects to `/login` and remembers where the operator was heading, so a
 * deep link survives the detour through the login screen. `state` is passed
 * through the router rather than a module-level variable because the router
 * history is the only place a "came from" survives a reload; a module variable
 * would hand the next visitor the last visitor's destination.
 *
 * There is no spinner here on purpose. The persisted store rehydrates from
 * `localStorage` synchronously, so there is no window in which this component
 * renders with an unknown session — a loading state here would only ever flash.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuth().isAuthenticated
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
