import axios from 'axios'

import { http } from '@/services/http'
import type {
  ReportFormat,
  SampleBatchSummary,
  SessionCreateBody,
  SessionDraft,
  SessionRecord,
} from '@/types/report'

/**
 * The reports client.
 *
 * Pure HTTP: it returns data and blobs, and never touches the DOM — handing a
 * file to the browser is `utils/download.ts` and the component's decision, which
 * is what keeps these requests testable and the download policy visible where
 * the button is.
 *
 * Reads and writes are authenticated (`/sessions` and `/reports` are owned by a
 * user). A guest run does not reach this module at all: `/observer` has no
 * account, so its runs live in the browser and the store keeps them there.
 */

/** One message for every failure the operator cannot act on differently. */
const CONNECTION_ERROR = 'No se pudo conectar con el servidor. Inténtalo de nuevo.'

function messageFor(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return CONNECTION_ERROR
  }

  if (error.response?.status === 401) {
    return 'Tu sesión expiró. Vuelve a iniciar sesión para ver tus corridas.'
  }

  if (error.response?.status === 404) {
    return 'Esa corrida ya no está disponible.'
  }

  return CONNECTION_ERROR
}

/** The caller's runs, newest first. */
export async function listSessions(): Promise<SessionRecord[]> {
  try {
    const { data } = await http.get<SessionRecord[]>('/sessions')
    return data
  } catch (error) {
    throw new Error(messageFor(error))
  }
}

/**
 * Persist one finished run.
 *
 * The backend writes the run and its report together: the payload carries both
 * strategy frames, so a run appears in the history already able to compare its
 * policies. The samples are a separate flush because they are evidence rather
 * than a summary, and a long run should not have to hold them in one request.
 */
export async function createSession(draft: SessionDraft): Promise<SessionRecord> {
  const body: SessionCreateBody = {
    startedAt: draft.startedAt,
    finishedAt: draft.finishedAt,
    durationSeconds: draft.durationSeconds,
    tickCount: draft.tickCount,
    mode: draft.mode,
    vehiclesProcessed: draft.vehiclesProcessed,
    adaptive: draft.adaptive,
    fixed: draft.fixed,
  }

  try {
    const { data } = await http.post<SessionRecord>('/sessions', body)
    return data
  } catch (error) {
    throw new Error(messageFor(error))
  }
}

/**
 * Append a run's metric samples.
 *
 * Idempotent on the server, so a retry is safe; the response's duplicate count
 * is returned rather than discarded, because a sampler stuck replaying the same
 * window is a bug worth being able to see.
 *
 * The batch is bounded client-side by `metricsStore`'s sample cap, which is
 * deliberately far below the endpoint's limit.
 */
export async function addSamples(
  sessionId: string,
  samples: SessionDraft['samples'],
): Promise<SampleBatchSummary> {
  try {
    const { data } = await http.post<SampleBatchSummary>(`/sessions/${sessionId}/metrics`, {
      samples,
    })
    return data
  } catch (error) {
    throw new Error(messageFor(error))
  }
}

export interface ReportFile {
  blob: Blob
  /** As the server named it; the browser saves the file under this name. */
  filename: string
}

/**
 * Fetch a rendered report. The caller decides when to save it.
 *
 * The filename comes from `Content-Disposition` because the server owns the
 * naming convention (it embeds the run's start time and id). The fallback keeps
 * a download working if a proxy strips the header.
 */
export async function fetchReportFile(
  sessionId: string,
  format: ReportFormat,
): Promise<ReportFile> {
  try {
    const response = await http.get<Blob>(`/reports/${sessionId}/export.${format}`, {
      responseType: 'blob',
    })

    return {
      blob: response.data,
      filename: filenameFrom(
        response.headers['content-disposition'],
        `urbansync-${sessionId.slice(0, 8)}.${format}`,
      ),
    }
  } catch (error) {
    throw new Error(messageFor(error))
  }
}

function filenameFrom(disposition: unknown, fallback: string): string {
  if (typeof disposition !== 'string') {
    return fallback
  }

  const match = /filename="?([^";]+)"?/i.exec(disposition)
  return match?.[1]?.trim() ?? fallback
}
