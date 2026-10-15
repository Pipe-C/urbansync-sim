import { Link } from 'react-router-dom'

import { InstrumentDial } from '@/components/landing'
import { AmbientIntersection } from '@/components/simulation/AmbientIntersection'
import { buttonClassName, SignalIcon } from '@/components/ui'

/**
 * The landing — the first page at `/`, before the door.
 *
 * The category default for this surface is a headline, a paragraph and a button
 * floating over nothing, followed by a row of equal cards. This page's answer is
 * the Control Room's own: the intersection is the subject, seated in a screen
 * bezel, and the product's claims are the instruments wired around it. Nothing
 * here is a number, because the landing demonstrates the mechanism and the
 * measurements belong to a running session in the dashboard.
 *
 * Two doors, not one. `/login` is the console — operate and compare. `/observer`
 * is public and needs no account, which is the honest offer for the evaluator who
 * only wants to watch the junction run. The scene is `aria-hidden` decoration; the
 * page is fully readable and operable without it.
 *
 * The ground is flat Console Black rather than a wash. Depth in this system is a
 * tonal step plus a hairline, so a gradient behind the desk would be the one soft
 * surface in a control room — decoration standing where a measurement should be.
 */
export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-canvas">
      <div className="relative mx-auto flex min-h-screen w-full max-w-shell flex-col px-4 py-6 sm:px-8 lg:px-12 lg:py-10">
        <header className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-b border-line pb-5">
          <div className="flex items-center gap-2.5">
            <SignalIcon className="text-xl text-accent" />
            <h1 className="text-xl font-semibold tracking-tight text-primary">UrbanSync Sim</h1>
          </div>
          <p className="max-w-md text-sm text-secondary">
            Un semáforo que decide en cada tick. No repite un ciclo fijo: lee el tráfico y lo
            reordena.
          </p>
        </header>

        <div className="grid flex-1 items-start gap-8 py-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,1fr)] lg:gap-12 lg:py-12">
          <section className="flex flex-col">
            <div className="rounded-lg border border-line bg-surface p-2 sm:p-3">
              <div className="flex items-center justify-between gap-4 px-2 pb-2">
                <span className="flex items-center gap-2 font-mono text-micro uppercase text-muted">
                  <span className="size-1.5 rounded-full bg-accent" />
                  En vivo
                </span>
                <span className="font-mono text-micro uppercase text-muted">
                  Av. Norte &times; Calle Este
                </span>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-canvas">
                <AmbientIntersection className="absolute inset-0" />
              </div>
            </div>

            <p className="mt-5 max-w-prose text-sm leading-relaxed text-secondary">
              Cuatro accesos con giro a la derecha, cruces de peatones y una ambulancia que pide
              prioridad. Todo corre simulado en el navegador, sin datos reales, para poder medir el
              control adaptativo contra un ciclo fijo sobre la misma secuencia de vehículos.
            </p>
          </section>

          <section className="flex flex-col gap-4" aria-label="Qué demuestra UrbanSync Sim">
            <InstrumentDial
              label="Comparación emparejada"
              from="Ciclo fijo"
              to="Adaptativo"
              reading={0.74}
              rest={0.14}
              band={{ from: 0.62, tone: 'accent' }}
              note="La misma secuencia de vehículos se controla dos veces. Lo que se publica es la diferencia entre ambas pasadas, no una sola."
            />
            <InstrumentDial
              label="Preempción de emergencia"
              from="Ceda el paso"
              to="Prioridad"
              reading={0.86}
              rest={0.2}
              band={{ from: 0.7, tone: 'emergency' }}
              note="Una ambulancia entra al cruce. El ciclo se reordena en el siguiente tick y vuelve solo a su ritmo."
            />
          </section>
        </div>

        <footer className="flex flex-col gap-6 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-lg text-sm leading-relaxed text-secondary">
            La consola sirve para operar y comparar. Si solo quieres mirar, el observador abre la
            simulación sin pedir cuenta.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/observer" className={buttonClassName({ variant: 'secondary', size: 'lg' })}>
              Observar
            </Link>
            <Link to="/login" className={buttonClassName({ size: 'lg' })}>
              Entrar
            </Link>
          </div>
        </footer>
      </div>
    </div>
  )
}
