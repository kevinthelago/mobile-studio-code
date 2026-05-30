import { TunnelPairing } from './types';

// Pure parser for the desktop's pairing QR (JSON). Kept dependency-free and
// testable. Decoding of hostPubKey (base64) / psk (hex) into bytes happens in
// the connection layer, not here.
export function parseTunnelPairing(raw: string): TunnelPairing | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const { relayUrl, room, hostPubKey, psk, lanUrl } = o;
  if (typeof relayUrl !== 'string' || !relayUrl) return null;
  if (typeof room !== 'string' || !room) return null;
  if (typeof hostPubKey !== 'string' || !hostPubKey) return null;
  if (typeof psk !== 'string' || !psk) return null;
  const pairing: TunnelPairing = { relayUrl, room, hostPubKey, psk };
  if (typeof lanUrl === 'string' && lanUrl) pairing.lanUrl = lanUrl;
  return pairing;
}
