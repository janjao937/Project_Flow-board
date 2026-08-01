"use client";

import { Toaster } from "@/components/ui/sonner";
import type { ReactNode } from "react";
import { RuntimeConfigBootstrap } from "@/shared/runtime-config/runtime-config-bootstrap";
import { PwaRegister } from "@/shared/pwa/pwa-register";
import { ThemeProvider } from "./theme-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <RuntimeConfigBootstrap />
      <PwaRegister />
      {children}
      <Toaster richColors closeButton position="bottom-right" />
    </ThemeProvider>
  );
}
