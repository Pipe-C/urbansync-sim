import axios from 'axios'

/**
 * The one HTTP client for the FastAPI backend.
 *
 * Everything that talks to the API goes through this instance, so the base URL
 * and the auth header are decided in exactly one place. Two callers with two
 * `fetch` calls and two copies of the token logic is how a client ends up
 * hitting a staging host from one screen and production from another.
 *
 * The bearer token is held in a module variable rather than read from the store
 * at request time. Importing the store here would close a cycle
 * (`store/authStore` → `services/auth` → `services/http` → `store/authStore`),
 * and the interceptor would then be reading state that is, by construction,
 * only defined once the store has finished loading. The store pushes the token
 * in on login and on rehydrate; that keeps the flow one-way.
 */

/** Falls back to the dev backend so a missing `.env` is not a silent `undefined` base URL. */
const DEFAULT_API_URL = 'http://localhost:8000'

/**
 * The host only, never with a trailing slash.
 *
 * Socket.io treats everything after the host as a namespace, so joining
 * `https://api/` with `/simulation` yields `//simulation` and the server rejects
 * the connect packet. Axios tolerates the slash; the socket does not. Normalise
 * here, where every caller gets the same value.
 */
export const API_BASE_URL: string = (import.meta.env.VITE_API_URL ?? DEFAULT_API_URL).replace(
  /\/+$/,
  '',
)

let authToken: string | null = null

/**
 * Sets the token injected into subsequent requests. Called by `authStore` when a
 * session is established, restored from storage, or ended. Passing `null`
 * removes the header, so a logged-out client never sends a stale bearer token.
 */
export function setAuthToken(token: string | null): void {
  authToken = token
}

export const http = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Request interception only: the backend answers a stale or revoked token with
// a 401, and deciding what to do about that is the caller's concern (a login
// form shows an error; a future protected screen signs the operator out). A
// blanket "401 → logout" here would treat a failed login as a lost session.
http.interceptors.request.use((config) => {
  if (authToken !== null) {
    config.headers.Authorization = `Bearer ${authToken}`
  }
  return config
})
