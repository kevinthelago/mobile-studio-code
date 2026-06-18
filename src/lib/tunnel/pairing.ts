import { PairingPayload } from '../types';

// Single source of truth for interpreting the desktop's pairing payload. Used
// for QR scans, manual paste, AND the persisted reconnect state so all three
// are validated and normalised identically. Pure (no RN imports) → testable.

/**
 * Normalise the relay URL the way the desktop does: map `http(s)://` to
 * `ws(s)://` and trim trailing slashes. The QR may carry an `https://` URL (it
 * mirrors what the user typed in settings), but a WebSocket can only be dialed
 * with `ws://`/`wss://`. Anything already `ws(s)://` (or scheme-less) is left
 * as-is apart from slash trimming.
 */
export function normalizeRelayUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (/^https:\/\//i.test(trimmed)) return `wss://${trimmed.slice(8)}`;
  if (/^http:\/\//i.test(trimmed)) return `ws://${trimmed.slice(7)}`;
  return trimmed;
}

/**
 * Parse and validate a pairing payload from raw text (a scanned QR, a pasted
 * string, or persisted JSON). Returns null if it isn't valid JSON or is missing
 * any of the four required string fields. The relay URL is normalised so the
 * returned (and persisted) payload is canonical `ws(s)://`.
 *
 * Per base-studio-code the values are opaque: `room` is a base64url id,
 * `hostPubKey` standard base64, `psk` 64 hex chars — none are decoded here.
 */
export function parsePairingPayload(text: string): PairingPayload | null {
  let o: unknown;
  try {
    o = JSON.parse(text);
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object') return null;
  const { relayUrl, room, hostPubKey, psk } = o as Record<string, unknown>;
  if (
    typeof relayUrl !== 'string' || !relayUrl ||
    typeof room !== 'string' || !room ||
    typeof hostPubKey !== 'string' || !hostPubKey ||
    typeof psk !== 'string' || !psk
  ) {
    return null;
  }
  return { relayUrl: normalizeRelayUrl(relayUrl), room, hostPubKey, psk };
}
