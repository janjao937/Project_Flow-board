import path from "node:path";
import { defineConfig } from "@playwright/test";

const repoRoot = path.join(__dirname, "../..");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "html",
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    // Root `npm run dev` boots web + api so host session e2e can hit /sessions.
    command: "npm run dev",
    cwd: repoRoot,
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
