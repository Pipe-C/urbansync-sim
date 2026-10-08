import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'

import { ConfigSlider } from '@/components/config/ConfigSlider'
import { DistributionPreview } from '@/components/config/DistributionPreview'
import { Button, Card } from '@/components/ui'
import { simulationConfigSchema, useConfigStore } from '@/store/configStore'
import { useSimulationStore } from '@/store/simulationStore'
import {
  CONFIGURABLE_KINDS,
  CONFIGURABLE_KIND_LABELS,
  CONFIG_DEFAULTS,
  type ConfigurableKind,
  type SimulationConfig,
} from '@/types/config'
import { cn } from '@/utils/cn'

/**
 * The configuration form: parameters on the left, their meaning on the right.
 *
 * Validation is the store's own schema through `zodResolver`, so the bounds the
 * form enforces and the bounds `save` re-checks are one set of numbers. The
 * preview re-derives from the live form values rather than from the saved ones:
 * the point of the mapping is to be visible while the slider moves, not after.
 */

const MODE_OPTIONS: { value: SimulationConfig['mode']; label: string }[] = [
  { value: 'adaptive', label: 'Adaptativo' },
  { value: 'fixed', label: 'Ciclo fijo' },
]

/** Field-by-field, because two objects holding the same configuration do not
 *  promise the same key order, and a stringified comparison would flicker
 *  false on every zod round-trip. The watched form state is deeply partial, so
 *  this reads it as such rather than pretending every field is present. */
function matchesSavedConfig(
  values:
    | {
        quietRatePerMinute?: number
        mode?: SimulationConfig['mode']
        typeWeights?: Partial<Record<ConfigurableKind, number>>
      }
    | undefined,
  saved: SimulationConfig,
): boolean {
  if (
    !values ||
    values.quietRatePerMinute !== saved.quietRatePerMinute ||
    values.mode !== saved.mode
  ) {
    return false
  }

  return CONFIGURABLE_KINDS.every(
    (kind) => (values.typeWeights?.[kind] ?? 0) === saved.typeWeights[kind],
  )
}

export function SimulationConfigForm() {
  const save = useConfigStore((state) => state.save)
  const resetToDefaults = useConfigStore((state) => state.resetToDefaults)
  const savedConfig = useConfigStore((state) => state.config)
  const status = useSimulationStore((state) => state.status)

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<SimulationConfig>({
    resolver: zodResolver(simulationConfigSchema),
    defaultValues: useConfigStore.getState().config,
  })

  const values = useWatch({ control })
  // Derived, not stored: "saved" is true exactly while the screen matches the
  // store, so an edit clears it and a reset back to the saved values restores
  // it, with no effect and no timestamp to go stale.
  const confirmed = matchesSavedConfig(values, savedConfig)

  const onSubmit = handleSubmit((config) => {
    save(config)
  })

  const onReset = () => {
    resetToDefaults()
    reset(CONFIG_DEFAULTS)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:items-start">
      <Card title="Parámetros de simulación">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <Controller
            control={control}
            name="quietRatePerMinute"
            render={({ field, fieldState }) => (
              <ConfigSlider
                label="Tasa de llegada · punto tranquilo"
                value={field.value}
                min={10}
                max={120}
                format={(value) => `${value} veh/min`}
                hint="Vehículos por minuto en todo el cruce, medidos en el punto más tranquilo de la curva de demanda. El pico se deriva de esta misma curva."
                error={fieldState.error?.message}
                disabled={isSubmitting}
                onChange={field.onChange}
              />
            )}
          />

          <fieldset
            className="flex flex-col gap-3 border-t border-line pt-5"
            disabled={isSubmitting}
          >
            <legend className="pr-3 font-mono text-micro uppercase text-muted">
              Reparto del flujo
            </legend>
            <p className="text-xs text-muted">
              Pesos relativos entre tipos; el reparto se normaliza solo. La policía mantiene su peso
              fijo de flota.
            </p>

            {CONFIGURABLE_KINDS.map((kind) => (
              <Controller
                key={kind}
                control={control}
                name={`typeWeights.${kind}`}
                render={({ field, fieldState }) => (
                  <ConfigSlider
                    label={CONFIGURABLE_KIND_LABELS[kind]}
                    value={field.value}
                    min={0}
                    max={100}
                    error={fieldState.error?.message}
                    disabled={isSubmitting}
                    onChange={field.onChange}
                  />
                )}
              />
            ))}
          </fieldset>

          <div className="flex flex-col gap-2 border-t border-line pt-5">
            <span id="config-mode-label" className="font-mono text-micro uppercase text-muted">
              Política por defecto
            </span>
            <Controller
              control={control}
              name="mode"
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-1.5">
                  <div
                    role="radiogroup"
                    aria-labelledby="config-mode-label"
                    className="flex w-fit rounded-md border border-lineStrong bg-elevated p-0.5"
                  >
                    {MODE_OPTIONS.map((option) => {
                      const isActive = field.value === option.value

                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          onClick={() => field.onChange(option.value)}
                          className={cn(
                            'rounded px-3 py-1.5 font-mono text-micro uppercase tracking-wider',
                            'transition-colors duration-150 ease-signal',
                            isActive
                              ? 'bg-accent text-canvas'
                              : 'text-secondary hover:text-primary',
                          )}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                  {fieldState.error && (
                    <p className="text-xs text-congested">{fieldState.error.message}</p>
                  )}
                </div>
              )}
            />
            <p className="text-xs text-muted">
              El panel puede cambiarla durante la corrida; este valor decide con cuál arranca la
              próxima.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <Button type="submit" disabled={!isDirty || isSubmitting}>
              Guardar configuración
            </Button>
            <Button type="button" variant="ghost" onClick={onReset} disabled={isSubmitting}>
              Restaurar valores
            </Button>

            <p role="status" className="ml-auto min-h-5 text-xs text-accent">
              {confirmed ? 'Configuración guardada.' : ''}
            </p>
          </div>

          <p className="text-xs leading-relaxed text-muted">
            {status === 'idle'
              ? 'Con el cruce en reposo, los cambios se aplican al instante.'
              : 'La simulación está en curso: los cambios se aplicarán al detenerla.'}
          </p>
        </form>
      </Card>

      <DistributionPreview
        quietRatePerMinute={values.quietRatePerMinute ?? CONFIG_DEFAULTS.quietRatePerMinute}
        typeWeights={values.typeWeights ?? {}}
        className="lg:sticky lg:top-4"
      />
    </div>
  )
}
