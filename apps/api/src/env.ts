import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  NATS_URL: z.string().default("nats://localhost:4222"),
  JWT_SECRET: z.string().min(8).default("dev-secret-change-me"),
  SESSION_TTL_MS: z.coerce.number().int().positive().default(1000 * 60 * 60 * 8),
  HOST_HEARTBEAT_TTL_MS: z.coerce.number().int().positive().default(1000 * 45),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(source);
}
