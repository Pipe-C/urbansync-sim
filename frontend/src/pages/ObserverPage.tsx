import { useEffect } from 'react'

import { MetricsPanel, SimulationCanvas } from '@/components/dashboard'
import { SignalIcon } from '@/components/ui'
import { useSimulationStream } from '@/hooks/useSimulationStream'
import { useSimulationStore } from '@/store/simulationStore'

/**
 * The public view: the same junction, no account.
 *
 * It is a separate route rather than a branch inside `/login` — recorded in
 * PLAN.md § Open questions — and it renders without the console shell on
 * purpose. A visitor who has never signed in should not be shown a sidebar with
 * three links that all demand a password, so what they get is the evidence and
 * nothing else.
 *
 * The run starts by itself. An observer who arrives at a stopped junction has
 * been given a screenshot, and the whole reason this route exists is that
 * watching it move needs no credentials. The controls are still present: not
 * being signed in is not the same as not being allowed to press pause.
 */
export function ObserverPage() {
  useSimulationStream()

  // Read through `getState` rather than subscribing, so the effect has no
  // dependencies at all. Subscribing would mean listing `status` as a dependency,
  // which would re-run the effect on every state change and restart the run the
  // instant the visitor paused it.
  useEffect(() => {
    const { status, start } = useSimulationStore.getState()

    if (status === 'idle') {
      start()
    }
  }, [])

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-shell">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <SignalIcon className="text-xl text-accent" />
              <span className="text-sm font-medium text-primary">UrbanSync Sim</span>
            </div>
            <h1 className="mt-3 text-display font-semibold text-primary">Modo observador</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-secondary">
              La intersección en directo, sin necesidad de iniciar sesión. Controles adaptativos
              comparados con un ciclo fijo sobre el mismo tráfico.
            </p>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-start">
          <SimulationCanvas className="min-h-[32rem] lg:min-h-[calc(100vh-20rem)]" />
          <MetricsPanel className="lg:sticky lg:top-6" />
        </div>
      </div>
    </main>
  )
}
