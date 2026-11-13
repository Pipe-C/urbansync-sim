import axios from 'axios'

import { http } from '@/services/http'
import type { AuthSession, Credentials, Registration } from '@/types/auth'

/**
 * Auth client — the real one, against `POST /auth/login` and `POST /auth/logout`.
 *
 * The response body is the frontend's `AuthSession`, field for field: the
 * backend was built against this contract, so nothing here reshapes it. That is
 * the whole point of the swap — the screen does not know the mock left.
 *
 * `DEMO_CREDENTIALS` stays. It is not mock behaviour; it is the account the seed
 * installs (`admin@urbansync.sim`), which the login screen states on screen so an
 * evaluator opening the URL live is never blocked hunting for a password.
 */

/** Login failed because the credentials were rejected (401). */
export class InvalidCredentialsError extends Error {
  override readonly name = 'InvalidCredentialsError'

  constructor() {
    super('Correo o contraseña incorrectos')
  }
}

export class EmailAlreadyRegisteredError extends Error {
  override readonly name = 'EmailAlreadyRegisteredError'

  constructor() {
    super('Ya existe una cuenta con este correo.')
  }
}

export class InvalidPasswordResetTokenError extends Error {
  override readonly name = 'InvalidPasswordResetTokenError'

  constructor() {
    super('El enlace no es válido o ha caducado. Solicita uno nuevo.')
  }
}

/**
 * One message for every non-401 failure — an unreachable backend, a 5xx, a
 * timeout. It deliberately does not distinguish them: the operator can act on
 * none of the differences, and the only useful instruction is to try again.
 */
const CONNECTION_ERROR_MESSAGE = 'No se pudo conectar con el servidor. Inténtalo de nuevo.'

/**
 * Exchanges credentials for a session.
 *
 * @throws {InvalidCredentialsError} on a 401. The backend returns the same 401
 * for an unknown email and a wrong password (and takes the same time over both),
 * so the client cannot and must not tell them apart.
 * @throws {Error} with a user-facing message on any other failure.
 */
export async function login({ email, password }: Credentials): Promise<AuthSession> {
  try {
    const { data } = await http.post<AuthSession>('/auth/login', { email, password })
    return data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new InvalidCredentialsError()
    }
    throw new Error(CONNECTION_ERROR_MESSAGE)
  }
}

/**
 * Creates an operator account and signs it in in the same request.
 *
 * @throws {EmailAlreadyRegisteredError} when the normalized address already has
 * an account.
 * @throws {Error} with a user-facing message on any other failure.
 */
export async function register({
  displayName,
  email,
  password,
}: Registration): Promise<AuthSession> {
  try {
    const { data } = await http.post<AuthSession>('/auth/register', {
      displayName,
      email,
      password,
    })
    return data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      throw new EmailAlreadyRegisteredError()
    }
    throw new Error(CONNECTION_ERROR_MESSAGE)
  }
}

/**
 * Asks the backend to send a reset link. The response is deliberately the same
 * for a registered and an unregistered address, so this function has no "not
 * found" branch to expose.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await http.post('/auth/password-reset/request', { email })
  } catch {
    throw new Error(CONNECTION_ERROR_MESSAGE)
  }
}

/**
 * Consumes a one-use reset token and replaces the password.
 *
 * @throws {InvalidPasswordResetTokenError} when the link is unknown, expired, or
 * already used.
 * @throws {Error} with a user-facing message on any other failure.
 */
export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  try {
    await http.post('/auth/password-reset/confirm', { token, password })
  } catch (error) {
    if (axios.isAxiosError(error) && [400, 422].includes(error.response?.status ?? 0)) {
      throw new InvalidPasswordResetTokenError()
    }
    throw new Error(CONNECTION_ERROR_MESSAGE)
  }
}

/**
 * Revokes the session the token belongs to. The row is marked ended server-side,
 * so the token stops working immediately rather than at its expiry.
 *
 * The token is passed explicitly rather than left to the interceptor: the caller
 * clears the session as soon as the operator logs out, and an interceptor that
 * read the (now empty) module token would send an unauthenticated request the
 * backend would reject — revoking nothing.
 */
export async function logout(token: string): Promise<void> {
  await http.post('/auth/logout', undefined, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

/** The seeded demo operator, for the login screen to fill in on request. */
export const DEMO_CREDENTIALS: Credentials = {
  email: 'admin@urbansync.sim',
  password: 'admin123',
}
