import type { FastifyInstance } from "fastify";
import { sessionStore } from "../infrastructure/session-store";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.get("/ready", async (_request, reply) => {
    const sessions = sessionStore.list().filter((session) => !session.endedAt).length;
    return reply.send({
      status: "ready",
      uptimeSec: Math.floor(process.uptime()),
      activeSessions: sessions,
    });
  });
}
