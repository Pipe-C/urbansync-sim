import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { ComparisonTrack, DecisionPipeline, HeroJunction, Reveal } from '@/components/landing'
import { buttonClassName, SignalIcon } from '@/components/ui'

import '@/components/landing/landing.css'

/**
 * The landing, at `/`, before the door.
 *
 * The old version was a headline, a scene and two cards, and it described the
 * product competently while proving almost none of it. This one is built as a
 * short argument in three moves — the live junction, the rule that runs it, the
 * shape of the comparison — because the professor's question is never "what is
 * this" but "is the control real, and is it actually better".
 *
 * The answer to the first question is the hero: the dashboard's own WebGL scene,
 * stepped by the real engine, already running before anything is clicked, with
 * its own readings underneath. The answer to the second is the comparison block,
 * drawn as two tapes played together and explicitly labelled as a schematic —
 * the measured difference lives in the console, where it is computed.
 *
 * The world is unchanged: Console Black ground, Surface Navy panels, teal as the
 * only interactive voice, the four signal colours reserved for traffic state,
 * hairlines instead of shadows. What is new is only how much of the product the
 * page is willing to show.
 */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas">
        <div className="mx-auto flex w-full max-w-shell items-center justify-between gap-4 px-4 py-3 sm:px-8 lg:px-12">
          <Link to="/" className="flex items-center gap-2.5">
            <SignalIcon className="text-xl text-accent" />
            <span className="text-sm font-medium text-primary">UrbanSync Sim</span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Secciones de la página">
            <a
              href="#mecanismo"
              className="text-sm text-secondary transition-colors hover:text-primary"
            >
              Mecanismo
            </a>
            <a
              href="#comparacion"
              className="text-sm text-secondary transition-colors hover:text-primary"
            >
              Comparación
            </a>
            <a
              href="#referencias"
              className="text-sm text-secondary transition-colors hover:text-primary"
            >
              Referencias
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/observer" className={buttonClassName({ variant: 'ghost', size: 'sm' })}>
              Observar
            </Link>
            <Link to="/login" className={buttonClassName({ size: 'sm' })}>
              Entrar
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-shell gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center lg:gap-14 lg:px-12 lg:py-20">
          <div className="landing-enter" style={{ '--enter-delay': '0ms' } as CSSProperties}>
            <h1 className="max-w-xl text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-[1.05] tracking-tight text-primary">
              El cruce no espera un ciclo.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-secondary">
              UrbanSync Sim enfrenta un control adaptativo contra un ciclo fijo sobre la misma
              secuencia de vehículos. El semáforo pesa la cola de cada acceso, decide la fase en
              cada tick y cede la prioridad a una ambulancia cuando aparece.
            </p>

            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-micro uppercase text-muted">
              <span>Sin modelo entrenado</span>
              <span aria-hidden="true" className="text-line">
                ·
              </span>
              <span>Cuatro reglas rastreables</span>
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/login" className={buttonClassName({ size: 'lg' })}>
                Abrir la consola
              </Link>
              <Link
                to="/observer"
                className={buttonClassName({ variant: 'secondary', size: 'lg' })}
              >
                Observar sin cuenta
              </Link>
            </div>
          </div>

          <div className="landing-enter" style={{ '--enter-delay': '120ms' } as CSSProperties}>
            <HeroJunction />
          </div>
        </section>

        <section id="mecanismo" className="scroll-mt-24 border-t border-line">
          <div className="mx-auto w-full max-w-shell px-4 py-14 sm:px-8 lg:px-12 lg:py-20">
            <Reveal variant="rise">
              <h2 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
                Una regla que se puede leer.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary">
                Cada tick, el controlador compara la presión de los cuatro accesos y sirve el que
                más la necesita. No hay una política aprendida: hay cuatro reglas, y la frase de la
                derecha es la que acaba de decidir la fase que estás viendo.
              </p>
            </Reveal>

            <DecisionPipeline className="mt-8" />
          </div>
        </section>

        <section id="comparacion" className="scroll-mt-24 border-t border-line">
          <div className="mx-auto w-full max-w-shell px-4 py-14 sm:px-8 lg:px-12 lg:py-20">
            <Reveal variant="rise">
              <h2 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
                La misma calle, dos políticas.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary">
                El argumento del proyecto no es un número suelto: es un par. La consola ejecuta el
                control adaptativo y un ciclo fijo sobre la misma secuencia de vehículos, y mide la
                diferencia entre las dos pasadas. Esto es la forma de esa diferencia.
              </p>
            </Reveal>

            <Reveal variant="focus" className="mt-10">
              <ComparisonTrack />
            </Reveal>

            <Reveal variant="rise" className="mt-10">
              <Link
                to="/observer"
                className={buttonClassName({ variant: 'secondary', size: 'lg' })}
              >
                Ver la comparación en vivo
              </Link>
            </Reveal>
          </div>
        </section>

        <section id="referencias" className="scroll-mt-24 border-t border-line">
          <div className="mx-auto grid w-full max-w-shell gap-8 px-4 py-14 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-14 lg:px-12 lg:py-20">
            <Reveal variant="rise">
              <h2 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
                Sobre hombros conocidos.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">
                Un semáforo que se reordena según la demanda no es una idea nueva. UrbanSync Sim
                toma como referencia dos trabajos del dominio, y no tiene ninguna relación con
                ellos.
              </p>
            </Reveal>

            <Reveal variant="slide">
              <ul className="divide-y divide-line border-y border-line">
                <li>
                  <a
                    href="https://tfl.gov.uk/"
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-baseline justify-between gap-4 py-4"
                  >
                    <span>
                      <span className="block text-sm text-primary transition-colors group-hover:text-accent">
                        SCOOT — Transport for London
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-secondary">
                        Control adaptativo de tráfico urbano, en operación en Londres.
                      </span>
                    </span>
                    <span aria-hidden="true" className="font-mono text-micro text-muted">
                      tfl.gov.uk
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.ptvgroup.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-baseline justify-between gap-4 py-4"
                  >
                    <span>
                      <span className="block text-sm text-primary transition-colors group-hover:text-accent">
                        PTV Vissim — PTV Group
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-secondary">
                        Simulación microscópica de tráfico urbano y de intersecciones.
                      </span>
                    </span>
                    <span aria-hidden="true" className="font-mono text-micro text-muted">
                      ptvgroup.com
                    </span>
                  </a>
                </li>
              </ul>

              <p className="mt-4 text-xs leading-relaxed text-muted">
                UrbanSync Sim es un proyecto académico sin relación con Transport for London ni con
                PTV Group.
              </p>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-shell flex-col gap-8 px-4 py-12 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-12">
          <div>
            <div className="flex items-center gap-2.5">
              <SignalIcon className="text-xl text-accent" />
              <span className="text-sm font-medium text-primary">UrbanSync Sim</span>
            </div>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary">
              Simulación local en el navegador. Sin datos reales: la demanda y los tipos de vehículo
              son modelados.
            </p>
            <p className="mt-3 font-mono text-micro uppercase text-muted">
              Proyecto académico · I.U. Pascual Bravo
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/observer" className={buttonClassName({ variant: 'secondary', size: 'lg' })}>
              Observar sin cuenta
            </Link>
            <Link to="/login" className={buttonClassName({ size: 'lg' })}>
              Abrir la consola
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
