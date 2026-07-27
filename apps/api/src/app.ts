import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { Env } from "./env.js";
import { errorHandler } from "./errorHandler.js";
import { healthRoutes } from "./routes/health.js";

export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
  });

  app.setErrorHandler(errorHandler);

  await app.register(healthRoutes);

  return app;
}
