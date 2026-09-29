import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { AmbientIntersection } from '@/components/simulation/AmbientIntersection'
import { Button, Field, SignalIcon } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { DEMO_CREDENTIALS } from '@/services/auth'
import type { Credentials } from '@/types/auth'

interface LocationState {
  from?: string
}

/**
 * The door into the console.
 *
 * The composition is a panel bolted onto the left of a running intersection,
 * not a card floating in the middle of an empty page. The category default for
 * a login is a centred box; this product's answer is that the thing worth
 * logging in for is already on screen, working, before a single character is
 * typed.
 *
 * On phones the panel becomes a centred card and the intersection stays visible
 * around it, because the same argument has to survive the narrow layout.
 */
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const { login, isAuthenticating, error, clearError } = useAuth()

  const [credentials, setCredentials] = useState<Credentials>({ email: '', password: '' })
  const [hasFilledDemo, setHasFilledDemo] = useState(false)

  const from = (location.state as LocationState | null)?.from ?? '/dashboard'

  function update<K extends keyof Credentials>(key: K, value: Credentials[K]) {
    setCredentials((current) => ({ ...current, [key]: value }))
    // A rejected attempt stops being the news as soon as the operator starts
    // correcting it; leaving it up would make the message describe a state they
    // have already left.
    if (error) {
      clearError()
    }
  }

  function fillDemoCredentials() {
    setCredentials(DEMO_CREDENTIALS)
    setHasFilledDemo(true)
    if (error) {
      clearError()
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const session = await login(credentials)
    if (session) {
      navigate(from, { replace: true })
    }
  }

  return (
    <div className="relative min-h-screen bg-canvas">
      {/* The evidence. Dimmed on mobile only, where the form card sits on top
          of it; on desktop it is the brightest thing in the frame.

          The panel width is a clamp, not a fixed 26rem. A fixed column next to
          an elastic canvas looks fine at exactly one viewport width and adrift
          at every other one, because nothing relates the two. Proportional
          width with a floor and a ceiling keeps the form readable on a laptop
          and stops it from swallowing the screen on a 4K monitor. */}
      <div className="absolute inset-0 flex items-center justify-center opacity-45 lg:left-[clamp(22rem,34%,34rem)] lg:opacity-100">
        <AmbientIntersection className="size-full" />
      </div>
      <div className="absolute inset-0 bg-canvas/50 lg:hidden" />

      <div className="relative z-10 w-full lg:w-[clamp(22rem,34%,34rem)] lg:shrink-0">
        <div className="mx-5 my-8 rounded-lg border border-line bg-surface p-6 sm:mx-auto sm:max-w-sm sm:p-8 lg:mx-0 lg:my-0 lg:h-full lg:max-w-none lg:rounded-none lg:border-0 lg:border-r lg:p-10">
          <div className="mx-auto flex h-full w-full max-w-sm flex-col justify-center">
            <div className="flex items-center gap-2.5">
              <SignalIcon className="text-xl text-accent" />
              <span className="text-sm font-medium text-primary">UrbanSync Sim</span>
            </div>

            <p className="mt-8 font-mono text-micro uppercase text-muted">
              Canal 01 · Autenticación
            </p>

            <h1 className="mt-2 text-display font-semibold text-primary">Iniciar sesión</h1>

            <p className="mt-3 text-sm text-secondary">
              Consola de simulación de intersecciones. Los datos son simulados hasta que el
              algoritmo adaptativo entre en producción.
            </p>

            <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
              <Field
                label="Correo"
                type="email"
                name="email"
                autoComplete="username"
                required
                value={credentials.email}
                onChange={(event) => update('email', event.target.value)}
              />

              <Field
                label="Contraseña"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={credentials.password}
                onChange={(event) => update('password', event.target.value)}
              />

              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-congested/40 bg-canvas px-3 py-2 text-xs text-congested"
                >
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" isLoading={isAuthenticating} className="mt-2 w-full">
                {isAuthenticating ? 'Comprobando' : 'Entrar'}
              </Button>
            </form>

            {/* The demo account is stated on screen rather than left to a README,
                because this project is evaluated by opening the URL live and the
                evaluator should never be blocked hunting for a password. */}
            <div className="mt-6 rounded-md border border-line bg-canvas p-3">
              <p className="font-mono text-micro uppercase text-muted">Cuenta de demostración</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="font-mono text-xs text-secondary">
                  {DEMO_CREDENTIALS.email}
                  <br />
                  {DEMO_CREDENTIALS.password}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={fillDemoCredentials}
                  disabled={isAuthenticating || hasFilledDemo}
                >
                  {hasFilledDemo ? 'Rellenado' : 'Usar'}
                </Button>
              </div>
            </div>

            <p className="mt-6 text-xs text-muted">
              ¿Solo quieres ver la simulación?{' '}
              <Link to="/observer" className="text-accent hover:underline">
                Entra como observador
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
