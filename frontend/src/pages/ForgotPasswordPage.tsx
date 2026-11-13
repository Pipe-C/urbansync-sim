import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { AuthShell } from '@/components/auth'
import { Button, Field, buttonClassName } from '@/components/ui'
import { requestPasswordReset } from '@/services/auth'

type RequestStatus = 'idle' | 'sending' | 'sent'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<RequestStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const sent = status === 'sent'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.includes('@')) {
      setError('Escribe un correo válido.')
      return
    }

    setStatus('sending')
    setError(null)

    try {
      await requestPasswordReset(email.trim())
      setStatus('sent')
    } catch (requestError) {
      setStatus('idle')
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No se pudo enviar el enlace. Inténtalo de nuevo.',
      )
    }
  }

  return (
    <AuthShell
      eyebrow="Canal 03 · Recuperación"
      title={sent ? 'Revisa tu correo' : 'Recuperar acceso'}
      description={
        sent
          ? 'Si existe una cuenta con ese correo, el enlace para elegir una nueva contraseña va en camino.'
          : 'Escribe el correo de tu cuenta y te enviaremos un enlace de un solo uso para restablecer la contraseña.'
      }
    >
      {sent ? (
        <div className="mt-8 flex flex-col gap-5" role="status">
          <div className="rounded-md border border-line bg-canvas p-4">
            <p className="font-mono text-micro uppercase text-muted">Enlace enviado</p>
            <p className="mt-2 text-sm text-secondary">
              Revisa la bandeja de entrada de{' '}
              <span className="font-medium text-primary">{email.trim()}</span>. Si no aparece, mira
              la carpeta de correo no deseado.
            </p>
          </div>

          <p className="text-xs text-muted">
            Por seguridad, el enlace caduca y solo puede usarse una vez.
          </p>

          <Link
            to="/login"
            className={buttonClassName({ variant: 'secondary', size: 'lg', className: 'w-full' })}
          >
            Volver a iniciar sesión
          </Link>

          <button
            type="button"
            className="text-xs text-accent hover:underline"
            onClick={() => setStatus('idle')}
          >
            Probar con otro correo
          </button>
        </div>
      ) : (
        <>
          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
            <Field
              label="Correo"
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
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

            <Button
              type="submit"
              size="lg"
              isLoading={status === 'sending'}
              className="mt-2 w-full"
            >
              {status === 'sending' ? 'Enviando' : 'Enviar enlace'}
            </Button>
          </form>

          <p className="mt-6 text-xs text-muted">
            ¿Ya recordaste la contraseña?{' '}
            <Link to="/login" className="text-accent hover:underline">
              Inicia sesión
            </Link>
            .
          </p>
        </>
      )}
    </AuthShell>
  )
}
