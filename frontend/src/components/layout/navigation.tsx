import type { ReactNode } from 'react'

import { ConfigIcon, DashboardIcon, ReportIcon } from '@/components/ui/Icon'

export interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

/**
 * The three screens the console exposes. `/observer` is deliberately absent:
 * it is a public read-only route that renders without the shell, so listing it
 * here would produce a nav link to a page with no chrome.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Panel', icon: <DashboardIcon /> },
  { to: '/config', label: 'Configuración', icon: <ConfigIcon /> },
  { to: '/reports', label: 'Informes', icon: <ReportIcon /> },
]
