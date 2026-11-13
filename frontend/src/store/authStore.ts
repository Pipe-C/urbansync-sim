import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import * as authService from '@/services/auth'
import { setAuthToken } from '@/services/http'
import type { AuthSession, Credentials, Registration } from '@/types/auth'

export type AuthStatus = 'idle' | 'authenticating'

export interface AuthState {
  session: AuthSession | null
  status: AuthStatus
  /** Inline, never a toast — see DESIGN.md on error treatment. */
  error: string | null
  /**
   * Resolves to the session on success and to `null` on failure, having written
   * `error` on the way. It does not reject: a rejected login is an expected
   * outcome of a form, not an exception, and a page that has to `try`/`catch`
   * every submit to avoid an unhandled rejection is a page whose error path
   * nobody will test.
   */
  login: (credentials: Credentials) => Promise<AuthSession | null>
  register: (registration: Registration) => Promise<AuthSession | null>
  logout: () => void
  /** Called on the first keystroke, so a stale error does not outlive its cause. */
  clearError: () => void
}

function isExpired(session: AuthSession): boolean {
  return Date.parse(session.expiresAt) <= Date.now()
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      status: 'idle',
      error: null,

      login: async (credentials) => {
        set({ status: 'authenticating', error: null })

        try {
          const session = await authService.login(credentials)
          setAuthToken(session.token)
          set({ session, status: 'idle', error: null })
          return session
        } catch (error) {
          setAuthToken(null)
          set({
            session: null,
            status: 'idle',
            error:
              error instanceof Error
                ? error.message
                : 'No se pudo iniciar sesión. Inténtalo de nuevo.',
          })
          return null
        }
      },

      register: async (registration) => {
        set({ status: 'authenticating', error: null })

        try {
          const session = await authService.register(registration)
          setAuthToken(session.token)
          set({ session, status: 'idle', error: null })
          return session
        } catch (error) {
          setAuthToken(null)
          set({
            session: null,
            status: 'idle',
            error:
              error instanceof Error
                ? error.message
                : 'No se pudo crear la cuenta. Inténtalo de nuevo.',
          })
          return null
        }
      },

      logout: () => {
        const { session } = get()

        // Local logout never waits on the network: the operator is out the
        // moment they ask, whatever the backend does next. Revoking the row is
        // best-effort — a failed call leaves the token valid until it expires,
        // which is a smaller failure than a "salir" button that hangs.
        set({ session: null, status: 'idle', error: null })
        setAuthToken(null)

        if (session !== null) {
          void authService.logout(session.token).catch(() => undefined)
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'urbansync.auth',
      storage: createJSONStorage(() => localStorage),
      // Only the session is persisted. `status` and `error` describe one attempt
      // at one moment; restoring `authenticating` after a reload would strand
      // the login button in its loading state forever.
      partialize: ({ session }) => ({ session }),
      /**
       * Drops an expired session while rehydrating rather than discovering it on
       * the first 401. Without this, a tab left open overnight comes back
       * looking authenticated until something happens to be protected.
       */
      merge: (persisted, current) => {
        const restored = persisted as Partial<AuthState> | undefined
        const candidate = restored?.session

        if (candidate === null || candidate === undefined || isExpired(candidate)) {
          return { ...current, session: null }
        }

        return { ...current, ...restored, session: candidate }
      },
      /**
       * A restored session must bring the bearer token with it, or the first
       * authenticated request after a reload would go out unauthenticated. The
       * argument is the state `merge` just produced, so an expired session has
       * already been dropped by the time this runs.
       */
      onRehydrateStorage: () => (state) => {
        setAuthToken(state?.session?.token ?? null)
      },
    },
  ),
)
