export interface RecentWorkflow {
  id: string;
  name: string;
  openedAt: number;
}

const KEY = "flowboard.recent";
const EVENT = "flowboard-recent";
const EMPTY_RECENT: RecentWorkflow[] = [];

let cachedRaw: string | null | undefined;
let cachedValue: RecentWorkflow[] = EMPTY_RECENT;

function readRecent(): RecentWorkflow[] {
  if (typeof window === "undefined") {
    return EMPTY_RECENT;
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cachedRaw) {
      return cachedValue;
    }
    cachedRaw = raw;
    if (!raw) {
      cachedValue = EMPTY_RECENT;
      return cachedValue;
    }
    cachedValue = JSON.parse(raw) as RecentWorkflow[];
    return cachedValue;
  } catch {
    cachedRaw = null;
    cachedValue = EMPTY_RECENT;
    return cachedValue;
  }
}

export function listRecent(): RecentWorkflow[] {
  return readRecent();
}

export function getRecentSnapshot(): RecentWorkflow[] {
  return readRecent();
}

export function getRecentServerSnapshot(): RecentWorkflow[] {
  return EMPTY_RECENT;
}

export function subscribeRecent(onStoreChange: () => void): () => void {
  const onChange = () => onStoreChange();
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function rememberRecent(entry: RecentWorkflow): void {
  const next = [entry, ...listRecent().filter((item) => item.id !== entry.id)].slice(0, 8);
  const raw = JSON.stringify(next);
  localStorage.setItem(KEY, raw);
  cachedRaw = raw;
  cachedValue = next;
  window.dispatchEvent(new Event(EVENT));
}
