import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import type { Blueprint } from './core';
import {
  createPlanProject, summarizeProject, upsertSummary, removeSummary,
  type PlanProject, type PlanProjectSummary,
} from './project';
import {
  saveProjectFile, loadProjectFile, deleteProjectDir,
  readIndex, writeIndex, listProjectIds,
} from './persistence';
import { appendUserMessage, applyAssistantReply } from './apply';
import { plannerReply } from './driver';
import { registerBuiltinPipelines } from './pipelineHandlers';
import { registerBuiltinPipelineModules } from './pipelineModules';
import { runProjectPipeline, firePipelinesForTrigger, newlyCompleteSections } from './pipelines';
import { applyPipelineTags } from './commandBus';
import { KEYS, getSecret } from '../storage';

export interface PlannerValue {
  /** True until the on-disk index has loaded. */
  loading: boolean;
  /** Listing summaries, most-recent first. */
  summaries: PlanProjectSummary[];
  /** The currently open project, or null on the home/picker screen. */
  active: PlanProject | null;
  createProject: (blueprint: Blueprint, title?: string) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  closeProject: () => void;
  deleteProject: (id: string) => Promise<void>;
  /** Apply a change to the active project; bumps updatedAt and persists. */
  updateActive: (mutator: (p: PlanProject) => PlanProject) => void;
  /** True while a planner turn is in flight. */
  sending: boolean;
  /** Send a user message to the planner; applies the reply's tags + persists. */
  sendMessage: (text: string) => Promise<void>;
  /** Manually run a section's pipeline (lint-plan / grade-plan / …). */
  runSectionPipeline: (sectionKey: string, pipelineUid: string) => Promise<void>;
}

const PlannerContext = createContext<PlannerValue | null>(null);

export function usePlanner(): PlannerValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error('usePlanner must be used inside PlannerProvider');
  return ctx;
}

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<PlanProjectSummary[]>([]);
  const [active, setActive] = useState<PlanProject | null>(null);
  const [sending, setSending] = useState(false);
  // Latest active project for async handlers that must not close over stale state.
  const activeRef = useRef<PlanProject | null>(null);
  activeRef.current = active;

  // Register the builtin pipeline handlers + Claude-driven command modules once.
  useEffect(() => {
    registerBuiltinPipelines();
    registerBuiltinPipelineModules();
  }, []);

  // Bootstrap from the on-disk index; rebuild it from project files if missing.
  useEffect(() => {
    (async () => {
      try {
        let idx = await readIndex();
        if (idx.length === 0) {
          const ids = await listProjectIds();
          const loaded = (await Promise.all(ids.map((id) => loadProjectFile(id))))
            .filter((p): p is PlanProject => p !== null);
          idx = loaded.map(summarizeProject).sort((a, b) => b.updatedAt - a.updatedAt);
          if (idx.length) await writeIndex(idx);
        }
        setSummaries(idx);
      } catch {
        /* start empty on any read error */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Write a project to disk and refresh its index summary.
  const persist = useCallback(async (project: PlanProject) => {
    await saveProjectFile(project);
    setSummaries((list) => {
      const next = upsertSummary(list, summarizeProject(project));
      writeIndex(next).catch(() => {});
      return next;
    });
  }, []);

  const createProject = useCallback(async (blueprint: Blueprint, title?: string) => {
    const now = Date.now();
    const project = createPlanProject(blueprint, {
      id: `proj-${now}`,
      title: title?.trim() || blueprint.name,
      now,
    });
    setActive(project);
    await persist(project);
  }, [persist]);

  const openProject = useCallback(async (id: string) => {
    const p = await loadProjectFile(id);
    if (p) setActive(p);
  }, []);

  const closeProject = useCallback(() => setActive(null), []);

  const deleteProject = useCallback(async (id: string) => {
    await deleteProjectDir(id);
    setSummaries((list) => {
      const next = removeSummary(list, id);
      writeIndex(next).catch(() => {});
      return next;
    });
    setActive((cur) => (cur && cur.id === id ? null : cur));
  }, []);

  const updateActive = useCallback((mutator: (p: PlanProject) => PlanProject) => {
    setActive((cur) => {
      if (!cur) return cur;
      const next: PlanProject = { ...mutator(cur), updatedAt: Date.now() };
      void persist(next);
      return next;
    });
  }, [persist]);

  const sendMessage = useCallback(async (text: string) => {
    const cur = activeRef.current;
    if (!cur || !text.trim() || sending) return;
    // Optimistically show the user's message, then call the planner.
    const withUser = appendUserMessage(cur, text.trim());
    setActive(withUser);
    setSending(true);
    try {
      const apiKey = await getSecret(KEYS.ANTHROPIC_KEY);
      if (!apiKey) throw new Error('Add an Anthropic API key in Settings to use the planner.');
      const reply = await plannerReply(withUser, apiKey);
      const applied = applyAssistantReply(withUser, reply).project;
      // Run any pipelines Claude drove via <pipeline cmd> tags.
      const piped = await applyPipelineTags(applied, reply);
      // Fire "on completion" pipelines for sections that just became complete.
      const newly = newlyCompleteSections(cur, piped);
      const fired = newly.length
        ? await firePipelinesForTrigger(piped, newly, 'on completion').catch(() => piped)
        : piped;
      const next: PlanProject = { ...fired, updatedAt: Date.now() };
      setActive(next);
      await persist(next);
    } catch (e) {
      // Surface the failure as a chat line so the user sees what happened.
      const msg = (e as Error)?.message ?? String(e);
      const errd: PlanProject = {
        ...withUser,
        messages: [...withUser.messages, { role: 'assistant', text: `⚠️ ${msg}` }],
        updatedAt: Date.now(),
      };
      setActive(errd);
      persist(errd).catch(() => {});
    } finally {
      setSending(false);
    }
  }, [persist, sending]);

  const runSectionPipeline = useCallback(async (sectionKey: string, pipelineUid: string) => {
    const cur = activeRef.current;
    if (!cur) return;
    const section = cur.blueprint.sections.find((s) => s.key === sectionKey);
    const pipeline = section?.pipelines.find((p) => p.uid === pipelineUid);
    if (!pipeline) return;
    // Optimistic running state.
    const running: PlanProject = {
      ...cur,
      pipelineRuns: {
        ...cur.pipelineRuns,
        [pipelineUid]: { status: 'running', lastRun: cur.pipelineRuns[pipelineUid]?.lastRun ?? null },
      },
    };
    setActive(running);
    try {
      const ran = await runProjectPipeline(running, sectionKey, pipeline, 'manual');
      const next: PlanProject = { ...ran, updatedAt: Date.now() };
      setActive(next);
      await persist(next);
    } catch {
      /* leave the running state; a retry will overwrite it */
    }
  }, [persist]);

  const value: PlannerValue = {
    loading, summaries, active,
    createProject, openProject, closeProject, deleteProject, updateActive,
    sending, sendMessage, runSectionPipeline,
  };
  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}
