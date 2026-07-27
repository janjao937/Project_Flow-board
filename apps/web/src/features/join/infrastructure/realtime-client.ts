"use client";

import type { WorkflowManifest } from "@/shared/packages/flowpkg";
import type { WorkflowDocumentData } from "@/features/workflow/domain/document-data";
import { useSessionStore, type SessionParticipant } from "../store/session-store";

type Handlers = {
  onDoc: (payload: { revision: number; manifest: WorkflowManifest; data: WorkflowDocumentData }) => void;
  onSessionEnded: (reason: "host_left" | "host_ended") => void;
  onSignal?: (from: string, payload: unknown) => void;
};

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private heartbeatTimer: number | null = null;
  private peers = new Map<string, RTCPeerConnection>();
  private readonly pcConfig: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  constructor(private readonly handlers: Handlers) {}

  connect(token: string): void {
    this.disconnect();
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const wsBase = api.replace(/^http/, "ws");
    this.socket = new WebSocket(`${wsBase}/realtime?token=${encodeURIComponent(token)}`);

    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as Record<string, unknown>;
      this.handleMessage(message);
    });

    this.socket.addEventListener("open", () => {
      this.heartbeatTimer = window.setInterval(() => {
        this.send({ type: "ping" });
        void useSessionStore.getState().heartbeat();
      }, 10_000);
    });
  }

  disconnect(): void {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const peer of this.peers.values()) {
      peer.close();
    }
    this.peers.clear();
    this.socket?.close();
    this.socket = null;
  }

  sendPresence(pageId: string | null, cursor: { x: number; y: number } | null): void {
    this.send({ type: "presence", pageId, cursor });
  }

  sendDoc(revision: number, manifest: unknown, data: unknown): void {
    this.send({ type: "doc", revision, manifest, data });
  }

  async ensurePeer(participantId: string): Promise<RTCPeerConnection> {
    const existing = this.peers.get(participantId);
    if (existing) {
      return existing;
    }
    const pc = new RTCPeerConnection(this.pcConfig);
    this.peers.set(participantId, pc);
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.send({
          type: "signal",
          to: participantId,
          payload: { kind: "ice", candidate: event.candidate },
        });
      }
    };
    return pc;
  }

  private send(payload: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  private handleMessage(message: Record<string, unknown>): void {
    if (message.type === "hello" || message.type === "presence") {
      useSessionStore.getState().setParticipants((message.participants as SessionParticipant[]) ?? []);
      if (typeof message.guestsCanEdit === "boolean") {
        useSessionStore.getState().setGuestsCanEditLocal(message.guestsCanEdit);
      }
      return;
    }

    if (message.type === "guestsCanEdit") {
      useSessionStore.getState().setGuestsCanEditLocal(Boolean(message.value));
      return;
    }

    if (message.type === "doc") {
      this.handlers.onDoc({
        revision: Number(message.revision),
        manifest: message.manifest as WorkflowManifest,
        data: message.data as WorkflowDocumentData,
      });
      return;
    }

    if (message.type === "session.ended") {
      const reason = message.reason === "host_left" ? "host_left" : "host_ended";
      useSessionStore.getState().setEndedReason(reason);
      this.handlers.onSessionEnded(reason);
      this.disconnect();
      return;
    }

    if (message.type === "signal") {
      const from = String(message.from);
      const payload = message.payload as { kind?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
      void this.handleSignal(from, payload);
      this.handlers.onSignal?.(from, message.payload);
    }
  }

  private async handleSignal(
    from: string,
    payload: { kind?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit },
  ): Promise<void> {
    const pc = await this.ensurePeer(from);
    if (payload.kind === "offer" && payload.sdp) {
      await pc.setRemoteDescription(payload.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.send({ type: "signal", to: from, payload: { kind: "answer", sdp: answer } });
    }
    if (payload.kind === "answer" && payload.sdp) {
      await pc.setRemoteDescription(payload.sdp);
    }
    if (payload.kind === "ice" && payload.candidate) {
      await pc.addIceCandidate(payload.candidate);
    }
  }
}
