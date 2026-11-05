import { NavLink } from 'react-router-dom'

import { CloseIcon, SignalIcon } from '@/components/ui/Icon'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { NAV_ITEMS } from './navigation'
import { cn } from '@/utils/cn'

const DESKTOP_QUERY = '(min-width: 1024px)'

export interface SidebarProps {
  /** Renders as a dismissible overlay drawer instead of a static column. */
  isOpen: boolean
  onClose: () => void
  ref?: React.Ref<HTMLElement>
}

/**
 * Primary navigation.
 *
 * Active state is carried by three channels at once — the raised row, the teal
 * node border and icon, and the brighter label — because colour alone is
 * invisible to anyone who cannot separate teal from the surface behind it.
 */
export function Sidebar({ isOpen, onClose, ref }: SidebarProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  // At desktop the column is always visible; below it the drawer is only
  // present when opened. `inert` removes the closed drawer's links from both
  // the tab order and the accessibility tree instead of relying on the
  // off-canvas transform alone.
  const isClosedDrawer = !isDesktop && !isOpen

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
        inert={isClosedDrawer}
        aria-hidden={isClosedDrawer}
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[17rem] flex-col border-r border-line bg-surface',
          'transition-transform duration-200 ease-signal',
          'lg:sticky lg:bottom-auto lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-elevated text-accent">
              <SignalIcon className="text-lg" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-[-0.01em] text-primary">
                UrbanSync{' '}
                <span className="font-mono text-micro font-normal uppercase tracking-[0.12em] text-accent">
                  Sim
                </span>
              </span>
              <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Control de cruce
              </span>
            </span>
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar navegación"
            className="-mr-1 grid size-9 shrink-0 place-items-center rounded-md text-secondary hover:bg-elevated hover:text-primary lg:hidden"
          >
            <CloseIcon className="text-lg" />
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-5">
          <p className="mb-3 pl-3 font-mono text-micro uppercase tracking-[0.16em] text-muted">
            Consola
          </p>

          <div className="relative min-h-0 flex-1 pb-6">
            <span aria-hidden="true" className="absolute bottom-0 left-6 top-6 w-px bg-line" />

            <ul className="relative flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex min-h-12 items-center gap-3 rounded-md py-2 pl-2.5 pr-3 text-sm',
                        'transition-colors duration-150 ease-signal',
                        isActive
                          ? 'bg-elevated font-medium text-primary'
                          : 'text-secondary hover:bg-elevated/60 hover:text-primary',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          aria-hidden="true"
                          className={cn(
                            'relative z-10 grid size-7 shrink-0 place-items-center rounded-full border bg-surface',
                            'transition-colors duration-150 ease-signal',
                            isActive
                              ? 'border-accent/60 text-accent'
                              : 'border-line text-muted group-hover:border-lineStrong group-hover:text-secondary',
                          )}
                        >
                          <span className="text-sm">{item.icon}</span>
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="shrink-0 border-t border-line p-4">
          <div className="rounded-md border border-line bg-canvas">
            <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
              <span className="font-mono text-micro uppercase tracking-[0.16em] text-muted">
                Sistema
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                MVP
              </span>
            </div>

            <div className="px-3 py-3">
              <p className="text-sm text-secondary">Sin modelo entrenado</p>
              <div aria-hidden="true" className="mt-2.5 flex gap-1">
                {Array.from({ length: 4 }, (_, index) => (
                  <span key={index} className="h-0.5 flex-1 rounded-full bg-accent/70" />
                ))}
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                Cuatro reglas rastreables
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
