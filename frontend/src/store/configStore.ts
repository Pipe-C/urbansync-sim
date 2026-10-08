import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { z } from 'zod'

import { useSimulationStore } from '@/store/simulationStore'
import { CONFIGURABLE_KIND_LABELS, CONFIG_DEFAULTS, type SimulationConfig } from '@/types/config'

/**
 * The operator's parameters, persisted between sessions.
 *
 * Two decisions are load-bearing here:
 *
 * - **Versioned and validated on the way back in.** `localStorage` outlives the
 *   code that wrote it. A schema mismatch from a future field, or a hand-edited
 *   value, falls back to the defaults rather than crashing the console on load —
 *   the one screen that must never fail is the one that exists to configure the
 *   thing you are about to watch.
 * - **A revision counter, not an event bus.** The runner needs to know *that*
 *   the configuration changed, not what changed. Bumping a number keeps the
 *   store from importing the simulation and the runner from diffing objects.
 */

export const CONFIG_VERSION = 1

/**
 * The one schema, shared by the form and by rehydration.
 *
 * Exported because the configuration form validates with this exact schema via
 * `zodResolver`: a second copy of the bounds would be a second place for them
 * to drift apart from each other.
 */
export const simulationConfigSchema = z
  .object({
    quietRatePerMinute: z
      .number({ message: 'La tasa debe ser un número.' })
      .min(10, 'La tasa mínima es 10 veh/min.')
      .max(120, 'La tasa máxima es 120 veh/min.'),
    typeWeights: z.object({
      sedan: z.number().min(0, 'Sin pesos negativos.').max(100, 'Máximo 100.'),
      hatchback: z.number().min(0, 'Sin pesos negativos.').max(100, 'Máximo 100.'),
      taxi: z.number().min(0, 'Sin pesos negativos.').max(100, 'Máximo 100.'),
      van: z.number().min(0, 'Sin pesos negativos.').max(100, 'Máximo 100.'),
      bus: z.number().min(0, 'Sin pesos negativos.').max(100, 'Máximo 100.'),
    }),
    mode: z.enum(['adaptive', 'fixed'], { message: 'Elige una política de control.' }),
  })
  .refine((config) => Object.values(config.typeWeights).some((weight) => weight > 0), {
    message: `Mantén al menos un tipo activo (${Object.values(CONFIGURABLE_KIND_LABELS).join(', ')}).`,
    path: ['typeWeights'],
  })

export interface ConfigState {
  config: SimulationConfig
  /**
   * Bumped on every accepted save.
   *
   * The runner subscribes to this number rather than to the config itself: it
   * needs to know that the junction should be rebuilt, and diffing weight
   * objects to decide that would put the store's business logic in the loop.
   */
  revision: number
  /** ISO timestamp of the last accepted save, for the form's confirmation. */
  savedAt: string | null
  /** Validates, stores, bumps the revision, and applies the default policy
   *  when the junction is at rest. Rejects invalid configs without touching
   *  anything — the form keeps the values on screen so the error can be fixed. */
  save: (config: SimulationConfig) => boolean
  resetToDefaults: () => void
}

/** The mode radio is the next run's default policy, not a second live toggle:
 *  an idle junction adopts it immediately; a running one keeps its own mode,
 *  which is what the toggle in `SimulationControls` is for. */
function applyModeWhenIdle(mode: SimulationConfig['mode']): void {
  if (useSimulationStore.getState().status === 'idle') {
    useSimulationStore.getState().setMode(mode)
  }
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      config: CONFIG_DEFAULTS,
      revision: 0,
      savedAt: null,

      save: (config) => {
        const parsed = simulationConfigSchema.safeParse(config)
        if (!parsed.success) {
          return false
        }

        set((state) => ({
          config: parsed.data,
          revision: state.revision + 1,
          savedAt: new Date().toISOString(),
        }))
        applyModeWhenIdle(parsed.data.mode)
        return true
      },

      resetToDefaults: () => {
        set((state) => ({
          config: CONFIG_DEFAULTS,
          revision: state.revision + 1,
          savedAt: new Date().toISOString(),
        }))
        applyModeWhenIdle(CONFIG_DEFAULTS.mode)
      },
    }),
    {
      name: 'urbansync.config',
      storage: createJSONStorage(() => localStorage),
      version: CONFIG_VERSION,
      partialize: ({ config, revision }) => ({ config, revision }),
      /**
       * Validates the persisted payload instead of trusting it. A corrupt or
       * future-shaped config restores as the defaults, and the console comes
       * up configured rather than broken.
       */
      merge: (persisted, current) => {
        const restored = persisted as { config?: unknown; revision?: number } | undefined
        const parsed = simulationConfigSchema.safeParse(restored?.config)

        if (!parsed.success) {
          return { ...current }
        }

        return {
          ...current,
          config: parsed.data,
          revision: typeof restored?.revision === 'number' ? restored.revision : 0,
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyModeWhenIdle(state.config.mode)
        }
      },
    },
  ),
)
