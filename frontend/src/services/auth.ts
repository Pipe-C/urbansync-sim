import type { AuthSession, Credentials } from '@/types/auth'

/**
 * MOCK AUTH SERVICE — replaced in Phase 2 by Axios calls to `POST /auth/login`.
 *
 * Everything here is a stand-in that behaves like the real endpoint: it is
 * asynchronous, it can fail, and it takes time. That matters more than it looks.
 * A synchronous mock would let a login screen ship with a loading state and an
 * error state that have never actually run, and those are exactly the states a
 * demo is judged on.
 *
 * The `MOCK_` prefix is not decoration. Nothing below is a credential check, and
 * nothing below is safe to ship. Delete this file rather than grow it.
 */

/** The one operator account Phase 1 recognises. */
const MOCK_OPERATOR = {
  email: 'admin@urbansync.sim',
  password: 'admin123',
  id: 'usr_01',
  displayName: 'Ada Lovelace',
  role: 'operator',
} as const

/** Matches `ACCESS_TOKEN_EXPIRE_MINUTES` in AGENTS.md so the expiry logic is real. */
const SESSION_TTL_MINUTES = 60

/**
 * Long enough that the spinner is visibly a state rather than a flicker, short
 * enough not to make the demo feel broken. A real network round trip on the
 * same machine lands somewhere in this range anyway.
 */
const LATENCY_MS = 700

/** Login failed because the credentials were rejected. */
export class InvalidCredentialsError extends Error {
  override readonly name = 'InvalidCredentialsError'

  constructor() {
    super('Correo o contraseña incorrectos')
  }
}

function issueToken(userId: string): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'MOCK' }))
  const payload = btoa(JSON.stringify({ sub: userId, iat: Date.now(), mock: true }))
  return `${header}.${payload}.mock-signature`
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Exchanges credentials for a session.
 *
 * @throws {InvalidCredentialsError} when the credentials do not match. The
 * message is deliberately identical for an unknown email and a wrong password:
 * distinguishing them would tell an attacker which emails exist.
 */
export async function login({ email, password }: Credentials): Promise<AuthSession> {
  await wait(LATENCY_MS)

  const matches =
    email.trim().toLowerCase() === MOCK_OPERATOR.email && password === MOCK_OPERATOR.password

  if (!matches) {
    throw new InvalidCredentialsError()
  }

  return {
    token: issueToken(MOCK_OPERATOR.id),
    user: {
      id: MOCK_OPERATOR.id,
      email: MOCK_OPERATOR.email,
      displayName: MOCK_OPERATOR.displayName,
      role: MOCK_OPERATOR.role,
    },
    expiresAt: new Date(Date.now() + SESSION_TTL_MINUTES * 60_000).toISOString(),
  }
}

/** The credentials the demo accepts, for the login screen to fill in on request. */
export const DEMO_CREDENTIALS: Credentials = {
  email: MOCK_OPERATOR.email,
  password: MOCK_OPERATOR.password,
}
