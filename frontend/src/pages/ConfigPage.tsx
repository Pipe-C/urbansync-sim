import { PageHeader } from '@/components/layout'
import { SimulationConfigForm } from '@/components/config'
import { Badge } from '@/components/ui'

/**
 * The configuration screen.
 *
 * The form owns the live values, so the preview beside it re-derives while the
 * sliders move rather than on save: the screen's job is to make the mapping
 * from "what I set" to "what the junction will draw" visible at the moment the
 * operator is forming the mental model, which is while the finger is still on
 * the slider.
 */
export function ConfigPage() {
  return (
    <>
      <PageHeader
        title="Configuración"
        description="Tasa de llegada, reparto del flujo y política por defecto. Los cambios se aplican a la próxima corrida."
        action={
          <Badge tone="neutral" dot={false}>
            Guardado local
          </Badge>
        }
      />

      <SimulationConfigForm />
    </>
  )
}
