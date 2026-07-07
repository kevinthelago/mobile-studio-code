import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_MCP_VIEW, selectMcpView } from './mcpView';

// A well-formed frame in the desktop `buildMcpPayload` shape (#2498).
const payload = {
  servers: [
    {
      id: 's1', name: 'GitHub MCP', enabled: true, transport: 'stdio',
      projects: [], installed: true,
    },
    {
      id: 's2', name: 'Docs', enabled: false, transport: 'http',
      projects: ['p1'], url: 'https://docs.example/mcp', installed: false,
    },
  ],
};

describe('selectMcpView', () => {
  it('maps server cards with transport, scope, and install state', () => {
    const v = selectMcpView(payload);
    assert.equal(v.servers.length, 2);
    const [s1, s2] = v.servers;
    assert.equal(s1.name, 'GitHub MCP');
    assert.equal(s1.transport, 'stdio');
    assert.equal(s1.installState, 'installed');
    assert.equal(s1.scopeLabel, 'Global');
    assert.equal(s1.url, null);
    assert.equal(s2.installState, 'available');
    assert.equal(s2.enabled, false);
    assert.equal(s2.scopeLabel, '1 project');
    assert.equal(s2.url, 'https://docs.example/mcp');
  });

  it('treats a missing installed flag as unknown', () => {
    const v = selectMcpView({ servers: [{ id: 's', name: 'X', transport: 'stdio' }] });
    assert.equal(v.servers[0].installState, 'unknown');
    // Non-boolean garbage is also unknown, never a crash.
    const g = selectMcpView({ servers: [{ id: 's', installed: 'yes' }] });
    assert.equal(g.servers[0].installState, 'unknown');
  });

  it('separates built-in tools when the payload marks them', () => {
    const v = selectMcpView({
      servers: [
        { id: 'user', name: 'User server', installed: true },
        { id: 'research', name: 'bsc research', installed: true, builtin: true },
      ],
    });
    assert.deepEqual(v.servers.map((s) => s.id), ['user']);
    assert.deepEqual(v.builtins.map((s) => s.id), ['research']);
  });

  it('carries a version through when present', () => {
    const v = selectMcpView({ servers: [{ id: 's', installed: true, version: '1.2.0' }] });
    assert.equal(v.servers[0].version, '1.2.0');
    assert.equal(selectMcpView(payload).servers[0].version, null);
  });

  it('tolerates missing/partial fields', () => {
    const v = selectMcpView({ servers: [{}] });
    const s = v.servers[0];
    assert.equal(s.id, 'mcp-0');
    assert.equal(s.name, 'mcp-0');
    assert.equal(s.enabled, false);
    assert.equal(s.transport, '—');
    assert.equal(s.installState, 'unknown');
  });

  it('drops non-object entries and survives wire garbage', () => {
    const v = selectMcpView({ servers: [null, 42, { id: 'ok' }] });
    assert.equal(v.servers.length, 1);
    assert.deepEqual(selectMcpView(undefined), EMPTY_MCP_VIEW);
    assert.deepEqual(selectMcpView(null), EMPTY_MCP_VIEW);
    assert.deepEqual(selectMcpView({ servers: 'nope' }), EMPTY_MCP_VIEW);
    assert.deepEqual(selectMcpView('junk'), EMPTY_MCP_VIEW);
  });
});
