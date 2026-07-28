export function resolvePublicApiBase(): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  if (configured.startsWith("http://") || configured.startsWith("https://")) {
    return configured;
  }
  const path = configured.startsWith("/") ? configured : `/${configured}`;
  if (typeof window === "undefined") {
    return path;
  }
  return `${window.location.origin}${path}`;
}

export function resolvePublicWsBase(): string {
  const httpBase = resolvePublicApiBase();
  if (httpBase.startsWith("https://")) {
    return `wss://${httpBase.slice("https://".length)}`;
  }
  if (httpBase.startsWith("http://")) {
    return `ws://${httpBase.slice("http://".length)}`;
  }
  if (typeof window === "undefined") {
    return httpBase;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${httpBase}`;
}
