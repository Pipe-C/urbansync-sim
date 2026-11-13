import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AuthShell } from '@/components/auth'
import { Button, Field } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import type { Registration } from '@/types/auth'

type RegistrationForm = Registration & { confirmPassword: string }
type FormField = keyof RegistrationForm

const EMPTY_FORM: RegistrationForm = {
  displayName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { register, isAuthenticating, error, clearError } = useAuth()

  const [form, setForm] = useState<RegistrationForm>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormField, string>>>({})

  function update<K extends FormField>(key: K, value: RegistrationForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: undefined }))
    if (error) {
      clearError()
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const displayName = form.displayName.trim()
    const email = form.email.trim()
    const nextErrors: Partial<Record<FormField, string>> = {}

    if (displayName.length < 2) {
      nextErrors.displayName = 'Escribe tu nombre.'
    }
    if (!email.includes('@')) {
      nextErrors.email = 'Escribe un correo válido.'
    }
    if (form.password.length < 8) {
      nextErrors.password = 'Usa al menos 8 caracteres.'
    }
    if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = 'Las contraseñas no coinciden.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }

    const session = await register({ displayName, email, password: form.password })
    if (session) {
      navigate('/dashboard', { replace: true })
    }
  }

  return (
    <AuthShell
      eyebrow="Canal 02 · Alta de operador"
      title="Crear cuenta"
      description="Abre tu acceso a la consola. La cuenta entra como operador y puede iniciar simulaciones, cambiar la configuración y exportar informes."
    >
      <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
        <Field
          label="Nombre"
          type="text"
          name="displayName"
          autoComplete="name"
          required
          value={form.displayName}
          error={fieldErrors.displayName}
          onChange={(event) => update('displayName', event.target.value)}
        />

        <Field
          label="Correo"
          type="email"
          name="email"
          autoComplete="username"
          required
          value={form.email}
          error={fieldErrors.email}
          onChange={(event) => update('email', event.target.value)}
        />

        <Field
          label="Contraseña"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          error={fieldErrors.password}
          hint="Mínimo 8 caracteres."
          onChange={(event) => update('password', event.target.value)}
        />

        <Field
          label="Repetir contraseña"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          value={form.confirmPassword}
          error={fieldErrors.confirmPassword}
          onChange={(event) => update('confirmPassword', event.target.value)}
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
          {isAuthenticating ? 'Creando cuenta' : 'Crear cuenta'}
        </Button>
      </form>

      <p className="mt-6 text-xs text-muted">
        ¿Ya tienes una cuenta?{' '}
        <Link to="/login" className="text-accent hover:underline">
          Inicia sesión
        </Link>
        .
      </p>
    </AuthShell>
  )
}
