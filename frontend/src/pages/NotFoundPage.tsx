import { Link } from 'react-router-dom'

import { Button, EmptyState } from '@/components/ui'

/**
 * The catch-all route.
 *
 * A router without a 404 is a broken state with a URL attached, and PRODUCT.md
 * lists "no broken states" as a hard constraint. It offers the way back rather
 * than only naming the failure.
 */
export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-5 py-10">
      <EmptyState
        title="Esta ruta no existe"
        description="La dirección no corresponde a ninguna pantalla de la consola. Puede que el enlace sea de otra versión, o que contenga un error tipográfico."
        action={
          <Link to="/dashboard">
            <Button>Volver al panel</Button>
          </Link>
        }
      />
    </div>
  )
}
