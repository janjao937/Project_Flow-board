"use client";

import { create } from "zustand";
import { apiFetch } from "@/shared/api-client/api-client";
import type { WorkflowManifest } from "@/shared/packages/flowpkg";
import type { WorkflowDocumentData } from "@/features/workflow/domain/document-data";

export type SessionRole = "host" | "guest";

export interface SessionParticipant {
  participantId: string;
  displayName: string;
  role: SessionRole;
  pageId: string | null;
  cursor: { x: number; y: number } | null;
}

interface CreateSessionResponse {
  sessionId: string;
  joinCode: string;
  guestsCanEdit: boolean;
  token: string;
  role: SessionRole;
  participantId: string;
  canEdit: boolean;
}

interface JoinSessionResponse {
  sessionId: string;
  workflowId: string;
  workflowName: string;
  guestsCanEdit: boolean;
  token: string;
  role: SessionRole;
  participantId: string;
  canEdit: boolean;
  snapshot: { manifest: WorkflowManifest; data: WorkflowDocumentData } | null;
}

interface SessionState {
  sessionId: string | null;
  joinCode: string | null;
  token: string | null;
  role: SessionRole | null;
  participantId: string | null;
  displayName: string | null;
  canEdit: boolean;
  guestsCanEdit: boolean;
  participants: SessionParticipant[];
  endedReason: "host_left" | "host_ended" | null;
  revision: number;
  startHostSession: (input: {
    displayName: string;
    guestsCanEdit: boolean;
    manifest: WorkflowManifest;
    data: WorkflowDocumentData;
  }) => Promise<void>;
  joinSession: (code: string, displayName: string) => Promise<JoinSessionResponse>;
  setGuestsCanEdit: (value: boolean) => Promise<void>;
  endSession: () => Promise<void>;
  heartbeat: () => Promise<void>;
  setParticipants: (participants: SessionParticipant[]) => void;
  setGuestsCanEditLocal: (value: boolean) => void;
  setEndedReason: (reason: "host_left" | "host_ended" | null) => void;
  bumpRevision: () => number;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  joinCode: null,
  token: null,
  role: null,
  participantId: null,
  displayName: null,
  canEdit: true,
  guestsCanEdit: false,
  participants: [],
  endedReason: null,
  revision: 0,

  startHostSession: async ({ displayName, guestsCanEdit, manifest, data }) => {
    const response = await apiFetch<CreateSessionResponse>("/sessions", {
      method: "POST",
      body: JSON.stringify({
        workflowId: manifest.id,
        workflowName: manifest.name,
        displayName,
        guestsCanEdit,
        snapshot: { manifest, data },
      }),
    });
    set({
      sessionId: response.sessionId,
      joinCode: response.joinCode,
      token: response.token,
      role: "host",
      participantId: response.participantId,
      displayName,
      canEdit: true,
      guestsCanEdit: response.guestsCanEdit,
      endedReason: null,
      revision: 0,
    });
  },

  joinSession: async (code, displayName) => {
    const response = await apiFetch<JoinSessionResponse>("/sessions/join", {
      method: "POST",
      body: JSON.stringify({ code, displayName }),
    });
    set({
      sessionId: response.sessionId,
      joinCode: code.toUpperCase(),
      token: response.token,
      role: "guest",
      participantId: response.participantId,
      displayName,
      canEdit: response.canEdit,
      guestsCanEdit: response.guestsCanEdit,
      endedReason: null,
      revision: 0,
    });
    return response;
  },

  setGuestsCanEdit: async (value) => {
    const state = get();
    if (!state.sessionId || !state.token || state.role !== "host") {
      return;
    }
    await apiFetch(`/sessions/${state.sessionId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ guestsCanEdit: value }),
    });
    set({
      guestsCanEdit: value,
      canEdit: state.role === "host" ? true : value,
    });
  },

  endSession: async () => {
    const state = get();
    if (!state.sessionId || !state.token || state.role !== "host") {
      return;
    }
    await apiFetch(`/sessions/${state.sessionId}/end`, {
      method: "POST",
      headers: { Authorization: `Bearer ${state.token}` },
    });
    set({ endedReason: "host_ended" });
  },

  heartbeat: async () => {
    const state = get();
    if (!state.sessionId || !state.token || state.role !== "host") {
      return;
    }
    await apiFetch(`/sessions/${state.sessionId}/heartbeat`, {
      method: "POST",
      headers: { Authorization: `Bearer ${state.token}` },
    });
  },

  setParticipants: (participants) => set({ participants }),
  setGuestsCanEditLocal: (value) => {
    const role = get().role;
    set({
      guestsCanEdit: value,
      canEdit: role === "host" ? true : value,
    });
  },
  setEndedReason: (reason) => set({ endedReason: reason }),
  bumpRevision: () => {
    const next = get().revision + 1;
    set({ revision: next });
    return next;
  },
  clear: () =>
    set({
      sessionId: null,
      joinCode: null,
      token: null,
      role: null,
      participantId: null,
      displayName: null,
      canEdit: true,
      guestsCanEdit: false,
      participants: [],
      endedReason: null,
      revision: 0,
    }),
}));
