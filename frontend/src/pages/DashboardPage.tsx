import { MetricsPanel, SimulationCanvas } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Badge } from '@/components/ui'
import { useSimulationStream } from '@/hooks/useSimulationStream'

/**
 * The main screen: the junction on the left, the measurements on the right.
 *
 * The clock is mounted here rather than inside a panel, because there is exactly
 * one of it and it belongs to the run, not to the chart. A dashboard whose
 * numbers advanced because a chart component felt like sampling is a dashboard
 * whose Stop button does not stop anything.
 *
 * The split is 70/30 on desktop and stacks below `lg`, which is where the
 * measurements stop being a sidebar and start being a second thing you scroll
 * to. The canvas is the subject; the numbers are the evidence for it, and that
 * order is the layout.
 */
export function DashboardPage() {
  useSimulationStream()

  return (
    <>
      <PageHeader
        title="Panel de simulación"
        description="Cruce de cuatro accesos bajo control adaptativo, comparado con un ciclo fijo sobre el mismo tráfico."
        action={<Badge tone="neutral">Motor del algoritmo</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-start">
        <SimulationCanvas className="min-h-[26rem] lg:min-h-[calc(100vh-16rem)]" />
        <MetricsPanel className="lg:sticky lg:top-4" />
      </div>
    </>
  )
}
