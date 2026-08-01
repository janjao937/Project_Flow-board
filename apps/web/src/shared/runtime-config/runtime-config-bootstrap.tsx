"use client";

import { useEffect } from "react";
import { ensureRuntimeConfig } from "./runtime-config";

/** Loads same-origin runtime config once on app boot. */
export function RuntimeConfigBootstrap() {
  useEffect(() => {
    void ensureRuntimeConfig();
  }, []);
  return null;
}
