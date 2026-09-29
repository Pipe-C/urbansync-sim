/**
 * Who is operating the console.
 *
 * The role is modelled now because the navigation and the reports screen both
 * need to branch on it later. It is not used for authorisation anywhere in
 * Phase 1: `ProtectedRoute` checks for a session, not for a role, and the real
 * permission check belongs to the backend in Phase 2.
 */
export type UserRole = 'operator' | 'evaluator'

export interface User {
  id: string
  email: string
  displayName: string
  role: UserRole
}

export interface Credentials {
  email: string
  password: string
}

/**
 * An authenticated session.
 *
 * `expiresAt` is carried in the session rather than left to the token so the
 * client can drop an expired session on rehydrate instead of discovering it on
 * the first failed request. The backend issues real JWTs in Phase 2; until then
 * `token` is a mock string and must never be sent anywhere.
 */
export interface AuthSession {
  token: string
  user: User
  /** ISO 8601. */
  expiresAt: string
}
