import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import { MenuIcon } from '@/components/ui/Icon'
import type { ConnectionStatus } from '@/types/connection'

/**
 * The connection indicator pairs a colour with a written state, for the same
 * reason `Badge` does: `connected` and `offline` are exactly the two a user
 * most needs to distinguish, and they are exactly the two a red/green pair
 * encodes by colour alone.
 */
const CONNECTION_TONE: Record<ConnectionStatus, BadgeTone> = {
  idle: 'neutral',
  connected: 'flow',
  connecting: 'neutral',
  reconnecting: 'warning',
  stale: 'warning',
  offline: 'congested',
}

const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  idle: 'Sin ejecución',
  connected: 'En línea',
  connecting: 'Conectando',
  reconnecting: 'Reconectando',
  stale: 'Datos atrasados',
  offline: 'Sin conexión',
}

/**
 * What the badge cannot say in three words. A bare red badge reads as a fault,
 * so the tooltip names the condition and what it does and does not affect. The
 * local scene is independent of this channel: it keeps running whether or not
 * the backend answers.
 */
const CONNECTION_DETAIL: Partial<Record<ConnectionStatus, string>> = {
  idle: 'No hay una ejecución abierta. Inicia la simulación para abrir el canal en vivo.',
  connecting: 'Abriendo el canal con el backend.',
  reconnecting: 'Se perdió el canal. Reconectando con el backend.',
  stale: 'El canal está abierto pero no llegan lecturas nuevas. Se muestran las últimas recibidas.',
  offline: 'No hay canal con el backend. Las lecturas en vivo no están llegando.',
}

export interface TopBarProps {
  title: string
  connectionStatus: ConnectionStatus
  /** Drives the drawer toggle, and receives focus back when the drawer closes. */
  isNavOpen: boolean
  onOpenNav: () => void
  navToggleRef?: React.Ref<HTMLButtonElement>
  userName?: string
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function TopBar({
  title,
  connectionStatus,
  isNavOpen,
  onOpenNav,
  navToggleRef,
  userName,
}: TopBarProps) {
  const connectionDetail = CONNECTION_DETAIL[connectionStatus]

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 md:px-6">
      <button
        ref={navToggleRef}
        type="button"
        onClick={onOpenNav}
        aria-label="Abrir navegación"
        aria-controls="app-sidebar"
        aria-expanded={isNavOpen}
        className="-ml-1 grid size-11 shrink-0 place-items-center rounded-md text-secondary hover:bg-elevated hover:text-primary lg:hidden"
      >
        <MenuIcon className="text-xl" />
      </button>

      {/* A route label, not the page title. The document's single `h1` belongs
          to `PageHeader`, which carries the Display scale DESIGN.md reserves for
          page titles. */}
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-primary">{title}</p>

      {/* Only wrapped when there is something to explain; a tooltip on a
          self-explanatory state is noise. The badge takes `tabIndex` so the
          explanation is reachable by keyboard, not just by hover. */}
      {connectionDetail ? (
        <Tooltip content={connectionDetail} side="bottom" align="end">
          <Badge
            tone={CONNECTION_TONE[connectionStatus]}
            tabIndex={0}
            aria-label={CONNECTION_LABEL[connectionStatus]}
          >
            {CONNECTION_LABEL[connectionStatus]}
          </Badge>
        </Tooltip>
      ) : (
        <Badge tone={CONNECTION_TONE[connectionStatus]}>{CONNECTION_LABEL[connectionStatus]}</Badge>
      )}

      {userName && (
        <div className="hidden items-center gap-2.5 border-l border-line pl-4 sm:flex">
          <span className="max-w-32 truncate text-sm text-secondary">{userName}</span>
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-elevated font-mono text-micro uppercase text-accent"
          >
            {initialsOf(userName)}
          </span>
        </div>
      )}
    </header>
  )
}
