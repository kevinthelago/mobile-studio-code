/**
 * View-model selectors for the `mcp` mirror domain (#223).
 *
 * Wire contract (desktop `buildMcpPayload`, base-studio-code#2498):
 *   { servers: McpCard[] }
 *   McpCard = { id, name, enabled, transport, projects, url?, installed }
 *
 * `installed` means the desktop resolved a runnable config for the server.
 * A `builtin` marker and a `version` are not in today's projection but are
 * read tolerantly (the desktop bundles built-in MCP sidecars — when the
 * projector starts marking them, the "Built-in tools" section fills in).
 */

import {
  asArray, asRecord, readBool, readString, scopeLabel,
} from './payload';

export type McpInstallState = 'installed' | 'available' | 'unknown';

export type McpServerVM = {
  id: string;
  name: string;
  enabled: boolean;
  transport: string;
  /** `unknown` when the payload omitted the installed flag. */
  installState: McpInstallState;
  /** Version string when the payload carries one; null otherwise. */
  version: string | null;
  scopeLabel: string;
  url: string | null;
  builtin: boolean;
};

export type McpView = {
  /** User-configured servers (non-built-in). */
  servers: McpServerVM[];
  /** Servers the payload marks as built-in desktop tools (may be empty). */
  builtins: McpServerVM[];
};

export const EMPTY_MCP_VIEW: McpView = { servers: [], builtins: [] };

function toServer(raw: unknown, index: number): McpServerVM | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id = readString(r.id, '') || `mcp-${index}`;
  return {
    id,
    name: readString(r.name, '').trim() || id,
    enabled: readBool(r.enabled, false),
    transport: readString(r.transport, '').trim() || '—',
    installState: typeof r.installed === 'boolean'
      ? (r.installed ? 'installed' : 'available')
      : 'unknown',
    version: readString(r.version, '').trim() || null,
    scopeLabel: scopeLabel(r.projects),
    url: readString(r.url, '').trim() || null,
    builtin: readBool(r.builtin, false),
  };
}

/** The whole `mcp` domain payload → display model. Never throws. */
export function selectMcpView(data: unknown): McpView {
  const root = asRecord(data);
  if (!root) return EMPTY_MCP_VIEW;
  const all = asArray(root.servers)
    .map(toServer)
    .filter((s): s is McpServerVM => s !== null);
  return {
    servers: all.filter((s) => !s.builtin),
    builtins: all.filter((s) => s.builtin),
  };
}
