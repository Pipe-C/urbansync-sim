import type { ControlMode, StrategyFrame } from '@/types/metrics'

/**
 * The reports surface's contract with the API.
 *
 * `SessionRecord` is the backend's `SimulationSessionRead`, field for field
 * (`backend/app/schemas/session.py`). It is also the shape the local guest log
 * writes, which is what lets the table render both sources without branching on
 * where a row came from: the only difference is `origin`, which the store adds.
 */

export type SessionStatus = 'running' | 'completed' | 'aborted'

/** The two files the backend can render for a finished run. */
export type ReportFormat = 'csv' | 'pdf'

/**
 * Where a row lives. A signed-in operator's runs are on the server; a run made
 * through `/observer` has no account to belong to, so it is kept in this
 * browser — and the table says which, because evidence without provenance is a
 * claim.
 */
export type SessionOrigin = 'remote' | 'local'

export interface SessionRecord {
  id: string
  mode: ControlMode
  status: SessionStatus
  startedAt: string
  finishedAt: string | null
  durationSeconds: number | null
  tickCount: number
  vehiclesProcessed: number
  configId: string | null
  /** `null` when the run has not produced a report — not the same as zero. */
  adaptive: StrategyFrame | null
  fixed: StrategyFrame | null
  createdAt: string
}

export interface SessionRow extends SessionRecord {
  origin: SessionOrigin
}

/**
 * One strategy's reading for one sample window.
 *
 * This is the evidence row (`simulation_metrics`), not a chart point: it carries
 * all four readings for one policy so the export can reconstruct the
 * comparison. The chart's own series is folded separately in `metricsStore`,
 * because a chart point is a different question from a report row.
 */
export interface MetricSample {
  tick: number
  t: number
  strategy: ControlMode
  averageWaitSeconds: number
  throughputPerMinute: number
  emergencyResponseSeconds: number
  longestQueue: number
}

export interface SampleBatchSummary {
  accepted: number
  duplicates: number
}

/**
 * What a stopped run hands the store.
 *
 * `record` is the only writer, and it takes everything in one object because
 * the samples belong to the same run as the summary: splitting them across two
 * calls lets a caller save one without the other, and the report would then
 * claim a series it does not have.
 */
export interface SessionDraft {
  startedAt: string
  finishedAt: string
  durationSeconds: number
  tickCount: number
  mode: ControlMode
  vehiclesProcessed: number
  adaptive: StrategyFrame
  fixed: StrategyFrame
  samples: MetricSample[]
}

/** The request body for `POST /sessions` — the draft without the evidence. */
export interface SessionCreateBody {
  startedAt: string
  finishedAt: string
  durationSeconds: number
  tickCount: number
  mode: ControlMode
  vehiclesProcessed: number
  adaptive: StrategyFrame
  fixed: StrategyFrame
}
