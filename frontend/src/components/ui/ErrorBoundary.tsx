import { Component, type ErrorInfo, type ReactNode } from 'react'

import { AlertIcon } from './Icon'
import { Button } from './Button'

export interface ErrorBoundaryProps {
  children: ReactNode
  /**
   * Replaces the default recovery panel. Receives the error and a `reset`
   * callback that clears the boundary so the subtree is retried.
   */
  fallback?: (error: Error, reset: () => void) => ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render errors so one broken panel cannot take down the console.
 *
 * The default panel offers two different recoveries, because they are not
 * interchangeable: `reset` re-renders the subtree in place and only helps when
 * the failure was transient, while a reload rebuilds the module graph and is
 * the only thing that helps when the failure was a bad module or a corrupt
 * chunk. Offering only the reload would make every transient blip lose the
 * user's place.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private reset = (): void => {
    this.setState({ error: null })
  }

  override render(): ReactNode {
    const { error } = this.state
    const { children, fallback } = this.props

    if (error === null) {
      return children
    }

    if (fallback) {
      return fallback(error, this.reset)
    }

    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-4 rounded-lg border border-congested/40 bg-surface px-6 py-10 text-center"
      >
        <AlertIcon className="text-2xl text-congested" />

        <div className="flex max-w-md flex-col gap-2">
          <h2 className="text-sm font-medium text-primary">Algo salió mal en este panel</h2>
          <p className="text-sm text-secondary">
            El resto de la consola sigue funcionando. Reintenta para renderizar de nuevo, o recarga
            la página si el error persiste.
          </p>
        </div>

        <p className="max-w-md break-words font-mono text-micro text-muted">{error.message}</p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={this.reset}>Reintentar</Button>
          <Button variant="ghost" onClick={() => window.location.reload()}>
            Recargar la página
          </Button>
        </div>
      </div>
    )
  }
}
