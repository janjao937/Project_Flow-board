import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";

const env = loadEnv();

const app = await buildApp(env);

await app.listen({ port: env.PORT, host: env.HOST });
