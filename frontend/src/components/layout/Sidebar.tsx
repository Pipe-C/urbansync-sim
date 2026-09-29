import { NavLink } from 'react-router-dom'

import { CloseIcon, SignalIcon } from '@/components/ui/Icon'
import { NAV_ITEMS } from './navigation'
import { cn } from '@/utils/cn'

export interface SidebarProps {
  /** Renders as a dismissible overlay drawer instead of a static column. */
  isOpen: boolean
  onClose: () => void
  ref?: React.Ref<HTMLElement>
}

/**
 * Primary navigation.
 *
 * Active state is carried by two channels at once — a 2px teal marker on the
 * left edge and a text colour change — because the marker alone is invisible to
 * anyone who cannot separate teal from the surface behind it.
 */
export function Sidebar({ isOpen, onClose, ref }: SidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-canvas/70 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        ref={ref}
        id="app-sidebar"
        aria-label="Navegación principal"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface',
          'transition-transform duration-200 ease-signal lg:static lg:z-auto lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
          <span className="flex items-center gap-2.5 text-sm font-medium text-primary">
            <SignalIcon className="text-lg text-accent" />
            UrbanSync Sim
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar navegación"
            className="-mr-1 grid size-9 place-items-center rounded-md text-secondary hover:bg-elevated hover:text-primary lg:hidden"
          >
            <CloseIcon className="text-lg" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'relative flex min-h-11 items-center gap-3 rounded-md py-2 pl-3 pr-2 text-sm',
                      'transition-colors duration-150 ease-signal',
                      'before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full',
                      'before:transition-colors before:duration-150',
                      isActive
                        ? 'bg-elevated font-medium text-primary before:bg-accent'
                        : 'text-secondary before:bg-transparent hover:bg-elevated/60 hover:text-primary',
                    )
                  }
                >
                  <span className="text-base" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-line p-4">
          <p className="font-mono text-micro uppercase leading-relaxed text-muted">
            Fase 1 · Datos simulados
          </p>
        </div>
      </aside>
    </>
  )
}
