import { requireNativeModule } from 'expo-modules-core';

type NativeTlsWebSocket = {
  connect(url: string, fingerprint: string | null): void;
  send(text: string): void;
  close(): void;
  addListener(
    event: 'onOpen' | 'onMessage' | 'onError' | 'onClose',
    listener: (payload: { data?: string; message?: string }) => void,
  ): { remove: () => void };
};

// Lazily resolved so merely importing this file never triggers a native lookup.
// (The native module is absent until a dev build that includes it — until then,
// PinnedWebSocket is simply never constructed, so this is never called.)
let nativeModule: NativeTlsWebSocket | null = null;
function getNative(): NativeTlsWebSocket {
  if (!nativeModule) {
    nativeModule = requireNativeModule<NativeTlsWebSocket>('TlsWebSocket');
  }
  return nativeModule;
}

/**
 * Minimal `WebSocket`-shaped wrapper over the native pinned socket, exposing
 * only the surface `TunnelClient` uses (`onopen`/`onmessage`/`onerror`/
 * `onclose`, `send`, `close`, `readyState`, `OPEN`). Used only when a
 * self-signed `wss://` cert must be pinned by fingerprint; plain `ws://` keeps
 * using the built-in JS WebSocket.
 *
 * The native module backs a single connection, and `TunnelClient` only ever
 * holds one socket at a time, so a singleton native side is sufficient.
 */
export class PinnedWebSocket {
  static readonly OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onclose: (() => void) | null = null;

  private subs: { remove: () => void }[] = [];

  constructor(url: string, fingerprint?: string) {
    const native = getNative();
    this.subs.push(native.addListener('onOpen', () => {
      this.readyState = PinnedWebSocket.OPEN;
      this.onopen?.();
    }));
    this.subs.push(native.addListener('onMessage', (p) => {
      this.onmessage?.({ data: p.data ?? '' });
    }));
    this.subs.push(native.addListener('onError', (p) => {
      this.onerror?.(new Error(p.message ?? 'tunnel socket error'));
    }));
    this.subs.push(native.addListener('onClose', () => {
      this.readyState = 3;
      this.onclose?.();
      this.teardown();
    }));
    native.connect(url, fingerprint ?? null);
  }

  send(data: string): void {
    getNative().send(data);
  }

  close(): void {
    getNative().close();
    this.readyState = 3;
    this.teardown();
  }

  private teardown(): void {
    this.subs.forEach((s) => s.remove());
    this.subs = [];
  }
}
