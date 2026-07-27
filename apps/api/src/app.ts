import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import type { Env } from "./env";
import { errorHandler } from "./errorHandler";
import { NatsBus } from "./infrastructure/nats-bus";
import { RealtimeHub } from "./infrastructure/realtime-hub";
import { sessionStore } from "./infrastructure/session-store";
import { healthRoutes } from "./routes/health";
import { realtimeRoutes } from "./routes/realtime";
import { sessionRoutes } from "./routes/sessions";

export interface BuiltApp {
  app: FastifyInstance;
  hub: RealtimeHub;
  nats: NatsBus;
  stopWatchdog: () => void;
}

export async function buildApp(env: Env): Promise<BuiltApp> {
  const app = Fastify({
    logger:
      env.NODE_ENV === "test"
        ? false
        : {
            level: "info",
            redact: ["req.headers.authorization", "JWT_SECRET"],
          },
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  if (env.NODE_ENV !== "test") {
    app.addHook("onRequest", async (request) => {
      request.log.info({ method: request.method, url: request.url }, "request");
    });
    app.addHook("onResponse", async (request, reply) => {
      request.log.info(
        { method: request.method, url: request.url, statusCode: reply.statusCode },
        "response",
      );
    });
  }

  const nats = new NatsBus(env.NATS_URL);
  if (env.NODE_ENV !== "test") {
    await nats.start();
  }
  const hub = new RealtimeHub(nats);

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
  });
  await app.register(websocket);

  app.setErrorHandler(errorHandler);

  await app.register(healthRoutes);
  await app.register(async (instance) => sessionRoutes(instance, { env, hub }));
  await app.register(async (instance) => realtimeRoutes(instance, { env, hub }));

  const stopWatchdog = startHostWatchdog(env, hub);

  app.addHook("onClose", async () => {
    stopWatchdog();
    await nats.stop();
  });

  return { app, hub, nats, stopWatchdog };
}

function startHostWatchdog(env: Env, hub: RealtimeHub): () => void {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const session of sessionStore.list()) {
      if (session.endedAt) {
        continue;
      }
      if (now - session.lastHostHeartbeatAt > env.HOST_HEARTBEAT_TTL_MS) {
        sessionStore.end(session.id, "host_left");
        hub.endSession(session.id, "host_left");
      }
    }
  }, 5000);

  return () => clearInterval(timer);
}
