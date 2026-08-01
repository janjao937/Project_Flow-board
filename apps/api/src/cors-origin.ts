/** Resolve @fastify/cors `origin` option from env.CORS_ORIGIN. */
export function resolveCorsOrigin(nodeEnv: string, corsOrigin: string): boolean | string | string[] {
  if (nodeEnv === "development") {
    return true;
  }

  const raw = corsOrigin.trim();
  if (!raw || raw === "*") {
    return true;
  }

  const list = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (list.length === 0) {
    return true;
  }
  if (list.length === 1) {
    return list[0]!;
  }

  return list;
}
