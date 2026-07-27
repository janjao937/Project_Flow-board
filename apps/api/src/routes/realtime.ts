import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { AppError, ErrorCode } from "../../../../packages/errors/src/index";
import type { Env } from "../env";
import { verifyParticipantToken } from "../infrastructure/jwt";
import type { RealtimeClientMessage, RealtimeHub } from "../infrastructure/realtime-hub";
import { sessionStore } from "../infrastructure/session-store";

export async function realtimeRoutes(
  app: FastifyInstance,
  deps: { env: Env; hub: RealtimeHub },
): Promise<void> {
  app.get("/realtime", { websocket: true }, (socket: WebSocket, request) => {
    void handleSocket(socket, request.url ?? "", deps);
  });
}

async function handleSocket(
  socket: WebSocket,
  url: string,
  deps: { env: Env; hub: RealtimeHub },
): Promise<void> {
  try {
    const query = new URL(url, "http://localhost").searchParams;
    const token = query.get("token");
    if (!token) {
      socket.close();
      return;
    }

    const claims = await verifyParticipantToken(token, deps.env.JWT_SECRET);
    const session = sessionStore.get(claims.sessionId);
    if (!session || session.endedAt) {
      socket.send(JSON.stringify({ type: "session.ended", reason: session?.endReason ?? "host_ended" }));
      socket.close();
      return;
    }

    if (claims.role === "guest") {
      claims.canEdit = session.guestsCanEdit;
    }

    deps.hub.add(claims.sessionId, {
      socket,
      claims,
      pageId: null,
      cursor: null,
    });

    socket.send(
      JSON.stringify({
        type: "hello",
        participants: deps.hub.listParticipants(claims.sessionId),
        guestsCanEdit: session.guestsCanEdit,
        snapshot: session.snapshot,
      }),
    );

    socket.on("message", (raw) => {
      let message: RealtimeClientMessage;
      try {
        message = JSON.parse(String(raw)) as RealtimeClientMessage;
      } catch {
        return;
      }

      const member = deps.hub.getMember(claims.sessionId, claims.participantId);
      if (!member) {
        return;
      }

      const live = sessionStore.get(claims.sessionId);
      if (!live || live.endedAt) {
        socket.send(JSON.stringify({ type: "session.ended", reason: live?.endReason ?? "host_ended" }));
        socket.close();
        return;
      }

      if (message.type === "ping") {
        socket.send(JSON.stringify({ type: "pong" }));
        return;
      }

      if (message.type === "presence") {
        member.pageId = message.pageId;
        member.cursor = message.cursor;
        deps.hub.broadcastPresence(claims.sessionId);
        return;
      }

      if (message.type === "doc") {
        const canEdit = claims.role === "host" || live.guestsCanEdit;
        if (!canEdit) {
          socket.send(
            JSON.stringify({
              type: "error",
              code: ErrorCode.FORBIDDEN_READ_ONLY,
            }),
          );
          return;
        }
        sessionStore.update(claims.sessionId, {
          snapshot: { manifest: message.manifest, data: message.data },
          lastHostHeartbeatAt:
            claims.role === "host" ? Date.now() : live.lastHostHeartbeatAt,
        });
        deps.hub.sendToRoom(
          claims.sessionId,
          {
            type: "doc",
            from: claims.participantId,
            revision: message.revision,
            manifest: message.manifest,
            data: message.data,
          },
          claims.participantId,
        );
        return;
      }

      if (message.type === "signal") {
        if (message.to) {
          deps.hub.sendToParticipant(claims.sessionId, message.to, {
            type: "signal",
            from: claims.participantId,
            payload: message.payload,
          });
        } else {
          deps.hub.sendToRoom(
            claims.sessionId,
            {
              type: "signal",
              from: claims.participantId,
              payload: message.payload,
            },
            claims.participantId,
          );
        }
      }
    });

    socket.on("close", () => {
      deps.hub.remove(claims.sessionId, claims.participantId);
    });
  } catch (error) {
    if (error instanceof AppError) {
      socket.close();
      return;
    }
    socket.close();
  }
}
