import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { AppError, ErrorCode } from "../../../../packages/errors/src/index";
import type { Env } from "../env";
import { signParticipantToken, verifyParticipantToken } from "../infrastructure/jwt";
import { normalizeJoinCode } from "../infrastructure/join-code";
import { consumeRateLimit } from "../infrastructure/rate-limit";
import type { RealtimeHub } from "../infrastructure/realtime-hub";
import { sessionStore } from "../infrastructure/session-store";

const CreateSessionSchema = z.object({
  workflowId: z.string().min(1),
  workflowName: z.string().min(1),
  displayName: z.string().min(1).max(64),
  guestsCanEdit: z.boolean().default(false),
  snapshot: z
    .object({
      manifest: z.unknown(),
      data: z.unknown(),
    })
    .optional(),
});

const JoinSessionSchema = z.object({
  code: z.string().min(4).max(16),
  displayName: z.string().min(1).max(64),
});

const PatchSessionSchema = z.object({
  guestsCanEdit: z.boolean().optional(),
  snapshot: z
    .object({
      manifest: z.unknown(),
      data: z.unknown(),
    })
    .optional(),
});

function bearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}

export async function sessionRoutes(
  app: FastifyInstance,
  deps: { env: Env; hub: RealtimeHub },
): Promise<void> {
  app.post("/sessions", async (request) => {
    const body = CreateSessionSchema.parse(request.body);
    const session = sessionStore.create({
      workflowId: body.workflowId,
      workflowName: body.workflowName,
      guestsCanEdit: body.guestsCanEdit,
      ttlMs: deps.env.SESSION_TTL_MS,
      snapshot: body.snapshot ?? null,
    });

    const token = await signParticipantToken(
      {
        sessionId: session.id,
        workflowId: session.workflowId,
        participantId: session.hostParticipantId,
        displayName: body.displayName,
        role: "host",
        canEdit: true,
      },
      deps.env.JWT_SECRET,
    );

    return {
      sessionId: session.id,
      joinCode: session.joinCode,
      guestsCanEdit: session.guestsCanEdit,
      token,
      role: "host" as const,
      participantId: session.hostParticipantId,
      canEdit: true,
    };
  });

  app.post("/sessions/join", async (request) => {
    const ip = request.ip || "unknown";
    if (!consumeRateLimit(`join:${ip}`, 20, 60_000)) {
      throw AppError.from(ErrorCode.RATE_LIMITED);
    }

    const body = JoinSessionSchema.parse(request.body);
    const session = sessionStore.getByCode(normalizeJoinCode(body.code));
    if (!session) {
      throw AppError.from(ErrorCode.JOIN_CODE_INVALID);
    }
    if (session.endedAt) {
      throw AppError.from(ErrorCode.SESSION_ENDED);
    }
    if (session.expiresAt < Date.now()) {
      throw AppError.from(ErrorCode.JOIN_CODE_EXPIRED);
    }

    const participantId = randomUUID();
    const canEdit = session.guestsCanEdit;
    const token = await signParticipantToken(
      {
        sessionId: session.id,
        workflowId: session.workflowId,
        participantId,
        displayName: body.displayName,
        role: "guest",
        canEdit,
      },
      deps.env.JWT_SECRET,
    );

    return {
      sessionId: session.id,
      workflowId: session.workflowId,
      workflowName: session.workflowName,
      guestsCanEdit: session.guestsCanEdit,
      token,
      role: "guest" as const,
      participantId,
      canEdit,
      snapshot: session.snapshot,
    };
  });

  app.get("/sessions/:id", async (request) => {
    const { id } = request.params as { id: string };
    const session = sessionStore.get(id);
    if (!session) {
      throw AppError.from(ErrorCode.SESSION_NOT_FOUND);
    }
    return {
      sessionId: session.id,
      workflowId: session.workflowId,
      workflowName: session.workflowName,
      joinCode: session.joinCode,
      guestsCanEdit: session.guestsCanEdit,
      endedAt: session.endedAt,
      endReason: session.endReason,
    };
  });

  app.patch("/sessions/:id", async (request) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      throw AppError.from(ErrorCode.FORBIDDEN_READ_ONLY);
    }
    const claims = await verifyParticipantToken(token, deps.env.JWT_SECRET);
    const { id } = request.params as { id: string };
    if (claims.sessionId !== id || claims.role !== "host") {
      throw AppError.from(ErrorCode.FORBIDDEN_READ_ONLY);
    }

    const session = sessionStore.get(id);
    if (!session || session.endedAt) {
      throw AppError.from(ErrorCode.SESSION_NOT_FOUND);
    }

    const body = PatchSessionSchema.parse(request.body);
    const next = sessionStore.update(id, {
      guestsCanEdit: body.guestsCanEdit ?? session.guestsCanEdit,
      snapshot: body.snapshot ?? session.snapshot,
    });
    if (!next) {
      throw AppError.from(ErrorCode.SESSION_NOT_FOUND);
    }

    if (body.guestsCanEdit !== undefined) {
      deps.hub.setGuestsCanEdit(id, body.guestsCanEdit);
    }

    return {
      sessionId: next.id,
      joinCode: next.joinCode,
      guestsCanEdit: next.guestsCanEdit,
    };
  });

  app.post("/sessions/:id/end", async (request) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      throw AppError.from(ErrorCode.FORBIDDEN_READ_ONLY);
    }
    const claims = await verifyParticipantToken(token, deps.env.JWT_SECRET);
    const { id } = request.params as { id: string };
    if (claims.sessionId !== id || claims.role !== "host") {
      throw AppError.from(ErrorCode.FORBIDDEN_READ_ONLY);
    }

    const ended = sessionStore.end(id, "host_ended");
    if (!ended) {
      throw AppError.from(ErrorCode.SESSION_NOT_FOUND);
    }
    deps.hub.endSession(id, "host_ended");
    return { ok: true, reason: "host_ended" as const };
  });

  app.post("/sessions/:id/heartbeat", async (request) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      throw AppError.from(ErrorCode.FORBIDDEN_READ_ONLY);
    }
    const claims = await verifyParticipantToken(token, deps.env.JWT_SECRET);
    const { id } = request.params as { id: string };
    if (claims.sessionId !== id || claims.role !== "host") {
      throw AppError.from(ErrorCode.FORBIDDEN_READ_ONLY);
    }
    const session = sessionStore.get(id);
    if (!session || session.endedAt) {
      throw AppError.from(ErrorCode.SESSION_NOT_FOUND);
    }
    sessionStore.update(id, { lastHostHeartbeatAt: Date.now() });
    return { ok: true };
  });

  app.post("/sessions/:id/regenerate-code", async (request) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      throw AppError.from(ErrorCode.FORBIDDEN_READ_ONLY);
    }
    const claims = await verifyParticipantToken(token, deps.env.JWT_SECRET);
    const { id } = request.params as { id: string };
    if (claims.sessionId !== id || claims.role !== "host") {
      throw AppError.from(ErrorCode.FORBIDDEN_READ_ONLY);
    }
    const next = sessionStore.regenerateCode(id);
    if (!next) {
      throw AppError.from(ErrorCode.SESSION_NOT_FOUND);
    }
    return { joinCode: next.joinCode };
  });
}
