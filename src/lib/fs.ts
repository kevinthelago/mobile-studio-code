import * as FileSystem from 'expo-file-system/legacy';
import {
  Manifest, PersistedChat, PendingOperation, Task, TaskIndex, TaskSummary,
} from './types';

export const REPOS_ROOT = (FileSystem.documentDirectory ?? '') + 'repos/';

export function repoSlug(fullName: string): string {
  return fullName.replace('/', '__');
}

export function repoDir(fullName: string): string {
  return REPOS_ROOT + repoSlug(fullName) + '/';
}

export function manifestPath(fullName: string): string {
  return repoDir(fullName) + '.msc-manifest.json';
}

export function chatPath(fullName: string): string {
  return repoDir(fullName) + '.msc-chat.json';
}

export function pendingPath(fullName: string): string {
  return repoDir(fullName) + '.msc-pending.json';
}

export async function ensureDir(path: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

export async function writeText(absPath: string, content: string): Promise<void> {
  const lastSlash = absPath.lastIndexOf('/');
  const parent = absPath.slice(0, lastSlash + 1);
  await ensureDir(parent);
  await FileSystem.writeAsStringAsync(absPath, content);
}

// Per-path write queue. Without this, two concurrent atomicWriteText calls
// for the same file race on the .tmp intermediate: writer A's tmp gets
// overwritten by writer B's tmp before A's move completes, and A's move
// then either lands B's content or fails outright. Serializing per path
// keeps the rename truly atomic from the caller's perspective.
const writeQueues = new Map<string, Promise<void>>();

async function rawAtomicWrite(absPath: string, content: string): Promise<void> {
  const tmp = absPath + '.tmp';
  await writeText(tmp, content);
  const targetInfo = await FileSystem.getInfoAsync(absPath);
  if (targetInfo.exists) {
    await FileSystem.deleteAsync(absPath, { idempotent: true });
  }
  await FileSystem.moveAsync({ from: tmp, to: absPath });
}

export async function atomicWriteText(absPath: string, content: string): Promise<void> {
  const previous = writeQueues.get(absPath) ?? Promise.resolve();
  // Chain the new write after any in-flight write for the same path.
  // Swallow the previous error so one failed write doesn't cascade.
  const next = previous
    .catch(() => undefined)
    .then(() => rawAtomicWrite(absPath, content));
  writeQueues.set(absPath, next);
  // Clean up the queue entry once this write completes (so we don't keep
  // a chain of completed promises in the map forever).
  next.finally(() => {
    if (writeQueues.get(absPath) === next) writeQueues.delete(absPath);
  });
  return next;
}

export async function readText(absPath: string): Promise<string> {
  return FileSystem.readAsStringAsync(absPath);
}

// Idempotent local delete. Used by the agent's delete_file tool to remove a
// file from the working copy; the remote deletion (if the file was tracked) is
// handled separately via the GitHub Contents API. `idempotent` means deleting a
// path that's already gone is a no-op rather than an error.
export async function deleteLocalFile(absPath: string): Promise<void> {
  await FileSystem.deleteAsync(absPath, { idempotent: true });
}

export async function exists(absPath: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(absPath);
  return info.exists;
}

export async function listDir(absPath: string): Promise<string[]> {
  const info = await FileSystem.getInfoAsync(absPath);
  if (!info.exists || !info.isDirectory) return [];
  return FileSystem.readDirectoryAsync(absPath);
}

export async function isDirectory(absPath: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(absPath);
  return info.exists && !!info.isDirectory;
}

export async function readManifest(repo: string): Promise<Manifest | null> {
  const p = manifestPath(repo);
  const info = await FileSystem.getInfoAsync(p);
  if (!info.exists) return null;
  const text = await FileSystem.readAsStringAsync(p);
  return JSON.parse(text) as Manifest;
}

export async function writeManifest(m: Manifest): Promise<void> {
  await ensureDir(repoDir(m.repo));
  await atomicWriteText(manifestPath(m.repo), JSON.stringify(m, null, 2));
}

export async function loadChat(repo: string): Promise<PersistedChat | null> {
  const p = chatPath(repo);
  const info = await FileSystem.getInfoAsync(p);
  if (!info.exists) return null;
  try {
    const text = await FileSystem.readAsStringAsync(p);
    return JSON.parse(text) as PersistedChat;
  } catch {
    return null;
  }
}

export async function saveChat(repo: string, chat: PersistedChat): Promise<void> {
  await atomicWriteText(chatPath(repo), JSON.stringify(chat));
}

export async function clearChat(repo: string): Promise<void> {
  await FileSystem.deleteAsync(chatPath(repo), { idempotent: true });
}

export async function loadPending(repo: string): Promise<PendingOperation | null> {
  const p = pendingPath(repo);
  const info = await FileSystem.getInfoAsync(p);
  if (!info.exists) return null;
  try {
    const text = await FileSystem.readAsStringAsync(p);
    return JSON.parse(text) as PendingOperation;
  } catch {
    return null;
  }
}

export async function savePending(repo: string, p: PendingOperation): Promise<void> {
  await atomicWriteText(pendingPath(repo), JSON.stringify(p));
}

export async function clearPending(repo: string): Promise<void> {
  await FileSystem.deleteAsync(pendingPath(repo), { idempotent: true });
}

// Cap the inlined CLAUDE.md / AGENTS.md so a runaway-large project file
// can't blow up the system prompt. The agent can always read_file if it
// needs the full thing.
const PROJECT_INSTRUCTIONS_MAX_CHARS = 16_000;

export type ProjectInstructions = { source: string; content: string };

// Look up project-level instructions at the repo root. CLAUDE.md is the
// canonical name; AGENTS.md is checked as a fallback for projects that use
// the OpenAI convention. Returns null when neither file exists.
export async function loadProjectInstructions(
  repo: string,
): Promise<ProjectInstructions | null> {
  const root = repoDir(repo);
  for (const name of ['CLAUDE.md', 'AGENTS.md']) {
    const p = root + name;
    if (!(await exists(p))) continue;
    try {
      let content = await readText(p);
      if (content.length > PROJECT_INSTRUCTIONS_MAX_CHARS) {
        content = content.slice(0, PROJECT_INSTRUCTIONS_MAX_CHARS) +
          `\n\n[…truncated at ${PROJECT_INSTRUCTIONS_MAX_CHARS} chars. Use read_file("${name}") for the rest.]`;
      }
      return { source: name, content };
    } catch {
      continue;
    }
  }
  return null;
}

export function isMscMetaFile(name: string): boolean {
  return (
    name === '.msc-manifest.json' ||
    name === '.msc-chat.json' ||
    name === '.msc-pending.json' ||
    name === '.msc-tasks' ||
    name === '.msc-tasks.json' ||
    name.endsWith('.tmp')
  );
}

// ── Task storage ───────────────────────────────────────────────────────────
// Per-task chat data lives at  repoDir/.msc-tasks/<id>.json
// The index at  repoDir/.msc-tasks.json  holds summaries + active task id.

export function tasksDir(repo: string): string {
  return repoDir(repo) + '.msc-tasks/';
}

export function taskPath(repo: string, taskId: string): string {
  return tasksDir(repo) + taskId + '.json';
}

export function taskIndexPath(repo: string): string {
  return repoDir(repo) + '.msc-tasks.json';
}

export async function readTaskIndex(repo: string): Promise<TaskIndex | null> {
  const p = taskIndexPath(repo);
  const info = await FileSystem.getInfoAsync(p);
  if (!info.exists) return null;
  try {
    const text = await FileSystem.readAsStringAsync(p);
    return JSON.parse(text) as TaskIndex;
  } catch {
    return null;
  }
}

export async function writeTaskIndex(repo: string, idx: TaskIndex): Promise<void> {
  await ensureDir(repoDir(repo));
  await atomicWriteText(taskIndexPath(repo), JSON.stringify(idx, null, 2));
}

export async function readTask(repo: string, taskId: string): Promise<Task | null> {
  const p = taskPath(repo, taskId);
  const info = await FileSystem.getInfoAsync(p);
  if (!info.exists) return null;
  try {
    const text = await FileSystem.readAsStringAsync(p);
    return JSON.parse(text) as Task;
  } catch {
    return null;
  }
}

export async function writeTask(repo: string, task: Task): Promise<void> {
  await ensureDir(tasksDir(repo));
  await atomicWriteText(taskPath(repo, task.id), JSON.stringify(task));
}

export async function deleteTask(repo: string, taskId: string): Promise<void> {
  await FileSystem.deleteAsync(taskPath(repo, taskId), { idempotent: true });
}

export function summarizeTask(task: Task): TaskSummary {
  return {
    id: task.id,
    title: task.title,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    archived: task.archived,
    linkedIssue: task.linkedIssue,
    turnCount: task.turns.length,
  };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export async function fileSize(absPath: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(absPath);
  if (!info.exists) return 0;
  const maybeSize = (info as { size?: number }).size;
  return typeof maybeSize === 'number' ? maybeSize : 0;
}
