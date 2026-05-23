// Strips ANSI/VT100 escape sequences from PTY output so it can be
// rendered as plain text. Also normalises \r\n and bare \r to \n.
const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

export function stripAnsi(raw: string): string {
  return raw.replace(ANSI_RE, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Returns the last `n` lines of a (potentially large) string. */
export function lastLines(str: string, n: number): string {
  const lines = str.split('\n');
  return lines.length > n ? lines.slice(lines.length - n).join('\n') : str;
}
