import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { AuthShell } from '@/components/auth'
import { Button, Field, buttonClassName } from '@/components/ui'
import { confirmPasswordReset } from '@/services/auth'

type ResetStatus = 'idle' | 'saving' | 'done'

export function ResetPasswordPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<ResetStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const done = status === 'done'
  const hasToken = token.length > 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password.length < 8) {
      setError('Usa al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setStatus('saving')
    setError(null)

    try {
      await confirmPasswordReset(token, password)
      setStatus('done')
      setSearchParams({}, { replace: true })
    } catch (resetError) {
      setStatus('idle')
      setError(
        resetError instanceof Error
          ? resetError.message
          : 'No se pudo actualizar la contraseña. Inténtalo de nuevo.',
      )
    }
  }

  if (!hasToken && !done) {
    return (
      <AuthShell
        eyebrow="Canal 04 · Restablecimiento"
        title="Enlace incompleto"
        description="Esta dirección no trae un token de recuperación. Solicita un enlace nuevo para continuar."
      >
        <Link
          to="/forgot-password"
          className={buttonClassName({ size: 'lg', className: 'mt-8 w-full' })}
        >
          Solicitar un enlace nuevo
        </Link>

        <p className="mt-6 text-xs text-muted">
          <Link to="/login" className="text-accent hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Canal 04 · Restablecimiento"
      title={done ? 'Contraseña actualizada' : 'Nueva contraseña'}
      description={
        done
          ? 'El cambio quedó guardado y todas las sesiones anteriores fueron cerradas. Entra con la contraseña nueva.'
          : 'Elige una contraseña nueva para tu cuenta. Al guardarla se cerrarán las sesiones que estuvieran abiertas.'
      }
    >
      {done ? (
        <div className="mt-8 flex flex-col gap-5" role="status">
          <div className="rounded-md border border-flow/40 bg-canvas p-4">
            <p className="font-mono text-micro uppercase text-flow">Listo</p>
            <p className="mt-2 text-sm text-secondary">
              Ya puedes entrar a la consola con tu nueva contraseña.
            </p>
          </div>

          <Link to="/login" className={buttonClassName({ size: 'lg', className: 'w-full' })}>
            Iniciar sesión
          </Link>
        </div>
      ) : (
        <>
          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
            <Field
              label="Contraseña nueva"
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              hint="Mínimo 8 caracteres."
              onChange={(event) => {
                setPassword(event.target.value)
                if (error) {
                  setError(null)
                }
              }}
            />

            <Field
              label="Repetir contraseña"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value)
                if (error) {
                  setError(null)
                }
              }}
            />

            {error && (
              <p
                role="alert"
                className="rounded-md border border-congested/40 bg-canvas px-3 py-2 text-xs text-congested"
              >
                {error}
              </p>
            )}

            <Button type="submit" size="lg" isLoading={status === 'saving'} className="mt-2 w-full">
              {status === 'saving' ? 'Guardando' : 'Actualizar contraseña'}
            </Button>
          </form>

          <p className="mt-6 text-xs text-muted">
            ¿El enlace no funciona?{' '}
            <Link to="/forgot-password" className="text-accent hover:underline">
              Solicita uno nuevo
            </Link>
            .
          </p>
        </>
      )}
    </AuthShell>
  )
}
