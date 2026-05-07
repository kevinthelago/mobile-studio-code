export interface Token {
  t: string;
  v: string;
}

export interface CodeLine {
  n: number;
  tokens: Token[];
}

export const SAMPLE_CODE: CodeLine[] = [
  { n: 1, tokens: [{ t: 'kw', v: 'import' }, { t: 'sp', v: ' ' }, { t: 'id', v: 'asyncio' }] },
  { n: 2, tokens: [{ t: 'kw', v: 'from' }, { t: 'sp', v: ' ' }, { t: 'id', v: 'anthropic' }, { t: 'sp', v: ' ' }, { t: 'kw', v: 'import' }, { t: 'sp', v: ' ' }, { t: 'id', v: 'AsyncAnthropic' }] },
  { n: 3, tokens: [] },
  { n: 4, tokens: [{ t: 'cm', v: '# stream completions back to the editor' }] },
  { n: 5, tokens: [{ t: 'kw', v: 'async def' }, { t: 'sp', v: ' ' }, { t: 'fn', v: 'stream' }, { t: 'pn', v: '(' }, { t: 'pa', v: 'prompt' }, { t: 'pn', v: ': ' }, { t: 'ty', v: 'str' }, { t: 'pn', v: ') -> ' }, { t: 'ty', v: 'AsyncIterator' }, { t: 'pn', v: '[' }, { t: 'ty', v: 'str' }, { t: 'pn', v: ']:' }] },
  { n: 6, tokens: [{ t: 'sp', v: '    ' }, { t: 'id', v: 'client' }, { t: 'op', v: ' = ' }, { t: 'fn', v: 'AsyncAnthropic' }, { t: 'pn', v: '()' }] },
  { n: 7, tokens: [{ t: 'sp', v: '    ' }, { t: 'kw', v: 'async with' }, { t: 'sp', v: ' ' }, { t: 'id', v: 'client' }, { t: 'op', v: '.' }, { t: 'id', v: 'messages' }, { t: 'op', v: '.' }, { t: 'fn', v: 'stream' }, { t: 'pn', v: '(' }] },
  { n: 8, tokens: [{ t: 'sp', v: '        ' }, { t: 'pa', v: 'model' }, { t: 'op', v: '=' }, { t: 'st', v: '"claude-sonnet-4-5"' }, { t: 'pn', v: ',' }] },
  { n: 9, tokens: [{ t: 'sp', v: '        ' }, { t: 'pa', v: 'max_tokens' }, { t: 'op', v: '=' }, { t: 'nm', v: '1024' }, { t: 'pn', v: ',' }] },
  { n: 10, tokens: [{ t: 'sp', v: '        ' }, { t: 'pa', v: 'messages' }, { t: 'op', v: '=' }, { t: 'pn', v: '[{' }, { t: 'st', v: '"role"' }, { t: 'pn', v: ': ' }, { t: 'st', v: '"user"' }, { t: 'pn', v: ', ' }, { t: 'st', v: '"content"' }, { t: 'pn', v: ': ' }, { t: 'id', v: 'prompt' }, { t: 'pn', v: '}],' }] },
  { n: 11, tokens: [{ t: 'sp', v: '    ' }, { t: 'pn', v: ') ' }, { t: 'kw', v: 'as' }, { t: 'sp', v: ' ' }, { t: 'id', v: 'stream' }, { t: 'pn', v: ':' }] },
  { n: 12, tokens: [{ t: 'sp', v: '        ' }, { t: 'kw', v: 'async for' }, { t: 'sp', v: ' ' }, { t: 'id', v: 'text' }, { t: 'sp', v: ' ' }, { t: 'kw', v: 'in' }, { t: 'sp', v: ' ' }, { t: 'id', v: 'stream' }, { t: 'op', v: '.' }, { t: 'id', v: 'text_stream' }, { t: 'pn', v: ':' }] },
  { n: 13, tokens: [{ t: 'sp', v: '            ' }, { t: 'kw', v: 'yield' }, { t: 'sp', v: ' ' }, { t: 'id', v: 'text' }] },
];

export const TERMINAL_LOG = [
  { kind: 'system', text: 'claude --model sonnet-4.5 · workspace: llm-cli' },
  { kind: 'user', text: 'add streaming to the messages call' },
  { kind: 'thinking', text: 'reading client.py · 28 lines' },
  { kind: 'tool', name: 'edit', target: 'client.py', adds: 4, dels: 1 },
  { kind: 'reply', text: "Switched to client.messages.stream() and yielded text deltas. It's now an AsyncIterator — you'll need to await it." },
  { kind: 'user', text: 'run the tests' },
  { kind: 'tool', name: 'shell', cmd: 'pytest tests/ -q', exit: 0 },
  { kind: 'output', text: '....F\n5 passed, 1 failed in 0.42s' },
  { kind: 'reply', text: 'One failure in test_client_init — the mock still uses the sync class. Want me to update it?' },
];

export const FILE_TREE = [
  { type: 'folder', name: 'app', open: true, depth: 0 },
  { type: 'folder', name: 'llm', open: true, depth: 1 },
  { type: 'file', name: 'client.py', depth: 2, dirty: true, current: true, size: '2.1 KB' },
  { type: 'file', name: 'cli.py', depth: 2, size: '4.7 KB' },
  { type: 'file', name: 'tools.py', depth: 2, size: '1.4 KB' },
  { type: 'folder', name: 'config', open: false, depth: 1 },
  { type: 'folder', name: 'tests', open: false, depth: 0 },
  { type: 'file', name: 'pyproject.toml', depth: 0, size: '0.9 KB' },
  { type: 'file', name: 'README.md', depth: 0, size: '3.2 KB' },
  { type: 'file', name: '.gitignore', depth: 0, size: '180 B' },
];

export const RECENTS = [
  { name: 'client.py', path: 'app/llm', dirty: true },
  { name: 'cli.py', path: 'app/llm' },
  { name: 'tools.py', path: 'app/llm' },
];

export const FIND_RESULTS = [
  { file: 'app/llm/client.py', matches: [
    { line: 6, before: '    client = ', match: 'AsyncAnthropic', after: '()' },
    { line: 8, before: '        model="', match: 'claude', after: '-sonnet-4-5",' },
  ]},
  { file: 'app/llm/cli.py', matches: [
    { line: 12, before: 'from anthropic import ', match: 'AsyncAnthropic', after: '' },
    { line: 24, before: '    async with ', match: 'AsyncAnthropic', after: '() as c:' },
  ]},
  { file: 'tests/test_client.py', matches: [
    { line: 4, before: 'mock = mock.', match: 'AsyncAnthropic', after: '()' },
  ]},
];

export const GIT_STATUS = {
  branch: 'feat/streaming',
  upstream: 'origin/feat/streaming',
  ahead: 2,
  behind: 0,
  staged: [
    { path: 'app/llm/client.py', state: 'M', adds: 4, dels: 1 },
  ],
  unstaged: [
    { path: 'app/llm/cli.py', state: 'M', adds: 12, dels: 3 },
    { path: 'tests/test_client.py', state: 'M', adds: 6, dels: 0 },
    { path: 'docs/streaming.md', state: 'A', adds: 28, dels: 0 },
  ],
};
