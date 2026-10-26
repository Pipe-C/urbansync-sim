import { create } from 'zustand'
import { z } from 'zod'

import * as reportsService from '@/services/reports'
import { useAuthStore } from '@/store/authStore'
import type { SessionDraft, SessionOrigin, SessionRecord, SessionRow } from '@/types/report'

/**
 * The session history, from two sources and one table.
 *
 * A signed-in operator's runs live on the server (`GET /sessions`); a run made
 * through `/observer` has no account to belong to, so it is kept in this browser
 * and never leaves it. The table renders both, and every row says which it is —
 * evidence without provenance is a claim.
 *
 * The ordering of the write matters:
 *
 * 1. **The run is written locally first**, synchronously. It happened; a failing
 *    network is not a reason for it to disappear.
 * 2. If a session exists, it is then posted to the backend. On success the local
 *    copy is removed and the server's own row takes its place — one copy, with
 *    the server's id, which is what the export endpoints address.
 * 3. If the post fails, the local copy stays and the page says why. Nothing is
 *    silently dropped and nothing is silently duplicated.
 *
 * The guest log is capped at fifty runs; that is a full afternoon of demos and
 * far past what fits on one screen. Old records fall off the end.
 */

const GUEST_STORAGE_KEY = 'urbansync.sessions.guest'

/** The key the previous local-only log used (zustand `persist`). Read once, so
 *  an operator who demoed before this change does not lose their history. */
const LEGACY_STORAGE_KEY = 'urbansync.sessions'

const SESSION_LIMIT = 50

const frameSchema = z.object({
  averageWaitSeconds: z.number(),
  throughputPerMinute: z.number(),
  emergencyResponseSeconds: z.number(),
  longestQueue: z.number(),
})

/**
 * One stored row. Optional fields are what make the legacy shape readable: the
 * old log had no `status`, `createdAt` or `configId`, and the records it wrote
 * are still valid evidence, so they are normalised rather than discarded.
 */
const storedRecordSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  tickCount: z.number(),
  mode: z.enum(['adaptive', 'fixed']),
  vehiclesProcessed: z.number(),
  adaptive: frameSchema.nullable(),
  fixed: frameSchema.nullable(),
  status: z.enum(['running', 'completed', 'aborted']).optional(),
  configId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
})

function normalize(record: z.infer<typeof storedRecordSchema>): SessionRecord {
  return {
    id: record.id,
    mode: record.mode,
    status: record.status ?? 'completed',
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    durationSeconds: record.durationSeconds ?? 0,
    tickCount: record.tickCount,
    vehiclesProcessed: record.vehiclesProcessed,
    configId: record.configId ?? null,
    adaptive: record.adaptive ?? null,
    fixed: record.fixed ?? null,
    // A stored run that has an end time was finished; the field did not exist
    // to say so at the time.
    createdAt: record.createdAt ?? record.finishedAt ?? record.startedAt,
  }
}

function parseStored(raw: string | null): SessionRecord[] {
  if (raw === null) {
    return []
  }

  try {
    const parsed = z.array(storedRecordSchema).safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data.map(normalize) : []
  } catch {
    return []
  }
}

/**
 * Read the guest log, migrating the legacy key on the way through.
 *
 * `localStorage` survives deploys and schema changes, so a record that does not
 * parse is dropped rather than rendered: a table that crashes on one bad row is
 * worse than a shorter table.
 */
function readGuestLog(): SessionRecord[] {
  try {
    const current = window.localStorage.getItem(GUEST_STORAGE_KEY)
    if (current !== null) {
      return parseStored(current)
    }

    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy === null) {
      return []
    }

    const migrated = parseZustandPersisted(legacy)
    writeGuestLog(migrated)
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    return migrated
  } catch {
    // Private mode, a disabled store, a quota error: the history degrades to
    // in-memory, and the page still works for this visit.
    return []
  }
}

function parseZustandPersisted(raw: string): SessionRecord[] {
  try {
    const envelope = z
      .object({ state: z.object({ sessions: z.unknown() }) })
      .safeParse(JSON.parse(raw))
    if (!envelope.success) {
      return []
    }

    const parsed = z.array(storedRecordSchema).safeParse(envelope.data.state.sessions)
    return parsed.success ? parsed.data.map(normalize) : []
  } catch {
    return []
  }
}

function writeGuestLog(records: SessionRecord[]): void {
  try {
    window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(records))
  } catch {
    // A full or unavailable store is not worth failing a finished run over.
  }
}

function appendGuest(record: SessionRecord): void {
  writeGuestLog([...readGuestLog(), record].slice(-SESSION_LIMIT))
}

function removeGuest(id: string): void {
  writeGuestLog(readGuestLog().filter((record) => record.id !== id))
}

function row(record: SessionRecord, origin: SessionOrigin): SessionRow {
  return { ...record, origin }
}

/** Newest first, wherever the row came from. */
function ordered(rows: SessionRow[]): SessionRow[] {
  return [...rows].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
}

/** Insert or replace by id, so a row that arrived twice does not appear twice. */
function withRow(rows: SessionRow[], next: SessionRow): SessionRow[] {
  return ordered([next, ...rows.filter((row) => row.id !== next.id)])
}

function localRecord(draft: SessionDraft): SessionRecord {
  return {
    id: crypto.randomUUID(),
    mode: draft.mode,
    status: 'completed',
    startedAt: draft.startedAt,
    finishedAt: draft.finishedAt,
    durationSeconds: draft.durationSeconds,
    tickCount: draft.tickCount,
    vehiclesProcessed: draft.vehiclesProcessed,
    configId: null,
    adaptive: draft.adaptive,
    fixed: draft.fixed,
    createdAt: draft.finishedAt,
  }
}

export type SessionsStatus = 'idle' | 'loading' | 'ready' | 'error'
export type SessionsSource = SessionOrigin

export interface SessionsState {
  sessions: SessionRow[]
  status: SessionsStatus
  /** Where the list was last read from. `remote` means the server answered. */
  source: SessionsSource
  /** The last load or save failure, in the operator's language. */
  error: string | null

  /** Reads the history for the current identity. Safe to call on every visit. */
  load: () => Promise<void>
  /** Files a stopped run. Never throws: the caller is a Stop handler. */
  record: (draft: SessionDraft) => void
  clearError: () => void
}

export const useSessionsStore = create<SessionsState>()((set) => ({
  sessions: [],
  status: 'idle',
  source: 'local',
  error: null,

  load: async () => {
    const guestRows = readGuestLog().map((record) => row(record, 'local'))

    if (useAuthStore.getState().session === null) {
      set({ sessions: ordered(guestRows), status: 'ready', source: 'local', error: null })
      return
    }

    set({ status: 'loading', error: null })

    try {
      const remote = await reportsService.listSessions()
      set({
        sessions: ordered([...remote.map((record) => row(record, 'remote')), ...guestRows]),
        status: 'ready',
        source: 'remote',
        error: null,
      })
    } catch (error) {
      set({
        status: 'error',
        source: 'remote',
        // The guest rows are still evidence and still on this device; showing
        // them under a failed remote read is more useful than an empty table.
        sessions: ordered(guestRows),
        error: error instanceof Error ? error.message : 'No se pudo cargar el historial.',
      })
    }
  },

  record: (draft) => {
    const stored = localRecord(draft)

    appendGuest(stored)
    set((state) => ({ sessions: withRow(state.sessions, row(stored, 'local')) }))

    if (useAuthStore.getState().session === null) {
      return
    }

    // Fire-and-forget: Stop is synchronous and the operator should not wait on
    // the network to see the run stopped.
    void (async () => {
      try {
        const created = await reportsService.createSession(draft)

        removeGuest(stored.id)
        set((state) => ({
          sessions: withRow(state.sessions, row(created, 'remote')),
          source: 'remote',
          error: null,
        }))

        if (draft.samples.length > 0) {
          try {
            await reportsService.addSamples(created.id, draft.samples)
          } catch (error) {
            // The run survived; its series did not. Say so instead of leaving a
            // report that looks complete and exports with no evidence.
            set({
              error:
                error instanceof Error
                  ? `La corrida se guardó, pero sus lecturas no: ${error.message}`
                  : 'La corrida se guardó, pero sus lecturas no.',
            })
          }
        }
      } catch (error) {
        set({
          error:
            error instanceof Error
              ? `La corrida quedó solo en este navegador. ${error.message}`
              : 'La corrida quedó solo en este navegador.',
        })
      }
    })()
  },

  clearError: () => set({ error: null }),
}))
