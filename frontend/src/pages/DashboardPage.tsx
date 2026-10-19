import { Link } from 'react-router-dom'

import { MetricsPanel, SimulationCanvas } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { buttonClassName, ExternalLinkIcon } from '@/components/ui'
import { useSimulationStream } from '@/hooks/useSimulationStream'

/**
 * The main screen: the junction on the left, the measurements on the right.
 *
 * The stream is mounted here rather than inside a panel, because there is
 * exactly one socket and it belongs to the run, not to the chart. A dashboard
 * whose numbers advanced because a chart component felt like sampling is a
 * dashboard whose Stop button does not stop anything.
 *
 * The split is 70/30 on desktop and stacks below `lg`, which is where the
 * measurements stop being a sidebar and start being a second thing you scroll
 * to. The canvas is the subject; the numbers are the evidence for it, and that
 * order is the layout.
 *
 * The header action opens the account-free observer route in a new tab. It is
 * an anchor, not a button, because it navigates — the browser can then open,
 * copy or bookmark the destination the way it does for any other link.
 */
export function DashboardPage() {
  useSimulationStream()

  return (
    <>
      <PageHeader
        title="Panel de simulación"
        description="            El cruce corre en el motor local. Las lecturas y la comparación llegan del backend, que
            simula ambas políticas sobre las mismas llegadas."
        action={
          <Link
            to="/observer"
            target="_blank"
            rel="noreferrer"
            className={buttonClassName({
              variant: 'secondary',
              size: 'sm',
              className: 'gap-1.5',
            })}
          >
            Vista pública
            <ExternalLinkIcon className="text-sm" />
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-start">
        <SimulationCanvas className="min-h-[32rem] lg:min-h-[calc(100vh-16rem)]" />
        <MetricsPanel className="lg:sticky lg:top-4" />
      </div>
    </>
  )
}
