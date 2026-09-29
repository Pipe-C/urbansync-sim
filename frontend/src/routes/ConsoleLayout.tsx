import { Outlet, useLocation } from 'react-router-dom'

import { AppShell } from '@/components/layout'
import { NAV_ITEMS } from '@/components/layout/navigation'
import { useAuth } from '@/hooks/useAuth'

/**
 * The chrome every console screen shares.
 *
 * The top bar's title is derived from `NAV_ITEMS` rather than passed down by each
 * page: the route already knows where it is, and a title supplied by the page is
 * a title that can disagree with the navigation the user just clicked.
 *
 * `connectionStatus` is `offline` throughout Phase 1. Nothing is connected yet —
 * the backend arrives in Phase 2 and the live socket in Phase 4 — and the
 * indicator is left showing that truth rather than faking a green light.
 */
export function ConsoleLayout() {
  const location = useLocation()
  const { user } = useAuth()

  const title = NAV_ITEMS.find((item) => item.to === location.pathname)?.label ?? 'UrbanSync Sim'

  return (
    <AppShell title={title} userName={user?.displayName} connectionStatus="offline">
      <Outlet />
    </AppShell>
  )
}
