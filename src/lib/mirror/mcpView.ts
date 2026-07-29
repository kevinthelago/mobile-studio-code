/**
 * View-model selectors for the `mcp` mirror domain (#223).
 *
 * Wire contract (desktop `buildMcpPayload`, base-studio-code#2498):
 *   { servers: McpCard[] }
 *   McpCard = { id, name, enabled, transport, projects, url?, installed }
 *
 * `installed` means the desktop resolved a runnable config for the server.
 *
 * `version` used to be read here. It is GONE (#240): no version exists in
 * `McpServer` or anywhere on the wire, so unlike a missing projection this was
 * unfixable — there is no string to project. Do not re-add it.
 *
 * `builtin` IS still read, and that is a deliberate difference. Unlike the
 * automations `Hook.builtin` (which cannot exist), `McpCard` can and should
 * gain it: the payload's `installedIds` already carries the built-in ids in a
 * form nothing can use, so the fix is a small edit to the same builder —
 * `withBuiltins(input.servers)`. Until that lands, `builtins` is empty and the
 * "Built-in tools" section does not render, which is honest rather than dead:
 * the section is one desktop field away from being live.
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
