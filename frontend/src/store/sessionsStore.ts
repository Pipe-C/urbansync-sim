import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { z } from 'zod'

/**
 * The local session log.
 *
 * Phase 1 has no backend, so this is the honest stand-in: every run the
 * operator actually stops appends one record here, and the reports screen
 * reads the log. It is not demo data — the table is empty until a run has
 * finished, because an invented row on an evidence screen is a lie about the
 * only thing the product claims to produce.
 *
 * When the backend lands in Phase 2, `POST /sessions` replaces `record` and
 * `GET /sessions` replaces the persisted array; the `SessionRecord` shape is
 * what survives the swap, so the reports screen does not.
 */

const strategyFrameSchema = z.object({
  averageWaitSeconds: z.number(),
  throughputPerMinute: z.number(),
  emergencyResponseSeconds: z.number(),
  longestQueue: z.number(),
})

const sessionRecordSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  finishedAt: z.string(),
  durationSeconds: z.number(),
  tickCount: z.number(),
  mode: z.enum(['adaptive', 'fixed']),
  adaptive: strategyFrameSchema,
  fixed: strategyFrameSchema,
  vehiclesProcessed: z.number(),
})

export type SessionRecord = z.infer<typeof sessionRecordSchema>

/** Oldest records fall off the end: the console keeps the last fifty runs,
 *  which is a full afternoon of demos and far past what fits on one screen. */
const SESSION_LIMIT = 50

export interface SessionsState {
  sessions: SessionRecord[]
  /** Appends one finished run. Callers pass everything but the id. */
  record: (session: Omit<SessionRecord, 'id'>) => void
}

export const useSessionsStore = create<SessionsState>()(
  persist(
    (set) => ({
      sessions: [],

      record: (session) =>
        set((state) => ({
          sessions: [...state.sessions, { ...session, id: crypto.randomUUID() }].slice(
            -SESSION_LIMIT,
          ),
        })),
    }),
    {
      name: 'urbansync.sessions',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ sessions }) => ({ sessions }),
      /**
       * `localStorage` outlives the code that wrote it. Records that do not
       * parse — a future field, a hand edit, a truncated write — are dropped
       * rather than rendered: a reports table that crashes on one bad row is
       * worse than a shorter table.
       */
      merge: (persisted, current) => {
        const restored = persisted as { sessions?: unknown } | undefined
        const parsed = z.array(sessionRecordSchema).safeParse(restored?.sessions)

        return { ...current, sessions: parsed.success ? parsed.data : [] }
      },
    },
  ),
)
