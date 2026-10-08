/**
 * The operator's own parameters for a simulation run.
 *
 * Everything here is a claim the operator makes before pressing Start, so it is
 * modelled apart from the run's transport state (`simulationStore`): the
 * configuration is what persists between sessions, and the run is what must not.
 */

/** Vehicle kinds the operator can weigh. Police stay out of the mix — their
 *  share is fixed by the fleet, and the preview reports it as fixed. */
export const CONFIGURABLE_KINDS = ['sedan', 'hatchback', 'taxi', 'van', 'bus'] as const

export type ConfigurableKind = (typeof CONFIGURABLE_KINDS)[number]

export const CONFIGURABLE_KIND_LABELS: Record<ConfigurableKind, string> = {
  sedan: 'Sedán',
  hatchback: 'Hatchback',
  taxi: 'Taxi',
  van: 'Van',
  bus: 'Autobús',
}

export interface SimulationConfig {
  /**
   * Vehicles per minute across all lanes, measured at the quietest point of the
   * demand cycle. The peak is derived from it by the model's own quiet-to-peak
   * relationship, so one slider reproduces the whole demand curve rather than
   * pinning a single rate the junction never actually sees.
   */
  quietRatePerMinute: number
  /** Unnormalised weights for the arriving stream. Zero removes a kind. */
  typeWeights: Record<ConfigurableKind, number>
  /** The policy the next run starts under. The live toggle still overrides it. */
  mode: 'adaptive' | 'fixed'
}

export const CONFIG_DEFAULTS: SimulationConfig = {
  quietRatePerMinute: 55,
  typeWeights: { sedan: 30, hatchback: 22, taxi: 13, van: 15, bus: 6 },
  mode: 'adaptive',
}
