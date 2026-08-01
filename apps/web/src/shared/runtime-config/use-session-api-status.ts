"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ensureRuntimeConfig,
  getSessionApiStatus,
  subscribeRuntimeConfig,
  type SessionApiStatus,
} from "./runtime-config";

function subscribeOnline(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getOnlineServerSnapshot() {
  return true;
}

export function useSessionApiStatus(): {
  status: SessionApiStatus;
  refresh: () => Promise<void>;
} {
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return subscribeRuntimeConfig(() => setTick((value) => value + 1));
  }, []);

  useEffect(() => {
    void ensureRuntimeConfig();
  }, []);

  const status = getSessionApiStatus(online);
  void tick;

  return {
    status,
    refresh: async () => {
      await ensureRuntimeConfig({ refresh: true });
    },
  };
}

export function isSessionApiReady(status: SessionApiStatus): boolean {
  return status === "ready";
}
