/**
 * Transport state of the realtime link to the backend.
 *
 * Owned by `services/socket.ts` from Phase 4 onwards; rendered by the TopBar
 * connection indicator from Sprint 1-B. Defined here because both sides need it
 * and neither should import the other.
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'offline'
