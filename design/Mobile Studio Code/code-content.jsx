// Shared sample code (Python) with token classification for syntax highlighting.
// Each variant maps tokens → its own palette.

const SAMPLE_CODE = [
  { n: 1, tokens: [
    { t: 'kw', v: 'import' }, { t: 'sp', v: ' ' },
    { t: 'id', v: 'asyncio' },
  ]},
  { n: 2, tokens: [
    { t: 'kw', v: 'from' }, { t: 'sp', v: ' ' },
    { t: 'id', v: 'anthropic' }, { t: 'sp', v: ' ' },
    { t: 'kw', v: 'import' }, { t: 'sp', v: ' ' },
    { t: 'id', v: 'AsyncAnthropic' },
  ]},
  { n: 3, tokens: [] },
  { n: 4, tokens: [
    { t: 'cm', v: '# stream completions back to the editor' },
  ]},
  { n: 5, tokens: [
    { t: 'kw', v: 'async def' }, { t: 'sp', v: ' ' },
    { t: 'fn', v: 'stream' }, { t: 'pn', v: '(' },
    { t: 'pa', v: 'prompt' }, { t: 'pn', v: ': ' },
    { t: 'ty', v: 'str' }, { t: 'pn', v: ') -> ' },
    { t: 'ty', v: 'AsyncIterator' }, { t: 'pn', v: '[' },
    { t: 'ty', v: 'str' }, { t: 'pn', v: ']:' },
  ]},
  { n: 6, tokens: [
    { t: 'sp', v: '    ' },
    { t: 'id', v: 'client' }, { t: 'op', v: ' = ' },
    { t: 'fn', v: 'AsyncAnthropic' }, { t: 'pn', v: '()' },
  ]},
  { n: 7, tokens: [
    { t: 'sp', v: '    ' },
    { t: 'kw', v: 'async with' }, { t: 'sp', v: ' ' },
    { t: 'id', v: 'client' }, { t: 'op', v: '.' },
    { t: 'id', v: 'messages' }, { t: 'op', v: '.' },
    { t: 'fn', v: 'stream' }, { t: 'pn', v: '(' },
  ]},
  { n: 8, tokens: [
    { t: 'sp', v: '        ' },
    { t: 'pa', v: 'model' }, { t: 'op', v: '=' },
    { t: 'st', v: '"claude-sonnet-4-5"' }, { t: 'pn', v: ',' },
  ]},
  { n: 9, tokens: [
    { t: 'sp', v: '        ' },
    { t: 'pa', v: 'max_tokens' }, { t: 'op', v: '=' },
    { t: 'nm', v: '1024' }, { t: 'pn', v: ',' },
  ]},
  { n: 10, tokens: [
    { t: 'sp', v: '        ' },
    { t: 'pa', v: 'messages' }, { t: 'op', v: '=' },
    { t: 'pn', v: '[{' },
    { t: 'st', v: '"role"' }, { t: 'pn', v: ': ' },
    { t: 'st', v: '"user"' }, { t: 'pn', v: ', ' },
    { t: 'st', v: '"content"' }, { t: 'pn', v: ': ' },
    { t: 'id', v: 'prompt' }, { t: 'pn', v: '}],' },
  ]},
  { n: 11, tokens: [
    { t: 'sp', v: '    ' },
    { t: 'pn', v: ') ' }, { t: 'kw', v: 'as' }, { t: 'sp', v: ' ' },
    { t: 'id', v: 'stream' }, { t: 'pn', v: ':' },
  ]},
  { n: 12, tokens: [
    { t: 'sp', v: '        ' },
    { t: 'kw', v: 'async for' }, { t: 'sp', v: ' ' },
    { t: 'id', v: 'text' }, { t: 'sp', v: ' ' },
    { t: 'kw', v: 'in' }, { t: 'sp', v: ' ' },
    { t: 'id', v: 'stream' }, { t: 'op', v: '.' },
    { t: 'id', v: 'text_stream' }, { t: 'pn', v: ':' },
  ]},
  { n: 13, tokens: [
    { t: 'sp', v: '            ' },
    { t: 'kw', v: 'yield' }, { t: 'sp', v: ' ' },
    { t: 'id', v: 'text' },
  ]},
];

// Render one line's tokens given a palette { kw, fn, st, nm, cm, ty, op, pn, pa, id }.
function renderTokens(tokens, palette) {
  return tokens.map((tk, i) => {
    const color = palette[tk.t] || palette.id;
    if (tk.t === 'sp') return <span key={i}>{tk.v}</span>;
    return <span key={i} style={{ color }}>{tk.v}</span>;
  });
}

// Sample claude-CLI transcript shared across variants. Each chunk is a "block".
const CLAUDE_TRANSCRIPT = [
  { kind: 'prompt', text: 'add streaming to the messages call' },
  { kind: 'thinking', text: 'Reading client.py · 28 lines' },
  { kind: 'tool', name: 'edit', target: 'client.py', adds: 4, dels: 1 },
  { kind: 'reply', text: "Switched to client.messages.stream() and yielded text deltas. The function is now an AsyncIterator[str] — you'll need to await it." },
  { kind: 'prompt', text: 'run it' },
];

Object.assign(window, { SAMPLE_CODE, renderTokens, CLAUDE_TRANSCRIPT });
