/**
 * Global error / warning bus.
 *
 * Any part of the app calls pushError() to report a problem.
 * The Errors tab and the agent loop both subscribe to receive them.
 */

export type ErrorSource = 'git' | 'agent' | 'build' | 'lsp' | 'llm' | 'app';
export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface AppError {
  id: string;
  source: ErrorSource;
  severity: ErrorSeverity;
  message: string;
  /** Optional raw detail (stack trace, stderr, etc.) */
  detail?: string;
  timestamp: number;
  resolved: boolean;
}

type Listener = (errors: AppError[]) => void;

// ── Singleton store ───────────────────────────────────────────────────────────

let _errors: AppError[] = [];
let _nextId = 1;
const _listeners = new Set<Listener>();

function notify() {
  const snapshot = [..._errors];
  _listeners.forEach((l) => l(snapshot));
}

// ── Public API ────────────────────────────────────────────────────────────────

export function pushError(
  source: ErrorSource,
  message: string,
  options: { severity?: ErrorSeverity; detail?: string } = {},
): AppError {
  const entry: AppError = {
    id: String(_nextId++),
    source,
    severity: options.severity ?? 'error',
    message,
    detail: options.detail,
    timestamp: Date.now(),
    resolved: false,
  };
  _errors = [entry, ..._errors];   // newest first
  notify();
  return entry;
}

export function resolveError(id: string) {
  _errors = _errors.map((e) => (e.id === id ? { ...e, resolved: true } : e));
  notify();
}

export function clearResolved() {
  _errors = _errors.filter((e) => !e.resolved);
  notify();
}

export function clearAll() {
  _errors = [];
  notify();
}

export function getErrors(): AppError[] {
  return [..._errors];
}

export function getUnresolvedCount(): number {
  return _errors.filter((e) => !e.resolved).length;
}

/** Subscribe to all changes. Returns an unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  _listeners.add(listener);
  listener([..._errors]); // immediate snapshot
  return () => _listeners.delete(listener);
}

/** Build a concise context string for the agent to consume. */
export function buildErrorContext(errors: AppError[]): string {
  const unresolved = errors.filter((e) => !e.resolved);
  if (unresolved.length === 0) return '';
  const lines = unresolved.map((e) => {
    const ts = new Date(e.timestamp).toLocaleTimeString();
    const detail = e.detail ? `\n  detail: ${e.detail.slice(0, 400)}` : '';
    return `[${e.severity.toUpperCase()}][${e.source}] ${e.message}${detail} (${ts})`;
  });
  return `The following errors/warnings are currently unresolved:\n${lines.join('\n')}`;
}
