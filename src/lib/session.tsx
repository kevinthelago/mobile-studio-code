import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ChatMessage, ChatTurn, Manifest, RetryStatus, CancelSignal, TextBlock,
  Task, TaskSummary, TaskIndex, LinkedIssue, AttachedImage, ImageBlock,
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
import { pullRepo, pushModifiedFiles } from './github';

type Stage = 'loading' | 'setup' | 'repo' | 'ready';

type SessionValue = {
  stage: Stage;
  pat: string | null;
  apiKey: string | null;
  ghUser: string | null;
  manifest: Manifest | null;
  modifiedCount: number;

  // Auth + repo actions
  saveAuth: (pat: string, apiKey: string, ghUser: string) => Promise<void>;
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
  push: (message: string) => Promise<{ pushed: number }>;

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
  const [savedContent, setSavedContent] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);

  const [taskSummaries, setTaskSummaries] = useState<TaskSummary[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const activeTaskRef = useRef<Task | null>(null);

  const [chatBusy, setChatBusy] = useState(false);
  const [retry, setRetry] = useState<RetryStatus>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);

  const cancelRef = useRef<CancelSignal>({ cancelled: false });

  const modifiedCount = useMemo(() => {
    if (!manifest) return 0;
    return Object.values(manifest.files).filter((f) => f.modified).length;
  }, [manifest]);

  const isCurrentDirty = useMemo(() => {
    if (currentContent === null || savedContent === null) return false;
    return currentContent !== savedContent;
  }, [currentContent, savedContent]);

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const storedPat = await getSecret(KEYS.PAT);
      const storedKey = await getSecret(KEYS.ANTHROPIC_KEY);
      const storedUser = await getSecret(KEYS.GH_USER);
      if (!storedPat || !storedKey) { setStage('setup'); return; }
      setPat(storedPat);
      setApiKey(storedKey);
      setGhUser(storedUser);
      const m = await readManifest();
      if (!m) { setStage('repo'); return; }
      setManifest(m);
      setStage('ready');
    })();
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const saveAuth = useCallback(async (p: string, k: string, u: string) => {
    await setSecret(KEYS.PAT, p);
    await setSecret(KEYS.ANTHROPIC_KEY, k);
    await setSecret(KEYS.GH_USER, u);
    setPat(p); setApiKey(k); setGhUser(u);
    const m = await readManifest();
    if (m) { setManifest(m); setStage('ready'); }
    else setStage('repo');
  }, []);

  const resetAuth = useCallback(async () => {
    await deleteSecret(KEYS.PAT);
    await deleteSecret(KEYS.ANTHROPIC_KEY);
    await deleteSecret(KEYS.GH_USER);
    setPat(null); setApiKey(null); setGhUser(null);
    setManifest(null); setStage('setup');
  }, []);

  // ── Repo ──────────────────────────────────────────────────────────────────
  const selectRepo = useCallback(async (m: Manifest) => {
    setManifest(m);
    // Bootstrap tasks for this repo.
    const { tasks, active } = await bootstrapTasks(m.repo);
    setTaskSummaries(tasks);
    if (active) {
      activeTaskRef.current = active;
      setActiveTask(active);
    }
    setStage('ready');
  }, []);

  const clearRepo = useCallback(async () => {
    setManifest(null);
    setCurrentPath(null);
    setCurrentContentState(null);
    setSavedContent(null);
    setTaskSummaries([]);
    setActiveTask(null);
    activeTaskRef.current = null;
    setStage('repo');
  }, []);

  const refreshManifest = useCallback(async () => {
    const m = await readManifest();
    if (m) setManifest(m);
  }, []);

  // ── Tasks (boot) ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'ready' || !manifest) return;
    (async () => {
      const { tasks, active } = await bootstrapTasks(manifest.repo);
      setTaskSummaries(tasks);
      if (active) {
        activeTaskRef.current = active;
        setActiveTask(active);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const updateActiveTask = useCallback((updater: (t: Task) => Task) => {
    setActiveTask((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      activeTaskRef.current = next;
      writeTask(manifest!.repo, next).catch(console.error);
      patchIndexEntry(manifest!.repo, next).catch(console.error);
      return next;
    });
  }, [manifest]);

  const createTask = useCallback(async (title: string): Promise<Task> => {
    if (!manifest) throw new Error('No repo');
    const task = makeTask(title);
    await writeTask(manifest.repo, task);
    const summary = summarizeTask(task);
    setTaskSummaries((prev) => {
      const updated = [summary, ...prev];
      setActive(manifest.repo, task.id, updated).catch(console.error);
      writeTaskIndex(manifest.repo, {
        version: 1,
        tasks: updated,
        activeTaskId: task.id,
      }).catch(console.error);
      return updated;
    });
    activeTaskRef.current = task;
    setActiveTask(task);
    return task;
  }, [manifest]);

  const switchTask = useCallback(async (taskId: string) => {
    if (!manifest) return;
    const task = await readTask(manifest.repo, taskId);
    if (!task) return;
    await setActive(manifest.repo, taskId, taskSummaries);
    activeTaskRef.current = task;
    setActiveTask(task);
    setTaskSummaries((prev) => {
      const updated = prev.map((s) => ({ ...s }));
      writeTaskIndex(manifest.repo, {
        version: 1,
        tasks: updated,
        activeTaskId: taskId,
      }).catch(console.error);
      return updated;
    });
  }, [manifest, taskSummaries]);

  const renameTask = useCallback(async (taskId: string, title: string) => {
    if (!manifest) return;
    const task = await readTask(manifest.repo, taskId);
    if (!task) return;
    const updated = { ...task, title, updatedAt: Date.now() };
    await writeTask(manifest.repo, updated);
    await patchIndexEntry(manifest.repo, updated);
    setTaskSummaries((prev) => prev.map((s) => s.id === taskId ? { ...s, title } : s));
    if (activeTaskRef.current?.id === taskId) {
      activeTaskRef.current = updated;
      setActiveTask(updated);
    }
  }, [manifest]);

  const archiveTask = useCallback(async (taskId: string, archived: boolean) => {
    if (!manifest) return;
    const task = await readTask(manifest.repo, taskId);
    if (!task) return;
    const updated = { ...task, archived, updatedAt: Date.now() };
    await writeTask(manifest.repo, updated);
    await patchIndexEntry(manifest.repo, updated);
    setTaskSummaries((prev) => prev.map((s) => s.id === taskId ? { ...s, archived } : s));
    if (activeTaskRef.current?.id === taskId) {
      activeTaskRef.current = updated;
      setActiveTask(updated);
    }
  }, [manifest]);

  const deleteTaskById = useCallback(async (taskId: string) => {
    if (!manifest) return;
    await fsDeleteTask(manifest.repo, taskId);
    await removeFromIndex(manifest.repo, taskId);
    setTaskSummaries((prev) => prev.filter((s) => s.id !== taskId));
    if (activeTaskRef.current?.id === taskId) {
      activeTaskRef.current = null;
      setActiveTask(null);
    }
  }, [manifest]);

  const linkIssueToTask = useCallback(async (
    taskId: string, issue: LinkedIssue | null,
  ) => {
    if (!manifest) return;
    const task = await readTask(manifest.repo, taskId);
    if (!task) return;
    const updated = { ...task, linkedIssue: issue, updatedAt: Date.now() };
    await writeTask(manifest.repo, updated);
    await patchIndexEntry(manifest.repo, updated);
    setTaskSummaries((prev) => prev.map((s) =>
      s.id === taskId ? { ...s, linkedIssue: issue } : s,
    ));
    if (activeTaskRef.current?.id === taskId) {
      activeTaskRef.current = updated;
      setActiveTask(updated);
    }
  }, [manifest]);

  // ── Files ─────────────────────────────────────────────────────────────────
  const openFile = useCallback(async (path: string) => {
    if (!manifest) return;
    const dir = repoDir(manifest.repo);
    const content = await readText(`${dir}/${path}`);
    setCurrentPath(path);
    setCurrentContentState(content ?? '');
    setSavedContent(content ?? '');
  }, [manifest]);

  const closeFile = useCallback(() => {
    setCurrentPath(null);
    setCurrentContentState(null);
    setSavedContent(null);
  }, []);

  const setCurrentContent = useCallback((content: string) => {
    setCurrentContentState(content);
  }, []);

  const saveCurrentFile = useCallback(async () => {
    if (!manifest || !currentPath || currentContent === null) return;
    const dir = repoDir(manifest.repo);
    await writeText(`${dir}/${currentPath}`, currentContent);
    setSavedContent(currentContent);
    // Mark as modified in manifest
    const updated: Manifest = {
      ...manifest,
      files: {
        ...manifest.files,
        [currentPath]: {
          sha: manifest.files[currentPath]?.sha ?? null,
          modified: true,
        },
      },
    };
    await writeManifest(updated);
    setManifest(updated);
  }, [manifest, currentPath, currentContent]);

  // ── Pull / Push ───────────────────────────────────────────────────────────
  const pull = useCallback(async () => {
    if (!manifest || !pat) throw new Error('Not ready');
    setPulling(true);
    try {
      const result = await pullRepo(pat, manifest, (updated) => {
        setManifest(updated);
      });
      return result;
    } finally {
      setPulling(false);
    }
  }, [manifest, pat]);

  const push = useCallback(async (message: string) => {
    if (!manifest || !pat) throw new Error('Not ready');
    setPushing(true);
    try {
      const result = await pushModifiedFiles(pat, manifest, message, (updated) => {
        setManifest(updated);
      });
      return result;
    } finally {
      setPushing(false);
    }
  }, [manifest, pat]);

  // ── Agent / Chat ──────────────────────────────────────────────────────────
  const handleAgentEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case 'turn': {
        updateActiveTask((task) => ({
          ...task,
          turns: [...task.turns, event.turn],
          updatedAt: Date.now(),
        }));
        break;
      }
      case 'turn_update': {
        updateActiveTask((task) => {
          const turns = [...task.turns];
          for (let i = turns.length - 1; i >= 0; i--) {
            const t = turns[i];
            if (t.kind === 'tool' && t.name === event.name && t.result === undefined) {
              turns[i] = { ...t, result: event.result, isError: event.isError };
              break;
            }
          }
          return { ...task, turns, updatedAt: Date.now() };
        });
        break;
      }
      case 'history_update': {
        updateActiveTask((task) => ({
          ...task,
          history: event.history,
          updatedAt: Date.now(),
        }));
        break;
      }
      case 'retry': {
        setRetry(event.status);
        break;
      }
    }
  }, [updateActiveTask]);

  const runWithCheckpoint = useCallback(async (
    history: ChatMessage[],
    isResume: boolean,
  ) => {
    if (!manifest || !apiKey) return;
    const taskId = activeTaskRef.current?.id ?? 'unknown';
    cancelRef.current = { cancelled: false };
    setChatBusy(true);
    setRetry(null);
    if (isResume) setResumeNotice('Resuming…');
    try {
      await runAgent({
        apiKey,
        manifest,
        history,
        taskId,
        linkedIssue: activeTaskRef.current?.linkedIssue ?? null,
        onEvent: handleAgentEvent,
        cancel: cancelRef.current,
        onSaveCheckpoint: async (h) => {
          await savePending(manifest.repo, { history: h, startedAt: Date.now(), taskId });
        },
      });
      await clearPending(manifest.repo);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      updateActiveTask((task) => ({
        ...task,
        turns: [...task.turns, { kind: 'note', text: `Error: ${msg}` }],
        updatedAt: Date.now(),
      }));
    } finally {
      setChatBusy(false);
      setRetry(null);
      setResumeNotice(null);
    }
  }, [apiKey, manifest, handleAgentEvent, updateActiveTask]);

  const send = useCallback(async (text: string, images?: AttachedImage[]) => {
    const trimmed = text.trim();
    if ((!trimmed && (!images || images.length === 0)) || chatBusy) return;
    const t = activeTaskRef.current;
    if (!t) return;

    // Build the content array for the API message
    const contentBlocks: Array<import('./types').ContentBlock> = [];

    // Attach images first (Claude handles them better at the start of a turn)
    if (images && images.length > 0) {
      for (const img of images) {
        contentBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
        } as ImageBlock);
      }
    }

    if (trimmed) {
      contentBlocks.push({ type: 'text', text: trimmed } as TextBlock);
    }

    const newHistory: ChatMessage[] = [
      ...t.history,
      {
        role: 'user',
        content: contentBlocks.length === 1 && contentBlocks[0].type === 'text'
          ? trimmed  // keep as string when text-only for backward compat
          : contentBlocks,
      },
    ];

    const userTurn: ChatTurn = {
      kind: 'user',
      text: trimmed || (images && images.length > 0 ? `[${images.length} image(s)]` : ''),
      images,
    };

    updateActiveTask((task) => ({
      ...task,
      turns: [...task.turns, userTurn],
      history: newHistory,
      updatedAt: Date.now(),
    }));
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

    taskSummaries,
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
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}
