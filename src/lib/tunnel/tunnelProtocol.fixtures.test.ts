// Wire-contract parity test (#1245). The fixtures here are a BYTE-IDENTICAL copy of
// base-studio-code's src/lib/tunnel/tunnelProtocol.fixtures.json — the single source of
// truth for the tunnel wire shapes. Every fixture is decoded into the mobile typed
// models (TunnelServerMessage / TunnelClientMessage); the decoder copies ONLY the fields
// the mobile model recognizes and then asserts a deep-equal back against the raw fixture.
// That makes the test fail on ANY drift in either direction:
//   • a fixture field the mobile model doesn't know about → extra key in `raw` → mismatch
//   • a field the model expects but the fixture lacks → the typed getter throws
//   • an unknown `type` discriminator → the decoder throws ("model drift")
// A schema change therefore cannot land on one side without failing this test, enforcing
// coordinated PRs in both repos. Read via fs to avoid JSON import-assertion friction under tsx.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type {
  TunnelServerMessage, TunnelClientMessage, PaneStatus, PaneStreamingState,
  PlanFile, PlanMessage, PlanPipelineRun,
} from '../types';

const fx = JSON.parse(
  readFileSync('src/lib/tunnel/tunnelProtocol.fixtures.json', 'utf8'),
) as {
  serverToClient: Record<string, Record<string, unknown>>;
  clientToServer: Record<string, Record<string, unknown>>;
};

type Raw = Record<string, unknown>;

// ── Typed field getters — assert presence + JS type, returning the value. ──
function str(o: Raw, k: string): string {
  assert.equal(typeof o[k], 'string', `field "${k}" must be a string`);
  return o[k] as string;
}
function num(o: Raw, k: string): number {
  assert.equal(typeof o[k], 'number', `field "${k}" must be a number`);
  return o[k] as number;
}
function bool(o: Raw, k: string): boolean {
  assert.equal(typeof o[k], 'boolean', `field "${k}" must be a boolean`);
  return o[k] as boolean;
}
/** Required value that may legitimately be null (e.g. session_state.prompt). */
function strOrNull(o: Raw, k: string): string | null {
  assert.ok(o[k] === null || typeof o[k] === 'string', `field "${k}" must be string|null`);
  return o[k] as string | null;
}
function arr(o: Raw, k: string): Raw[] {
  assert.ok(Array.isArray(o[k]), `field "${k}" must be an array`);
  return o[k] as Raw[];
}
/** Conditionally copy an optional string field only when present (so deep-equal stays exact). */
function copyOptStr(src: Raw, dst: Raw, k: string): void {
  if (k in src) dst[k] = str(src, k);
}

function decodeFile(o: Raw): PlanFile {
  return { relpath: str(o, 'relpath'), content: str(o, 'content') };
}
function decodeMessage(o: Raw): PlanMessage {
  const role = str(o, 'role');
  assert.ok(role === 'user' || role === 'assistant', `message.role must be user|assistant, got ${role}`);
  return { role, text: str(o, 'text'), at: num(o, 'at') };
}
function decodeRun(o: Raw): PlanPipelineRun {
  return { id: str(o, 'id'), stage: str(o, 'stage'), status: str(o, 'status') };
}

// ── Decoders: reconstruct the mobile model from a raw fixture, field by field. ──
function decodeServer(o: Raw): TunnelServerMessage {
  const type = str(o, 'type');
  switch (type) {
    case 'auth_ok':
      return { type };
    case 'pane_list':
      return {
        type,
        panes: arr(o, 'panes').map((p) => ({
          id: str(p, 'id'), cwd: str(p, 'cwd'), name: str(p, 'name'),
          status: str(p, 'status') as PaneStatus,
        })),
      };
    case 'pane_output':
      return { type, paneId: str(o, 'paneId'), data: str(o, 'data'), coarse: bool(o, 'coarse') };
    case 'pane_size':
      return { type, paneId: str(o, 'paneId'), cols: num(o, 'cols'), rows: num(o, 'rows') };
    case 'session_state':
      return {
        type, paneId: str(o, 'paneId'), status: str(o, 'status') as PaneStatus,
        currentTask: str(o, 'currentTask'), lastActivity: str(o, 'lastActivity'),
        prompt: strOrNull(o, 'prompt'),
      };
    case 'user_request':
      return { type, paneId: str(o, 'paneId'), prompt: str(o, 'prompt') };
    case 'plan_state':
      return {
        type,
        projectId: str(o, 'projectId'),
        currentStage: str(o, 'currentStage'),
        confirmedSections: arr(o, 'confirmedSections').map((_, i) => {
          const v = (o.confirmedSections as unknown[])[i];
          assert.equal(typeof v, 'string', 'confirmedSections[] must be strings');
          return v as string;
        }),
        files: arr(o, 'files').map(decodeFile),
        messages: arr(o, 'messages').map(decodeMessage),
        pipelineRuns: arr(o, 'pipelineRuns').map(decodeRun),
      };
    case 'plan_event': {
      const kind = str(o, 'kind');
      assert.ok(
        ['section_confirmed', 'stage_advanced', 'message_appended', 'pipeline_run'].includes(kind),
        `plan_event.kind drifted: ${kind}`,
      );
      const out: Raw = { type, projectId: str(o, 'projectId'), kind, at: num(o, 'at') };
      copyOptStr(o, out, 'section');
      copyOptStr(o, out, 'stage');
      if ('message' in o) out.message = decodeMessage(o.message as Raw);
      if ('run' in o) out.run = decodeRun(o.run as Raw);
      return out as unknown as TunnelServerMessage;
    }
    case 'plan_status':
      return { type, projectId: str(o, 'projectId'), currentStage: str(o, 'currentStage'), status: str(o, 'status') };
    default:
      throw new Error(`unknown serverToClient frame type "${type}" — mobile model drift`);
  }
}

function decodeClient(o: Raw): TunnelClientMessage {
  const type = str(o, 'type');
  switch (type) {
    case 'auth': {
      const out: Raw = { type, token: str(o, 'token') };
      copyOptStr(o, out, 'fcmToken');
      return out as unknown as TunnelClientMessage;
    }
    case 'set_fcm_token':
      return { type, fcmToken: str(o, 'fcmToken') };
    case 'pane_set_state':
      return { type, paneId: str(o, 'paneId'), state: str(o, 'state') as PaneStreamingState };
    case 'pane_focus':
      return { type, paneId: str(o, 'paneId') };
    case 'pane_input':
      return { type, paneId: str(o, 'paneId'), data: str(o, 'data') };
    case 'pane_resize':
      return { type, paneId: str(o, 'paneId'), cols: num(o, 'cols'), rows: num(o, 'rows') };
    case 'plan_advance':
      return { type, projectId: str(o, 'projectId'), stageKey: str(o, 'stageKey') };
    case 'plan_confirm':
      return { type, projectId: str(o, 'projectId'), section: str(o, 'section') };
    case 'plan_chat':
      return { type, projectId: str(o, 'projectId'), text: str(o, 'text') };
    default:
      throw new Error(`unknown clientToServer frame type "${type}" — mobile model drift`);
  }
}

test('the bundled fixtures match the documented top-level shape', () => {
  assert.equal(typeof fx.serverToClient, 'object', 'missing serverToClient block');
  assert.equal(typeof fx.clientToServer, 'object', 'missing clientToServer block');
  assert.ok(Object.keys(fx.serverToClient).length > 0, 'serverToClient is empty');
  assert.ok(Object.keys(fx.clientToServer).length > 0, 'clientToServer is empty');
});

test('every serverToClient fixture decodes to a mobile TunnelServerMessage with no drift', () => {
  for (const [key, raw] of Object.entries(fx.serverToClient)) {
    const decoded = decodeServer(raw);
    assert.deepEqual(decoded, raw, `serverToClient.${key} drifted from the mobile model`);
  }
});

test('every clientToServer fixture decodes to a mobile TunnelClientMessage with no drift', () => {
  for (const [key, raw] of Object.entries(fx.clientToServer)) {
    const decoded = decodeClient(raw);
    assert.deepEqual(decoded, raw, `clientToServer.${key} drifted from the mobile model`);
  }
});

test('the live-planning frames are present in the fixtures (contract coverage)', () => {
  for (const k of ['plan_state', 'plan_event', 'plan_status']) {
    assert.ok(k in fx.serverToClient, `serverToClient.${k} fixture missing — coverage gap`);
  }
  for (const k of ['plan_advance', 'plan_confirm', 'plan_chat']) {
    assert.ok(k in fx.clientToServer, `clientToServer.${k} fixture missing — coverage gap`);
  }
});
