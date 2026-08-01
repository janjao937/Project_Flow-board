export type RuntimeConfig = {
  apiBaseUrl: string;
  updatedAt: string | null;
};

const RUNTIME_CONFIG_PATH = "/runtime-config.json";

let cached: RuntimeConfig | null = null;
let loadPromise: Promise<RuntimeConfig> | null = null;
let apiReachable: boolean | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function normalizeConfig(value: unknown): RuntimeConfig {
  if (!value || typeof value !== "object") {
    return { apiBaseUrl: "", updatedAt: null };
  }
  const record = value as Record<string, unknown>;
  const apiBaseUrl = typeof record.apiBaseUrl === "string" ? record.apiBaseUrl.trim().replace(/\/$/, "") : "";
  const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : null;
  return { apiBaseUrl, updatedAt };
}

export function getRuntimeConfig(): RuntimeConfig | null {
  return cached;
}

/** Absolute API origin from runtime config, or null when unset. */
export function getRuntimeApiBaseUrl(): string | null {
  const url = cached?.apiBaseUrl?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

export function subscribeRuntimeConfig(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requiresRuntimeApi(): boolean {
  return process.env.NEXT_PUBLIC_REQUIRE_RUNTIME_API === "1";
}

export function getApiReachable(): boolean | null {
  return apiReachable;
}

export async function probeApiBase(apiBase: string, timeoutMs = 4000): Promise<boolean> {
  const base = apiBase.replace(/\/$/, "");
  if (!base) {
    return false;
  }
  try {
    const response = await fetch(`${base}/ready`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function ensureRuntimeConfig(options?: { refresh?: boolean }): Promise<RuntimeConfig> {
  if (typeof window === "undefined") {
    return cached ?? { apiBaseUrl: "", updatedAt: null };
  }
  if (!options?.refresh && cached) {
    return cached;
  }
  if (!options?.refresh && loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const response = await fetch(RUNTIME_CONFIG_PATH, { cache: "no-store" });
      if (!response.ok) {
        cached = { apiBaseUrl: "", updatedAt: null };
      } else {
        cached = normalizeConfig(await response.json());
      }
    } catch {
      cached = { apiBaseUrl: "", updatedAt: null };
    }

    const runtimeBase = getRuntimeApiBaseUrl();
    if (runtimeBase) {
      apiReachable = await probeApiBase(runtimeBase);
    } else if (requiresRuntimeApi()) {
      apiReachable = false;
    } else {
      // Local / docker: env fallback — treat as available; callers may still hit network errors.
      apiReachable = true;
    }

    notify();
    return cached;
  })();

  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

export type SessionApiStatus = "loading" | "ready" | "unavailable" | "offline";

export function getSessionApiStatus(online: boolean): SessionApiStatus {
  if (!online) {
    return "offline";
  }
  if (!cached) {
    // Local/docker can use NEXT_PUBLIC_API_URL before runtime-config loads.
    return requiresRuntimeApi() ? "loading" : "ready";
  }
  if (requiresRuntimeApi() && !getRuntimeApiBaseUrl()) {
    return "unavailable";
  }
  if (getRuntimeApiBaseUrl() && apiReachable === false) {
    return "unavailable";
  }
  if (apiReachable === null && getRuntimeApiBaseUrl()) {
    return "loading";
  }
  return "ready";
}

/** Test helper — reset module state. */
export function __resetRuntimeConfigForTests() {
  cached = null;
  loadPromise = null;
  apiReachable = null;
}

/** Test helper — seed config without fetching. */
export function __setRuntimeConfigForTests(config: RuntimeConfig | null, reachable: boolean | null = null) {
  cached = config;
  apiReachable = reachable;
  notify();
}
