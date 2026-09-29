import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import type { ConnectionStatus } from '@/types/connection'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export interface AppShellProps {
  children: ReactNode
  /** Defaults to the product name; the router supplies the route label. */
  title?: string
  connectionStatus?: ConnectionStatus
  userName?: string
}

const MOBILE_NAV_BREAKPOINT = 1024

/**
 * The console frame: a fixed sidebar, a sticky top bar and the main region.
 *
 * Owns the mobile drawer state because it is the only component that has to
 * coordinate it — the `TopBar` toggle and the `Sidebar` scrim are siblings
 * here, and lifting it into either of them would mean prop-drilling back out.
 */
export function AppShell({
  children,
  title,
  connectionStatus = 'offline',
  userName,
}: AppShellProps) {
  const [isNavOpen, setIsNavOpen] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const navToggleRef = useRef<HTMLButtonElement>(null)

  // A drawer closed by the user hands focus back to the control that opened it.
  // A drawer closed by the layout returning to the static sidebar must not —
  // the toggle is hidden at that width, and focusing it would strand the user.
  const closeNav = useCallback((restoreFocus: boolean) => {
    setIsNavOpen(false)
    if (restoreFocus) {
      navToggleRef.current?.focus()
    }
  }, [])

  // Move focus into the drawer on open. Without this, a keyboard user tabs on
  // from the top bar straight into the page content behind the scrim.
  useEffect(() => {
    if (isNavOpen) {
      sidebarRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    }
  }, [isNavOpen])

  // Close the drawer when the layout returns to the static sidebar, otherwise it
  // stays mounted off-canvas and a tab press lands on invisible links.
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${MOBILE_NAV_BREAKPOINT}px)`)
    const handle = (event: MediaQueryListEvent) => {
      if (event.matches) {
        closeNav(false)
      }
    }
    query.addEventListener('change', handle)
    return () => query.removeEventListener('change', handle)
  }, [closeNav])

  useEffect(() => {
    if (!isNavOpen) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeNav(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isNavOpen, closeNav])

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar ref={sidebarRef} isOpen={isNavOpen} onClose={() => closeNav(true)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          navToggleRef={navToggleRef}
          title={title ?? 'UrbanSync Sim'}
          connectionStatus={connectionStatus}
          isNavOpen={isNavOpen}
          onOpenNav={() => setIsNavOpen(true)}
          userName={userName}
        />

        <main id="main-content" className="flex-1 px-4 py-6 md:px-6 md:py-8">
          <div className="mx-auto w-full max-w-shell">{children}</div>
        </main>
      </div>
    </div>
  )
}
