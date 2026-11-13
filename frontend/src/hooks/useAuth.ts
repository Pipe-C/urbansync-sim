import { useAuthStore } from '@/store/authStore'
import type { AuthStatus } from '@/store/authStore'
import type { AuthSession, Credentials, Registration, User } from '@/types/auth'

export interface UseAuthResult {
  user: User | null
  session: AuthSession | null
  isAuthenticated: boolean
  status: AuthStatus
  isAuthenticating: boolean
  error: string | null
  login: (credentials: Credentials) => Promise<AuthSession | null>
  register: (registration: Registration) => Promise<AuthSession | null>
  logout: () => void
  clearError: () => void
}

/**
 * The only way components read or change the session.
 *
 * Each value is selected on its own rather than destructured from one store
 * snapshot. A hook that returned `{ session, error, status }` from a single
 * `useAuthStore()` call would re-render every consumer on every field change,
 * and a live simulation republishing state would make that fire constantly.
 */
export function useAuth(): UseAuthResult {
  const session = useAuthStore((state) => state.session)
  const status = useAuthStore((state) => state.status)
  const error = useAuthStore((state) => state.error)
  const login = useAuthStore((state) => state.login)
  const register = useAuthStore((state) => state.register)
  const logout = useAuthStore((state) => state.logout)
  const clearError = useAuthStore((state) => state.clearError)

  return {
    user: session?.user ?? null,
    session,
    isAuthenticated: session !== null,
    status,
    isAuthenticating: status === 'authenticating',
    error,
    login,
    register,
    logout,
    clearError,
  }
}
