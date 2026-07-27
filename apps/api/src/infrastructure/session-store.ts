import { randomUUID } from "node:crypto";
import type { SessionRecord } from "../domain/session";
import { generateJoinCode, normalizeJoinCode } from "./join-code";

export class SessionStore {
  private readonly byId = new Map<string, SessionRecord>();
  private readonly byCode = new Map<string, string>();

  create(input: {
    workflowId: string;
    workflowName: string;
    guestsCanEdit: boolean;
    ttlMs: number;
    snapshot?: SessionRecord["snapshot"];
  }): SessionRecord {
    const id = randomUUID();
    const hostParticipantId = randomUUID();
    let joinCode = generateJoinCode();
    while (this.byCode.has(joinCode)) {
      joinCode = generateJoinCode();
    }

    const now = Date.now();
    const session: SessionRecord = {
      id,
      workflowId: input.workflowId,
      workflowName: input.workflowName,
      joinCode,
      guestsCanEdit: input.guestsCanEdit,
      hostParticipantId,
      createdAt: now,
      expiresAt: now + input.ttlMs,
      endedAt: null,
      endReason: null,
      lastHostHeartbeatAt: now,
      snapshot: input.snapshot ?? null,
    };

    this.byId.set(id, session);
    this.byCode.set(joinCode, id);
    return session;
  }

  get(id: string): SessionRecord | undefined {
    return this.byId.get(id);
  }

  getByCode(code: string): SessionRecord | undefined {
    const id = this.byCode.get(normalizeJoinCode(code));
    if (!id) {
      return undefined;
    }
    return this.byId.get(id);
  }

  update(id: string, patch: Partial<SessionRecord>): SessionRecord | undefined {
    const current = this.byId.get(id);
    if (!current) {
      return undefined;
    }
    const next = { ...current, ...patch };
    this.byId.set(id, next);
    if (patch.joinCode && patch.joinCode !== current.joinCode) {
      this.byCode.delete(current.joinCode);
      this.byCode.set(patch.joinCode, id);
    }
    return next;
  }

  end(id: string, reason: "host_left" | "host_ended"): SessionRecord | undefined {
    const current = this.byId.get(id);
    if (!current || current.endedAt) {
      return current;
    }
    this.byCode.delete(current.joinCode);
    const next: SessionRecord = {
      ...current,
      endedAt: Date.now(),
      endReason: reason,
    };
    this.byId.set(id, next);
    return next;
  }

  regenerateCode(id: string): SessionRecord | undefined {
    const current = this.byId.get(id);
    if (!current || current.endedAt) {
      return undefined;
    }
    let joinCode = generateJoinCode();
    while (this.byCode.has(joinCode)) {
      joinCode = generateJoinCode();
    }
    this.byCode.delete(current.joinCode);
    this.byCode.set(joinCode, id);
    const next = { ...current, joinCode };
    this.byId.set(id, next);
    return next;
  }

  list(): SessionRecord[] {
    return [...this.byId.values()];
  }
}

export const sessionStore = new SessionStore();
