import { TunnelClientMessage } from '../types';

/** The `pane_input` member of the client→server union. */
export type PaneInputMessage = Extract<TunnelClientMessage, { type: 'pane_input' }>;

// Construction of terminal-input frames sent to the desktop PTY. Kept pure (no
// React Native / WebSocket imports) so it can be unit-tested under node/tsx.

/**
 * Carriage return — the byte a real terminal emits on Enter. The desktop writes
 * our `data` bytes raw into the PTY, and Claude's TUI runs in raw mode where
 * submit is `\r` (0x0D), not `\n`. Sending `\n` types the line but never runs
 * it.
 */
export const ENTER = '\r';

/**
 * The canonical `pane_input` frame (shared fixture clientToServer.pane_input).
 * `paneId` MUST be a live desktop pane id echoed from a received `pane_list`
 * (format `t{tab}p{pane}`, e.g. `t0p0`); any other id is silently dropped by
 * the desktop. `data` is forwarded verbatim — control/escape bytes are never
 * stripped.
 */
export function buildPaneInput(paneId: string, data: string): PaneInputMessage {
  return { type: 'pane_input', paneId, data };
}

/** Encode a submitted input line: the typed text terminated by Enter (`\r`). */
export function encodeSubmit(text: string): string {
  return text + ENTER;
}
