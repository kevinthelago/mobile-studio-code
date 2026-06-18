// Canonical serialization for sync. Both apps must produce byte-identical content
// from the same plan, or every line looks "changed" to the 3-way merge. This is part
// of the shared contract (pinned by plannerCore.fixtures.json), so keep it stable.

/** Normalize markdown: LF line endings, no trailing spaces, single trailing newline. */
export function canonicalMarkdown(text: string): string {
  const body = text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n+$/, '');
  return body.length ? `${body}\n` : '';
}

/** Recursively sort object keys so JSON serialization is order-independent. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortKeys((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

/** Canonical JSON: sorted keys, 2-space indent, LF, single trailing newline. */
export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

/** Canonicalize a file's content by path (JSON files get canonical JSON). */
export function canonicalize(path: string, content: string): string {
  if (/\.json$/i.test(path)) {
    try {
      return canonicalJson(JSON.parse(content));
    } catch {
      return canonicalMarkdown(content); // not valid JSON — treat as text
    }
  }
  return canonicalMarkdown(content);
}

/** FNV-1a 32-bit content hash (hex) — for cheap change detection in sync manifests. */
export function hashContent(content: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Split canonical content into lines (drops the single trailing newline). */
export function toLines(content: string): string[] {
  if (content === '') return [];
  return content.replace(/\n$/, '').split('\n');
}

/** Join lines back into canonical content (single trailing newline if non-empty). */
export function fromLines(lines: string[]): string {
  return lines.length ? `${lines.join('\n')}\n` : '';
}
