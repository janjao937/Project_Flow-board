"use client";

import { create } from "zustand";
import type { WorkflowManifest } from "@/shared/packages/flowpkg";
import type { BoardState, PlanState, RoadmapState, TasksState, WorkflowDocumentData } from "../domain/document-data";
import { createEmptyBoard } from "../domain/document-data";
import { createNewWorkflow, packWorkflow, unpackWorkflow } from "../application/workflow-io";
import {
  downloadBytes,
  pickOpenFlowPackage,
  pickSaveFlowPackage,
  writeToHandle,
  type FlowFileHandle,
} from "../infrastructure/file-system";
import { rememberRecent } from "../infrastructure/recent";
import { useSessionStore } from "@/features/join/store/session-store";
import { normalizeBoard } from "@/features/board/lib/normalize-board";
import { renderBoardPreviewPng } from "@/features/board/lib/export-board";
import { EMPTY_ROADMAP } from "@/features/roadmap/lib/normalize";

async function buildPreview(data: WorkflowDocumentData): Promise<Uint8Array | undefined> {
  const board = Object.values(data.boards)[0];
  if (!board) {
    return undefined;
  }
  try {
    return await renderBoardPreviewPng(normalizeBoard(board));
  } catch {
    return undefined;
  }
}

interface HistoryEntry {
  data: WorkflowDocumentData;
}

interface WorkflowStore {
  manifest: WorkflowManifest | null;
  data: WorkflowDocumentData | null;
  activePageId: string | null;
  fileHandle: FlowFileHandle | null;
  fileName: string | null;
  dirty: boolean;
  past: HistoryEntry[];
  future: HistoryEntry[];
  newWorkflow: (name: string) => void;
  openFromDisk: () => Promise<void>;
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
  setActivePage: (pageId: string) => void;
  updateBoard: (pageId: string, updater: (board: BoardState) => BoardState) => void;
  updateTasks: (pageId: string, updater: (tasks: TasksState) => TasksState) => void;
  updateRoadmap: (pageId: string, updater: (roadmap: RoadmapState) => RoadmapState) => void;
  updatePlan: (pageId: string, updater: (plan: PlanState) => PlanState) => void;
  applyRemote: (manifest: WorkflowManifest, data: WorkflowDocumentData) => void;
  undo: () => void;
  redo: () => void;
  getActiveBoard: () => BoardState | null;
  getActiveTasks: () => TasksState | null;
}

function cloneData(data: WorkflowDocumentData): WorkflowDocumentData {
  return structuredClone(data);
}

function pushHistory(state: WorkflowStore): Pick<WorkflowStore, "past" | "future"> {
  if (!state.data) {
    return { past: state.past, future: state.future };
  }
  return {
    past: [...state.past, { data: cloneData(state.data) }].slice(-50),
    future: [],
  };
}

function assertCanEdit(): boolean {
  const session = useSessionStore.getState();
  if (!session.sessionId) {
    return true;
  }
  return session.canEdit;
}

function assertCanSave(): boolean {
  const session = useSessionStore.getState();
  if (!session.sessionId) {
    return true;
  }
  return session.role === "host";
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  manifest: null,
  data: null,
  activePageId: null,
  fileHandle: null,
  fileName: null,
  dirty: false,
  past: [],
  future: [],

  newWorkflow: (name) => {
    const created = createNewWorkflow(name);
    set({
      manifest: created.manifest,
      data: created.data,
      activePageId: created.manifest.pages[0]?.id ?? null,
      fileHandle: null,
      fileName: null,
      dirty: true,
      past: [],
      future: [],
    });
  },

  openFromDisk: async () => {
    const picked = await pickOpenFlowPackage();
    const opened = await unpackWorkflow(picked.bytes);
    set({
      manifest: opened.manifest,
      data: opened.data,
      activePageId: opened.manifest.pages[0]?.id ?? null,
      fileHandle: picked.handle,
      fileName: picked.name,
      dirty: false,
      past: [],
      future: [],
    });
    rememberRecent({ id: opened.manifest.id, name: opened.manifest.name, openedAt: Date.now() });
  },

  save: async () => {
    const state = get();
    if (!state.manifest || !state.data || !assertCanSave()) {
      return;
    }
    const preview = await buildPreview(state.data);
    const bytes = await packWorkflow(state.manifest, state.data, preview);
    const name = state.fileName ?? `${state.manifest.name}.flowpkg`;
    if (state.fileHandle) {
      await writeToHandle(state.fileHandle, bytes);
    } else {
      const handle = await pickSaveFlowPackage(name);
      if (handle) {
        await writeToHandle(handle, bytes);
        set({ fileHandle: handle, fileName: handle.name });
      } else {
        downloadBytes(bytes, name);
      }
    }
    set({
      dirty: false,
      manifest: { ...state.manifest, updatedAt: new Date().toISOString() },
    });
    rememberRecent({ id: state.manifest.id, name: state.manifest.name, openedAt: Date.now() });
  },

  saveAs: async () => {
    const state = get();
    if (!state.manifest || !state.data || !assertCanSave()) {
      return;
    }
    const preview = await buildPreview(state.data);
    const bytes = await packWorkflow(state.manifest, state.data, preview);
    const suggested = `${state.manifest.name}.flowpkg`;
    const handle = await pickSaveFlowPackage(suggested);
    if (handle) {
      await writeToHandle(handle, bytes);
      set({
        fileHandle: handle,
        fileName: handle.name,
        dirty: false,
        manifest: { ...state.manifest, updatedAt: new Date().toISOString() },
      });
    } else {
      downloadBytes(bytes, suggested);
      set({ dirty: false });
    }
    rememberRecent({ id: state.manifest.id, name: state.manifest.name, openedAt: Date.now() });
  },

  setActivePage: (pageId) => set({ activePageId: pageId }),

  updateBoard: (pageId, updater) => {
    const state = get();
    if (!state.data || !assertCanEdit()) {
      return;
    }
    const history = pushHistory(state);
    const current = state.data.boards[pageId] ?? createEmptyBoard();
    set({
      ...history,
      dirty: true,
      data: {
        ...state.data,
        boards: {
          ...state.data.boards,
          [pageId]: updater(current),
        },
      },
    });
  },

  updateTasks: (pageId, updater) => {
    const state = get();
    if (!state.data || !assertCanEdit()) {
      return;
    }
    const history = pushHistory(state);
    const current = state.data.tasks[pageId] ?? { lists: [], cards: {}, labels: [] };
    set({
      ...history,
      dirty: true,
      data: {
        ...state.data,
        tasks: {
          ...state.data.tasks,
          [pageId]: updater(current),
        },
      },
    });
  },

  updateRoadmap: (pageId, updater) => {
    const state = get();
    if (!state.data || !assertCanEdit()) {
      return;
    }
    const history = pushHistory(state);
    const current = state.data.roadmaps[pageId] ?? EMPTY_ROADMAP;
    set({
      ...history,
      dirty: true,
      data: {
        ...state.data,
        roadmaps: {
          ...state.data.roadmaps,
          [pageId]: updater(current),
        },
      },
    });
  },

  updatePlan: (pageId, updater) => {
    const state = get();
    if (!state.data || !assertCanEdit()) {
      return;
    }
    const history = pushHistory(state);
    const current = state.data.plans[pageId] ?? { boxes: [] };
    set({
      ...history,
      dirty: true,
      data: {
        ...state.data,
        plans: {
          ...state.data.plans,
          [pageId]: updater(current),
        },
      },
    });
  },

  applyRemote: (manifest, data) => {
    const state = get();
    set({
      manifest,
      data,
      activePageId: state.activePageId ?? manifest.pages[0]?.id ?? null,
      dirty: false,
      past: [],
      future: [],
    });
  },

  undo: () => {
    if (!assertCanEdit()) {
      return;
    }
    const state = get();
    if (!state.data || state.past.length === 0) {
      return;
    }
    const previous = state.past[state.past.length - 1];
    if (!previous) {
      return;
    }
    set({
      past: state.past.slice(0, -1),
      future: [{ data: cloneData(state.data) }, ...state.future],
      data: previous.data,
      dirty: true,
    });
  },

  redo: () => {
    if (!assertCanEdit()) {
      return;
    }
    const state = get();
    if (!state.data || state.future.length === 0) {
      return;
    }
    const next = state.future[0];
    if (!next) {
      return;
    }
    set({
      future: state.future.slice(1),
      past: [...state.past, { data: cloneData(state.data) }],
      data: next.data,
      dirty: true,
    });
  },

  getActiveBoard: () => {
    const state = get();
    if (!state.data || !state.activePageId) {
      return null;
    }
    return state.data.boards[state.activePageId] ?? null;
  },

  getActiveTasks: () => {
    const state = get();
    if (!state.data || !state.activePageId) {
      return null;
    }
    return state.data.tasks[state.activePageId] ?? null;
  },
}));
