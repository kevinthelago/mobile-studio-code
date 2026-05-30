import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ChatMessage, ChatTurn, ContentBlock, Manifest, RetryStatus, CancelSignal, TextBlock,
  Task, TaskSummary, TaskIndex, LinkedIssue, AttachedImage,
} from './types';
import { KEYS, getSecret, setSecret, deleteSecret } from './storage';
import {
  readManifest, writeManifest, repoDir, readText, writeText,
  loadPending, savePending, clearPending,
  writeTask, writeTaskIndex, readTask, deleteTask as fsDeleteTask,
  summarizeTask,
} from './fs';
import {
  bootstrapTasks, makeTask, patchIndexEntry, removeFromIndex, setActive,
} from './tasks';
import { runAgent, AgentEvent } from './agent';
import { pullRepo, pushModifiedFiles, PushFailure } from './github';
import { pushError } from './errorBus';

// No blocking onboarding: the app loads straight into the tabs. Credentials
// (GitHub PAT, Anthropic key) and repo selection are requested just-in-time and
// managed from Settings. Stage is only 'loading' (restoring secrets) → 'ready'.
type Stage = 'loading' | 'ready';

type SessionValue = {
  stage: Stage;
  pat: string | null;
  apiKey: string | null;
  ghUser: string | null;
  manifest: Manifest | null;
  modifiedCount: number;

  // Auth + repo actions
  // apiKey is optional: it's only needed for the on-device (standalone) agent.
  // In tunnel mode the paired desktop holds credentials, so the phone can run
  // with a GitHub PAT alone.
  saveAuth: (pat: string, apiKey: string | null, ghUser: string) => Promise<void>;
  saveApiKey: (apiKey: string | null) => Promise<void>;
  resetAuth: () => Promise<void>;
  selectRepo: (manifest: Manifest) => Promise<void>;
  clearRepo: () => Promise<void>;
  refreshManifest: () => Promise<void>;

  // File actions
  currentPath: string | null;
  openFile: (path: string) => Promise<void>;
  closeFile: () => void;
  currentContent: string | null;
  setCurrentContent: (content: string) => void;
  saveCurrentFile: () => Promise<void>;
  isCurrentDirty: boolean;

  // Sync
  pulling: boolean;
  pushing: boolean;
  pull: () => Promise<{
    updated: number; added: number; unchanged: number; conflicts: string[];
  }>;
  push: (message: string) => Promise<{ pushed: number; failures: PushFailure[] }>;

  // Tasks
  taskSummaries: TaskSummary[];
  activeTask: Task | null;
  createTask: (title: string) => Promise<Task>;
  switchTask: (taskId: string) => Promise<void>;
  renameTask: (taskId: string, title: string) => Promise<void>;
  archiveTask: (taskId: string, archived: boolean) => Promise<void>;
  deleteTaskById: (taskId: string) => Promise<void>;
  linkIssueToTask: (taskId: string, issue: LinkedIssue | null) => Promise<void>;

  // Chat (delegates to active task)
  turns: ChatTurn[];
  chatBusy: boolean;
  retry: RetryStatus;
  resumeNotice: string | null;
  send: (text: string, images?: AttachedImage[]) => Promise<void>;
  cancelChat: () => void;
  clearChat: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>('loading');
  const [pat, setPat] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [ghUser, setGhUser] = useState<string | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);

  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [currentContent, setCurrentContentState] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string | null>(null);

  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);

  const [taskIndex, setTaskIndex] = useState<TaskIndex | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const [chatBusy, setChatBusy] = useState(false);
  const [retry, setRetry] = useState<RetryStatus>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);

  const manifestRef = useRef<Manifest | null>(null);
  const activeTaskRef = useRef<Task | null>(null);
  const taskIndexRef = useRef<TaskIndex | null>(null);
  const cancelRef = useRef<CancelSignal>({ cancelled: false });
  // Mirror the API key into a ref so the agent gate reads the latest value even
  // when a key is added just-in-time (the prompt modal saves the key, then the
  // caller immediately invokes send() before a re-render propagates state).
  const apiKeyRef = useRef<string | null>(null);

  useEffect(() => { manifestRef.current = manifest; }, [manifest]);
  useEffect(() => { activeTaskRef.current = activeTask; }, [activeTask]);
  useEffect(() => { taskIndexRef.current = taskIndex; }, [taskIndex]);
  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);

  // Bootstrap on mount: load secrets, manifest, task index.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, k, u, r] = await Promise.all([
        getSecret(KEYS.GITHUB_PAT),
        getSecret(KEYS.ANTHROPIC_KEY),
        getSecret(KEYS.GITHUB_USER),
        getSecret(KEYS.REPO),
      ]);
      if (cancelled) return;
      setPat(p);
      setApiKey(k);
      setGhUser(u);

      // Only the GitHub PAT is required to leave setup. The Anthropic key is
      // optional — without it the app runs in tunnel mode (paired desktop) and
      // the on-device agent stays disabled until a key is added.
      apiKeyRef.current = k;
      if (r) {
        const m = await readManifest(r);
        if (cancelled) return;
        if (m) {
          setManifest(m);
          manifestRef.current = m;
        }
      }
      setStage('ready');
    })();
    return () => { cancelled = true; };
  }, []);

  // Load tasks for the active repo whenever it changes.
  useEffect(() => {
    if (!manifest) {
      setTaskIndex(null);
      setActiveTask(null);
      activeTaskRef.current = null;
      taskIndexRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      const repo = manifest.repo;
      const { index, active } = await bootstrapTasks(repo);
      if (cancelled) return;
      setTaskIndex(index);
      setActiveTask(active);
      taskIndexRef.current = index;
      activeTaskRef.current = active;

      // Auto-resume if a checkpoint exists for the currently-active task.
      const pending = await loadPending(repo);
      if (cancelled) return;
      if (pending && (!pending.taskId || pending.taskId === active.id)) {
        setResumeNotice('Resuming previous session…');
        runWithCheckpoint(pending.history, true);
      } else if (pending) {
        // Pending belongs to a different task — discard so we don't replay it.
        await clearPending(repo);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest?.repo]);

  // Persist the active task whenever its turns/history change. A busy agent
  // turn fires dozens of state updates per second (one per event); without
  // debouncing we'd serialize ~100KB of JSON to disk on every one. We
  // coalesce to at most one write per ~400ms, with a guaranteed final flush
  // when the agent finishes (chatBusy false → flushPendingTaskWrite).
  const pendingWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWrittenTaskRef = useRef<Task | null>(null);

  const flushPendingTaskWrite = useCallback(() => {
    if (pendingWriteTimerRef.current) {
      clearTimeout(pendingWriteTimerRef.current);
      pendingWriteTimerRef.current = null;
    }
    const m = manifestRef.current;
    const t = activeTaskRef.current;
    if (!m || !t) return;
    if (lastWrittenTaskRef.current === t) return;
    lastWrittenTaskRef.current = t;
    writeTask(m.repo, t).catch((e) => {
      console.warn('writeTask failed:', e);
    });
  }, []);

  useEffect(() => {
    if (!manifest || !activeTask) return;
    if (lastWrittenTaskRef.current === activeTask) return;
    if (pendingWriteTimerRef.current) clearTimeout(pendingWriteTimerRef.current);
    pendingWriteTimerRef.current = setTimeout(() => {
      pendingWriteTimerRef.current = null;
      flushPendingTaskWrite();
    }, 400);
    return () => {
      if (pendingWriteTimerRef.current) {
        clearTimeout(pendingWriteTimerRef.current);
        pendingWriteTimerRef.current = null;
      }
    };
  }, [manifest, activeTask, flushPendingTaskWrite]);

  const modifiedCount = useMemo(() => {
    if (!manifest) return 0;
    return Object.values(manifest.files).filter((f) => f.modified).length;
  }, [manifest]);

  const isCurrentDirty = useMemo(() => {
    if (currentContent === null || originalContent === null) return false;
    return currentContent !== originalContent;
  }, [currentContent, originalContent]);

  // ── Auth ─────────────────────────────────────────────────────────────────

  const saveAuth = useCallback(async (
    newPat: string, newKey: string | null, newUser: string,
  ) => {
    await setSecret(KEYS.GITHUB_PAT, newPat);
    // The key is optional — clear any stored value when omitted so state and
    // secure storage stay in sync (e.g. when re-running setup to remove a key).
    if (newKey) {
      await setSecret(KEYS.ANTHROPIC_KEY, newKey);
    } else {
      await deleteSecret(KEYS.ANTHROPIC_KEY);
    }
    await setSecret(KEYS.GITHUB_USER, newUser);
    setPat(newPat);
    apiKeyRef.current = newKey;
    setApiKey(newKey);
    setGhUser(newUser);
  }, []);

  // Persist (or clear) just the Anthropic key, without touching GitHub auth.
  // Used by the just-in-time key prompt so a user who skipped it at setup can
  // add it the moment the on-device agent is invoked.
  const saveApiKey = useCallback(async (newKey: string | null) => {
    if (newKey) {
      await setSecret(KEYS.ANTHROPIC_KEY, newKey);
    } else {
      await deleteSecret(KEYS.ANTHROPIC_KEY);
    }
    apiKeyRef.current = newKey;
    setApiKey(newKey);
  }, []);

  const resetAuth = useCallback(async () => {
    await Promise.all([
      deleteSecret(KEYS.GITHUB_PAT),
      deleteSecret(KEYS.ANTHROPIC_KEY),
      deleteSecret(KEYS.GITHUB_USER),
      deleteSecret(KEYS.REPO),
      deleteSecret(KEYS.BRANCH),
    ]);
    setPat(null);
    apiKeyRef.current = null;
    setApiKey(null);
    setGhUser(null);
    setManifest(null);
    manifestRef.current = null;
    // Stay in the app after signing out — credentials are requested again
    // just-in-time when a GitHub/AI action needs them.
    setStage('ready');
  }, []);

  // ── Repo ─────────────────────────────────────────────────────────────────

  const selectRepo = useCallback(async (m: Manifest) => {
    await setSecret(KEYS.REPO, m.repo);
    await setSecret(KEYS.BRANCH, m.branch);
    setManifest(m);
    manifestRef.current = m;
    setCurrentPath(null);
    setCurrentContentState(null);
    setOriginalContent(null);
  }, []);

  const clearRepo = useCallback(async () => {
    await deleteSecret(KEYS.REPO);
    await deleteSecret(KEYS.BRANCH);
    setManifest(null);
    manifestRef.current = null;
    setCurrentPath(null);
    setCurrentContentState(null);
    setOriginalContent(null);
  }, []);

  const refreshManifest = useCallback(async () => {
    if (!manifest) return;
    const m = await readManifest(manifest.repo);
    if (m) {
      setManifest(m);
      manifestRef.current = m;
    }
  }, [manifest]);

  // ── File editing ─────────────────────────────────────────────────────────

  const openFile = useCallback(async (path: string) => {
    if (!manifest) throw new Error('No repo loaded');
    // Throw on failure so callers can surface it. The previous version
    // swallowed the error and left currentPath null, which looked identical
    // to "the tap registered but did nothing."
    const content = await readText(repoDir(manifest.repo) + path);
    setCurrentPath(path);
    setCurrentContentState(content);
    setOriginalContent(content);
  }, [manifest]);

  const closeFile = useCallback(() => {
    setCurrentPath(null);
    setCurrentContentState(null);
    setOriginalContent(null);
  }, []);

  const setCurrentContent = useCallback((content: string) => {
    setCurrentContentState(content);
  }, []);

  const saveCurrentFile = useCallback(async () => {
    if (!manifest || !currentPath || currentContent === null) return;
    await writeText(repoDir(manifest.repo) + currentPath, currentContent);
    const existing = manifest.files[currentPath];
    const updated: Manifest = {
      ...manifest,
      files: {
        ...manifest.files,
        [currentPath]: existing
          ? { ...existing, modified: true }
          : { sha: null, modified: true },
      },
    };
    await writeManifest(updated);
    setManifest(updated);
    manifestRef.current = updated;
    setOriginalContent(currentContent);
  }, [manifest, currentPath, currentContent]);

  const pull = useCallback(async () => {
    if (!manifest || !pat) return { updated: 0, added: 0, unchanged: 0, conflicts: [] };
    setPulling(true);
    try {
      const r = await pullRepo(pat, manifest);
      setManifest({ ...r.manifest });
      manifestRef.current = r.manifest;
      return r;
    } finally {
      setPulling(false);
    }
  }, [manifest, pat]);

  const push = useCallback(async (message: string) => {
    if (!manifest || !pat) return { pushed: 0, failures: [] };
    setPushing(true);
    try {
      const r = await pushModifiedFiles(pat, manifest, message);
      setManifest({ ...r.manifest });
      manifestRef.current = r.manifest;
      return { pushed: r.pushed, failures: r.failures };
    } finally {
      setPushing(false);
    }
  }, [manifest, pat]);

  // ── Task management ──────────────────────────────────────────────────────

  // Updates active task in state, ref, and the index summary in storage.
  const updateActiveTask = useCallback((mutator: (t: Task) => Task) => {
    setActiveTask((prev) => {
      if (!prev) return prev;
      const next = mutator(prev);
      activeTaskRef.current = next;
      // Update index summary too so listings reflect the change.
      const idx = taskIndexRef.current;
      if (idx && manifestRef.current) {
        const newIndex = patchIndexEntry(idx, next);
        taskIndexRef.current = newIndex;
        setTaskIndex(newIndex);
        writeTaskIndex(manifestRef.current.repo, newIndex).catch(() => {});
      }
      return next;
    });
  }, []);

  const createTask = useCallback(async (title: string): Promise<Task> => {
    if (!manifest) throw new Error('no repo');
    const task = makeTask(title);
    await writeTask(manifest.repo, task);
    const baseIndex = taskIndexRef.current ?? {
      version: 1 as const, tasks: [], activeTaskId: null,
    };
    const newIndex = setActive(patchIndexEntry(baseIndex, task), task.id);
    await writeTaskIndex(manifest.repo, newIndex);
    setTaskIndex(newIndex);
    setActiveTask(task);
    taskIndexRef.current = newIndex;
    activeTaskRef.current = task;
    return task;
  }, [manifest]);

  const switchTask = useCallback(async (taskId: string) => {
    if (!manifest) return;
    if (taskId === activeTaskRef.current?.id) return;
    if (chatBusy) {
      // Don't switch tasks mid-agent-run; user-visible chat would jump.
      return;
    }
    const task = await readTask(manifest.repo, taskId);
    if (!task) return;
    const idx = taskIndexRef.current;
    if (idx) {
      const newIndex = setActive(idx, taskId);
      await writeTaskIndex(manifest.repo, newIndex);
      setTaskIndex(newIndex);
      taskIndexRef.current = newIndex;
    }
    setActiveTask(task);
    activeTaskRef.current = task;
  }, [manifest, chatBusy]);

  const renameTask = useCallback(async (taskId: string, title: string) => {
    if (!manifest) return;
    const trimmed = title.trim();
    if (!trimmed) return;
    if (activeTaskRef.current?.id === taskId) {
      updateActiveTask((t) => ({ ...t, title: trimmed, updatedAt: Date.now() }));
      return;
    }
    const task = await readTask(manifest.repo, taskId);
    if (!task) return;
    const next: Task = { ...task, title: trimmed, updatedAt: Date.now() };
    await writeTask(manifest.repo, next);
    const idx = taskIndexRef.current;
    if (idx) {
      const newIndex = patchIndexEntry(idx, next);
      await writeTaskIndex(manifest.repo, newIndex);
      setTaskIndex(newIndex);
      taskIndexRef.current = newIndex;
    }
  }, [manifest, updateActiveTask]);

  const archiveTask = useCallback(async (taskId: string, archived: boolean) => {
    if (!manifest) return;
    if (activeTaskRef.current?.id === taskId) {
      updateActiveTask((t) => ({ ...t, archived, updatedAt: Date.now() }));
      return;
    }
    const task = await readTask(manifest.repo, taskId);
    if (!task) return;
    const next: Task = { ...task, archived, updatedAt: Date.now() };
    await writeTask(manifest.repo, next);
    const idx = taskIndexRef.current;
    if (idx) {
      const newIndex = patchIndexEntry(idx, next);
      await writeTaskIndex(manifest.repo, newIndex);
      setTaskIndex(newIndex);
      taskIndexRef.current = newIndex;
    }
  }, [manifest, updateActiveTask]);

  const deleteTaskById = useCallback(async (taskId: string) => {
    if (!manifest) return;
    await fsDeleteTask(manifest.repo, taskId);
    const idx = taskIndexRef.current;
    if (idx) {
      const newIndex = removeFromIndex(idx, taskId);
      // If we just deleted the active task, pick another or create a fresh one.
      if (newIndex.activeTaskId === null) {
        const fallback = newIndex.tasks.find((t) => !t.archived) ?? newIndex.tasks[0];
        if (fallback) {
          newIndex.activeTaskId = fallback.id;
          const fallbackTask = await readTask(manifest.repo, fallback.id);
          if (fallbackTask) {
            setActiveTask(fallbackTask);
            activeTaskRef.current = fallbackTask;
          }
        } else {
          // No tasks left — bootstrap a new Scratch.
          const fresh = makeTask('Scratch');
          await writeTask(manifest.repo, fresh);
          newIndex.tasks.push(summarizeTask(fresh));
          newIndex.activeTaskId = fresh.id;
          setActiveTask(fresh);
          activeTaskRef.current = fresh;
        }
      }
      await writeTaskIndex(manifest.repo, newIndex);
      setTaskIndex(newIndex);
      taskIndexRef.current = newIndex;
    }
  }, [manifest]);

  const linkIssueToTask = useCallback(async (
    taskId: string, issue: LinkedIssue | null,
  ) => {
    if (!manifest) return;
    if (activeTaskRef.current?.id === taskId) {
      updateActiveTask((t) => ({ ...t, linkedIssue: issue, updatedAt: Date.now() }));
      return;
    }
    const task = await readTask(manifest.repo, taskId);
    if (!task) return;
    const next: Task = { ...task, linkedIssue: issue, updatedAt: Date.now() };
    await writeTask(manifest.repo, next);
    const idx = taskIndexRef.current;
    if (idx) {
      const newIndex = patchIndexEntry(idx, next);
      await writeTaskIndex(manifest.repo, newIndex);
      setTaskIndex(newIndex);
      taskIndexRef.current = newIndex;
    }
  }, [manifest, updateActiveTask]);

  // ── Agent / chat ─────────────────────────────────────────────────────────

  const handleAgentEvent = useCallback((e: AgentEvent) => {
    updateActiveTask((task) => {
      let turns = task.turns;
      if (e.kind === 'message') {
        const content = e.message.content;
        if (typeof content === 'string') {
          turns = [...turns, { kind: 'assistant', text: content }];
        } else {
          const text = content
            .filter((b): b is TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('\n');
          if (text) turns = [...turns, { kind: 'assistant', text }];
        }
      } else if (e.kind === 'tool_call') {
        turns = [...turns, { kind: 'tool', name: e.name, input: e.input }];
      } else if (e.kind === 'tool_result') {
        const copy = [...turns];
        for (let i = copy.length - 1; i >= 0; i--) {
          const turn = copy[i];
          if (turn.kind === 'tool' && turn.name === e.name && turn.result === undefined) {
            copy[i] = { ...turn, result: e.result, isError: e.is_error };
            break;
          }
        }
        turns = copy;
      } else if (e.kind === 'context_optimized') {
        turns = [...turns, { kind: 'note', text: e.note }];
      }
      return { ...task, turns, updatedAt: Date.now() };
    });
  }, [updateActiveTask]);

  const runWithCheckpoint = useCallback(async (
    fromHistory: ChatMessage[], isResume: boolean,
  ) => {
    const m = manifestRef.current;
    const t = activeTaskRef.current;
    const key = apiKeyRef.current;
    if (!m || !key || !t) return;
    cancelRef.current = { cancelled: false };
    setChatBusy(true);
    // Tracks whether we've already emitted a chat note for the current
    // retry sequence. Resets when onRetry fires with null (sequence ended).
    let retryNoteShownThisSequence = false;
    const onRetryWithNote = (status: RetryStatus) => {
      setRetry(status);
      if (!status) {
        retryNoteShownThisSequence = false;
        return;
      }
      if (retryNoteShownThisSequence) return;
      retryNoteShownThisSequence = true;
      const seconds = Math.max(1, Math.round(status.delayMs / 1000));
      updateActiveTask((task) => ({
        ...task,
        turns: [...task.turns, {
          kind: 'note',
          text: `transient error, retrying in ${seconds}s — ${status.error}`,
        }],
        updatedAt: Date.now(),
      }));
    };
    try {
      const finalHistory = await runAgent({
        apiKey: key,
        pat,
        initialHistory: fromHistory,
        manifest: m,
        linkedIssue: t.linkedIssue,
        onEvent: handleAgentEvent,
        onManifestUpdate: (newManifest) => {
          manifestRef.current = newManifest;
          setManifest(newManifest);
        },
        onRetry: onRetryWithNote,
        onCheckpoint: async (msgs) => {
          await savePending(m.repo, {
            history: msgs,
            startedAt: Date.now(),
            taskId: activeTaskRef.current?.id,
          });
        },
        onComplete: async () => {
          await clearPending(m.repo);
        },
        signal: cancelRef.current,
      });
      // Persist the final history into whichever task is now active. It's
      // safe to assume the same task is active since switching is blocked
      // while chatBusy is true.
      updateActiveTask((task) => ({
        ...task, history: finalHistory, updatedAt: Date.now(),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed';
      const detail = e instanceof Error ? e.stack : undefined;
      const prefix = isResume ? 'Resume failed: ' : '! ';
      pushError('agent', prefix + msg, { detail });
      updateActiveTask((task) => ({
        ...task,
        turns: [...task.turns, { kind: 'assistant', text: prefix + msg }],
        updatedAt: Date.now(),
      }));
    } finally {
      setChatBusy(false);
      setRetry(null);
      setResumeNotice(null);
      // Force-flush the debounced task write so the final agent state is
      // durable before the user can navigate away or kick off a new turn.
      flushPendingTaskWrite();
    }
  }, [pat, handleAgentEvent, updateActiveTask, flushPendingTaskWrite]);

  const send = useCallback(async (text: string, images?: AttachedImage[]) => {
    const trimmed = text.trim();
    const hasImages = !!images && images.length > 0;
    if ((!trimmed && !hasImages) || chatBusy) return;
    const t = activeTaskRef.current;
    if (!t) return;

    // When images are attached, the user message becomes a content-block
    // array (Anthropic's multimodal format). Image blocks come first because
    // the model handles them better at the start of a turn; the text block
    // (if any) follows. Without images, keep the legacy string-content shape
    // so plain-text history is unchanged on disk.
    let userContent: ChatMessage['content'];
    if (hasImages) {
      const blocks: ContentBlock[] = images!.map((img) => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: img.mediaType,
          data: img.base64,
        },
      }));
      if (trimmed) blocks.push({ type: 'text' as const, text: trimmed });
      userContent = blocks;
    } else {
      userContent = trimmed;
    }

    const newHistory: ChatMessage[] = [
      ...t.history,
      { role: 'user', content: userContent },
    ];
    // Render a placeholder for images-only turns so the chat doesn't show an
    // empty bubble. The full image data lives in `history`; `turns` is for UI.
    const turnText = trimmed
      || (hasImages ? `📎 ${images!.length} image${images!.length === 1 ? '' : 's'}` : '');
    updateActiveTask((task) => ({
      ...task,
      turns: [...task.turns, { kind: 'user', text: turnText }],
      history: newHistory,
      updatedAt: Date.now(),
    }));

    // Standalone (on-device) agent requires an Anthropic key. Callers should
    // prompt for one (requestApiKey) before sending, but as a safety net — if
    // send() is reached without a key — post an actionable note rather than
    // silently doing nothing. The typed message stays in history for later.
    if (!apiKeyRef.current) {
      updateActiveTask((task) => ({
        ...task,
        turns: [...task.turns, {
          kind: 'note',
          text: 'No Anthropic API key set — the on-device agent is disabled. Add a key to run it here, or pair a desktop from the Run tab to work in tunnel mode.',
        }],
        updatedAt: Date.now(),
      }));
      return;
    }
    await runWithCheckpoint(newHistory, false);
  }, [chatBusy, runWithCheckpoint, updateActiveTask]);

  const cancelChat = useCallback(() => {
    cancelRef.current.cancelled = true;
  }, []);

  const clearChat = useCallback(async () => {
    if (!manifest) return;
    await clearPending(manifest.repo);
    updateActiveTask((task) => ({
      ...task, turns: [], history: [], updatedAt: Date.now(),
    }));
  }, [manifest, updateActiveTask]);

  const value: SessionValue = {
    stage,
    pat,
    apiKey,
    ghUser,
    manifest,
    modifiedCount,

    saveAuth,
    saveApiKey,
    resetAuth,
    selectRepo,
    clearRepo,
    refreshManifest,

    currentPath,
    openFile,
    closeFile,
    currentContent,
    setCurrentContent,
    saveCurrentFile,
    isCurrentDirty,

    pulling,
    pushing,
    pull,
    push,

    taskSummaries: taskIndex?.tasks ?? [],
    activeTask,
    createTask,
    switchTask,
    renameTask,
    archiveTask,
    deleteTaskById,
    linkIssueToTask,

    turns: activeTask?.turns ?? [],
    chatBusy,
    retry,
    resumeNotice,
    send,
    cancelChat,
    clearChat,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
