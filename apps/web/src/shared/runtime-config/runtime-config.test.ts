/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetRuntimeConfigForTests,
  __setRuntimeConfigForTests,
  ensureRuntimeConfig,
  getRuntimeApiBaseUrl,
  getSessionApiStatus,
} from "./runtime-config";

async function resolveApiBase() {
  const { resolvePublicApiBase } = await import("@/shared/api-client/public-url");
  return resolvePublicApiBase();
}

afterEach(() => {
  __resetRuntimeConfigForTests();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("runtime-config", () => {
  it("reads apiBaseUrl from /runtime-config.json", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/runtime-config.json")) {
          return new Response(JSON.stringify({ apiBaseUrl: "https://demo.trycloudflare.com", updatedAt: "t" }), {
            status: 200,
          });
        }
        if (url.includes("/ready")) {
          return new Response("{}", { status: 200 });
        }
        return new Response("missing", { status: 404 });
      }),
    );

    const config = await ensureRuntimeConfig({ refresh: true });
    expect(config.apiBaseUrl).toBe("https://demo.trycloudflare.com");
    expect(getRuntimeApiBaseUrl()).toBe("https://demo.trycloudflare.com");
    expect(getSessionApiStatus(true)).toBe("ready");
  });

  it("marks unavailable when runtime API required but empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_REQUIRE_RUNTIME_API", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/runtime-config.json")) {
          return new Response(JSON.stringify({ apiBaseUrl: "" }), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      }),
    );

    await ensureRuntimeConfig({ refresh: true });
    expect(getSessionApiStatus(true)).toBe("unavailable");
    expect(getSessionApiStatus(false)).toBe("offline");
  });

  it("prefers runtime api base in resolvePublicApiBase", async () => {
    __setRuntimeConfigForTests({ apiBaseUrl: "https://tunnel.trycloudflare.com", updatedAt: null }, true);
    expect(await resolveApiBase()).toBe("https://tunnel.trycloudflare.com");
  });
});
