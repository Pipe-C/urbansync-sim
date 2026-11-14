import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/layout'
import { NAV_ITEMS } from '@/components/layout/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useSimulationStore } from '@/store/simulationStore'
import { useStreamStore } from '@/store/streamStore'
import type { ConnectionStatus } from '@/types/connection'
import type { ConnectionState } from '@/types/stream'

/**
 * The chrome every console screen shares.
 *
 * The top bar's title is derived from `NAV_ITEMS` rather than passed down by each
 * page: the route already knows where it is, and a title supplied by the page is
 * a title that can disagree with the navigation the user just clicked.
 *
 * The connection badge reads the same stream the dashboard does. It used to be
 * pinned to `offline` because there was no backend; leaving it there once the
 * socket existed made the shell claim "Sin conexión" above a panel that said
 * "En vivo". The shell reports the channel, the panel reports the run, and both
 * now have a source for the claim.
 */

const CONNECTION_STATUS: Record<ConnectionState, ConnectionStatus> = {
  idle: 'idle',
  connecting: 'connecting',
  live: 'connected',
  stale: 'stale',
  reconnecting: 'reconnecting',
  error: 'offline',
}

export function ConsoleLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const connection = useStreamStore((state) => state.connection)

  const title = NAV_ITEMS.find((item) => item.to === location.pathname)?.label ?? 'UrbanSync Sim'

  function handleLogout() {
    // The run belongs to the identity that is leaving: close the stream without
    // filing a report under an account that is about to disappear.
    useSimulationStore.getState().abandon()
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <AppShell
      title={title}
      userName={user?.displayName}
      connectionStatus={CONNECTION_STATUS[connection]}
      onLogout={handleLogout}
    >
      <Outlet />
    </AppShell>
  )
}
