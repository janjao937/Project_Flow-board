#!/usr/bin/env node
/**
 * Windows/monorepo-safe OpenNext Cloudflare build:
 * 1) next build
 * 2) if standalone nested under apps/web, flatten for OpenNext
 * 3) opennextjs-cloudflare build --skipNextBuild
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(root, "apps", "web");
const isWin = process.platform === "win32";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: webDir,
    stdio: "inherit",
    shell: isWin,
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function flattenStandaloneIfNeeded() {
  const standalone = path.join(webDir, ".next", "standalone");
  const nestedApp = path.join(standalone, "apps", "web");
  const nestedNext = path.join(nestedApp, ".next");
  const flatNext = path.join(standalone, ".next");

  if (!existsSync(nestedNext)) {
    return;
  }
  if (existsSync(flatNext)) {
    return;
  }

  console.log("Flattening monorepo standalone layout for OpenNext...");
  mkdirSync(standalone, { recursive: true });
  cpSync(nestedNext, flatNext, { recursive: true });

  for (const name of ["server.js", "package.json"]) {
    const from = path.join(nestedApp, name);
    const to = path.join(standalone, name);
    if (existsSync(from) && !existsSync(to)) {
      cpSync(from, to);
    }
  }

  const nestedNm = path.join(nestedApp, "node_modules");
  const flatNm = path.join(standalone, "node_modules");
  if (existsSync(nestedNm) && !existsSync(flatNm)) {
    cpSync(nestedNm, flatNm, { recursive: true });
  }
}

// Clean previous OpenNext output (keep Next cache unless forced)
const openNextDir = path.join(webDir, ".open-next");
if (existsSync(openNextDir)) {
  rmSync(openNextDir, { recursive: true, force: true });
}

run("npx", ["next", "build"]);
flattenStandaloneIfNeeded();
run("npx", ["opennextjs-cloudflare", "build", "--skipNextBuild"]);
