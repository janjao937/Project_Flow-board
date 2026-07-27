import type { WebSocket } from "ws";
import type { ParticipantClaims } from "../domain/session";
import type { NatsBus } from "./nats-bus";

export type RealtimeClientMessage =
  | { type: "presence"; pageId: string | null; cursor: { x: number; y: number } | null }
  | { type: "doc"; revision: number; manifest: unknown; data: unknown }
  | { type: "signal"; to: string | null; payload: unknown }
  | { type: "ping" };

export type RealtimeServerMessage =
  | {
      type: "hello";
      participants: Array<{
        participantId: string;
        displayName: string;
        role: "host" | "guest";
        pageId: string | null;
        cursor: { x: number; y: number } | null;
      }>;
      guestsCanEdit: boolean;
      snapshot: { manifest: unknown; data: unknown } | null;
    }
  | {
      type: "presence";
      participants: Array<{
        participantId: string;
        displayName: string;
        role: "host" | "guest";
        pageId: string | null;
        cursor: { x: number; y: number } | null;
      }>;
    }
  | { type: "doc"; from: string; revision: number; manifest: unknown; data: unknown }
  | { type: "signal"; from: string; payload: unknown }
  | { type: "session.ended"; reason: "host_left" | "host_ended" }
  | { type: "guestsCanEdit"; value: boolean }
  | { type: "pong" };

interface SocketMember {
  socket: WebSocket;
  claims: ParticipantClaims;
  pageId: string | null;
  cursor: { x: number; y: number } | null;
}

export class RealtimeHub {
  private readonly rooms = new Map<string, Map<string, SocketMember>>();

  constructor(private readonly nats: NatsBus) {}

  add(sessionId: string, member: SocketMember): void {
    const room = this.rooms.get(sessionId) ?? new Map<string, SocketMember>();
    room.set(member.claims.participantId, member);
    this.rooms.set(sessionId, room);
    this.broadcastPresence(sessionId);
    this.nats.publish(`wf.${sessionId}.presence`, {
      event: "join",
      participantId: member.claims.participantId,
      displayName: member.claims.displayName,
      role: member.claims.role,
    });
  }

  remove(sessionId: string, participantId: string): void {
    const room = this.rooms.get(sessionId);
    if (!room) {
      return;
    }
    room.delete(participantId);
    if (room.size === 0) {
      this.rooms.delete(sessionId);
    } else {
      this.broadcastPresence(sessionId);
    }
    this.nats.publish(`wf.${sessionId}.presence`, {
      event: "leave",
      participantId,
    });
  }

  getMember(sessionId: string, participantId: string): SocketMember | undefined {
    return this.rooms.get(sessionId)?.get(participantId);
  }

  listParticipants(sessionId: string) {
    const room = this.rooms.get(sessionId);
    if (!room) {
      return [];
    }
    return [...room.values()].map((member) => ({
      participantId: member.claims.participantId,
      displayName: member.claims.displayName,
      role: member.claims.role,
      pageId: member.pageId,
      cursor: member.cursor,
    }));
  }

  broadcastPresence(sessionId: string): void {
    this.sendToRoom(sessionId, {
      type: "presence",
      participants: this.listParticipants(sessionId),
    });
  }

  sendToRoom(sessionId: string, message: RealtimeServerMessage, exceptParticipantId?: string): void {
    const room = this.rooms.get(sessionId);
    if (!room) {
      return;
    }
    const raw = JSON.stringify(message);
    for (const [participantId, member] of room) {
      if (exceptParticipantId && participantId === exceptParticipantId) {
        continue;
      }
      if (member.socket.readyState === member.socket.OPEN) {
        member.socket.send(raw);
      }
    }
  }

  sendToParticipant(sessionId: string, participantId: string, message: RealtimeServerMessage): void {
    const member = this.getMember(sessionId, participantId);
    if (!member || member.socket.readyState !== member.socket.OPEN) {
      return;
    }
    member.socket.send(JSON.stringify(message));
  }

  endSession(sessionId: string, reason: "host_left" | "host_ended"): void {
    this.sendToRoom(sessionId, { type: "session.ended", reason });
    this.nats.publish(`wf.${sessionId}.session.ended`, { reason });
    const room = this.rooms.get(sessionId);
    if (!room) {
      return;
    }
    for (const member of room.values()) {
      member.socket.close();
    }
    this.rooms.delete(sessionId);
  }

  setGuestsCanEdit(sessionId: string, value: boolean): void {
    this.sendToRoom(sessionId, { type: "guestsCanEdit", value });
    this.nats.publish(`wf.${sessionId}.settings`, { guestsCanEdit: value });
  }
}
