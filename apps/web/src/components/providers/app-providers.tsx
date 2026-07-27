"use client";

import { Toaster } from "@/components/ui/sonner";
import type { ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <Toaster richColors closeButton position="bottom-right" />
    </ThemeProvider>
  );
}
