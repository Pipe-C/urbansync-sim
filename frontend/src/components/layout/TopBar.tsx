import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { MenuIcon } from '@/components/ui/Icon'
import type { ConnectionStatus } from '@/types/connection'

/**
 * The connection indicator pairs a colour with a written state, for the same
 * reason `Badge` does: `connected` and `offline` are exactly the two a user
 * most needs to distinguish, and they are exactly the two a red/green pair
 * encodes by colour alone.
 */
const CONNECTION_TONE: Record<ConnectionStatus, BadgeTone> = {
  connected: 'flow',
  connecting: 'neutral',
  reconnecting: 'warning',
  offline: 'congested',
}

const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  connected: 'En línea',
  connecting: 'Conectando',
  reconnecting: 'Reconectando',
  offline: 'Sin conexión',
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
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur-sm md:px-6">
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

      <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-primary">{title}</h1>

      <Badge tone={CONNECTION_TONE[connectionStatus]}>{CONNECTION_LABEL[connectionStatus]}</Badge>

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
