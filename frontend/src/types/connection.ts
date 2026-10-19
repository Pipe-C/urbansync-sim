/**
 * Transport state of the realtime link to the backend.
 *
 * Owned by `services/socket.ts` from Phase 4 onwards; rendered by the TopBar
 * connection indicator. Defined here because both sides need it and neither
 * should import the other.
 *
 * `idle` is not a failure: it is a console with no run open, so there is no
 * channel to report on. `stale` is not a disconnect either — the socket is up
 * but the ticks stopped arriving. Folding either one into `offline` would paint
 * a red fault on a healthy shell.
 */
export type ConnectionStatus =
  'idle' | 'connected' | 'connecting' | 'reconnecting' | 'stale' | 'offline'
