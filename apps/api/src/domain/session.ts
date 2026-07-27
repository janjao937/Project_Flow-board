export type SessionRole = "host" | "guest";

export interface SessionRecord {
  id: string;
  workflowId: string;
  workflowName: string;
  joinCode: string;
  guestsCanEdit: boolean;
  hostParticipantId: string;
  createdAt: number;
  expiresAt: number;
  endedAt: number | null;
  endReason: "host_left" | "host_ended" | null;
  lastHostHeartbeatAt: number;
  snapshot: {
    manifest: unknown;
    data: unknown;
  } | null;
}

export interface ParticipantClaims {
  sessionId: string;
  workflowId: string;
  participantId: string;
  displayName: string;
  role: SessionRole;
  canEdit: boolean;
}
