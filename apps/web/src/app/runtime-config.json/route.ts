import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RuntimeConfigKv = {
  get: (key: string) => Promise<string | null>;
};

async function readFromCloudflareKv(): Promise<{ apiBaseUrl: string; updatedAt: string | null } | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { RUNTIME_CONFIG?: RuntimeConfigKv }).RUNTIME_CONFIG;
    if (!kv) {
      return null;
    }
    const apiBaseUrl = ((await kv.get("apiBaseUrl")) ?? "").trim().replace(/\/$/, "");
    const updatedAt = (await kv.get("updatedAt")) ?? null;
    return { apiBaseUrl, updatedAt };
  } catch {
    return null;
  }
}

export async function GET() {
  const fromKv = await readFromCloudflareKv();
  const body = fromKv ?? { apiBaseUrl: "", updatedAt: null };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
