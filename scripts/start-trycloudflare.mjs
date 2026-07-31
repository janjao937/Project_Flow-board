#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = path.join("docker", "docker-compose.trycloudflare.yml");
const projectName = "flowboard-trycloudflare";
const urlFile = path.join(root, "trycloudflare-url.txt");
const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi;
const isWin = process.platform === "win32";

function dockerSync(args, options = {}) {
  return spawnSync("docker", args, {
    cwd: root,
    shell: isWin,
    encoding: "utf8",
    ...options,
  });
}

function dockerSpawn(args, options = {}) {
  return spawn("docker", args, {
    cwd: root,
    shell: isWin,
    ...options,
  });
}

function composeArgs(extra) {
  return ["compose", "-p", projectName, "-f", composeFile, ...extra];
}

function ensureDocker() {
  const check = dockerSync(["compose", "version"]);
  if (check.status !== 0) {
    console.error("Docker Compose is required. Install Docker Desktop, then retry.");
    process.exit(1);
  }
}

function extractUrl(text) {
  const matches = String(text ?? "").match(urlPattern);
  if (!matches?.length) {
    return null;
  }
  return matches[matches.length - 1].replace(/\/$/, "");
}

function printPublicUrl(url) {
  const line = "=".repeat(Math.min(78, Math.max(48, url.length + 16)));
  console.log(`\n${line}`);
  console.log("  PUBLIC URL (แชร์ลิงก์นี้ให้ทีม)");
  console.log(`  ${url}`);
  console.log("");
  console.log("  Host: เปิดลิงก์ → Start session → ส่ง join code");
  console.log("  หยุด: Ctrl+C หรือ stop-trycloudflare.bat");
  console.log(`${line}\n`);
  console.log(`Saved to: ${urlFile}\n`);
}

function saveUrl(url, meta = {}) {
  const updatedAt = new Date().toISOString();
  const body = [
    url,
    "",
    `updatedAt=${updatedAt}`,
    meta.note ? `note=${meta.note}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  fs.writeFileSync(urlFile, `${body}\n`, "utf8");
}

function saveWaiting() {
  const updatedAt = new Date().toISOString();
  fs.writeFileSync(
    urlFile,
    [`waiting for trycloudflare URL...`, "", `updatedAt=${updatedAt}`, `status=waiting`].join("\n") +
      "\n",
    "utf8",
  );
}

function readCloudflaredLogs(sinceIso) {
  const args = composeArgs(["logs", "cloudflared", "--no-color"]);
  if (sinceIso) {
    args.push("--since", sinceIso);
  }
  const result = dockerSync(args);
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

async function waitForPublicUrl(sinceIso, timeoutMs = 180_000) {
  const started = Date.now();
  let attempt = 0;
  while (Date.now() - started < timeoutMs) {
    attempt += 1;
    const url = extractUrl(readCloudflaredLogs(sinceIso));
    if (url) {
      return url;
    }
    if (attempt === 1 || attempt % 5 === 0) {
      const waited = Math.round((Date.now() - started) / 1000);
      console.log(`Waiting for Cloudflare public URL... (${waited}s)`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return null;
}

function shutdown() {
  console.log("\nStopping stack...");
  dockerSync(composeArgs(["down", "--remove-orphans"]), { stdio: "inherit" });
  try {
    fs.unlinkSync(urlFile);
  } catch {
    // ignore
  }
  process.exit(0);
}

ensureDocker();

console.log("Starting Flowboard (detached): web + api + nats + caddy + tunnel");
console.log("No custom domain needed — Cloudflare assigns a random *.trycloudflare.com URL.");
console.log("First run may take a few minutes to build images.\n");

saveWaiting();
console.log(`URL file reset: ${urlFile}`);

const up = dockerSync(composeArgs(["up", "--build", "-d"]), {
  stdio: "inherit",
});
if (up.status !== 0) {
  console.error("\nFailed to start docker compose stack.");
  process.exit(up.status ?? 1);
}

// Always recreate the quick tunnel so each start gets a fresh public URL
// (otherwise cloudflared keeps the old container/logs and the txt file looks unchanged).
console.log("\nRecreating cloudflared tunnel for a fresh public URL...");
const tunnelSince = new Date().toISOString();
const recreate = dockerSync(composeArgs(["up", "-d", "--force-recreate", "--no-deps", "cloudflared"]), {
  stdio: "inherit",
});
if (recreate.status !== 0) {
  console.error("\nFailed to recreate cloudflared tunnel.");
  process.exit(recreate.status ?? 1);
}

console.log("\nLooking for new public URL in cloudflared logs (this run only)...\n");

const url = await waitForPublicUrl(tunnelSince);
if (!url) {
  console.error("Could not find a trycloudflare.com URL yet.");
  console.error("Check manually with:");
  console.error(`  docker compose -p ${projectName} -f ${composeFile} logs cloudflared --since ${tunnelSince}`);
  console.error("Or run: show-trycloudflare-url.bat");
  process.exit(1);
}

saveUrl(url, { note: "fresh-tunnel" });
printPublicUrl(url);

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("Following cloudflared logs (API health spam hidden). Ctrl+C to stop stack.\n");
const logs = dockerSpawn(
  composeArgs(["logs", "-f", "--no-color", "cloudflared", "edge", "web"]),
  {
    stdio: "inherit",
  },
);
logs.on("exit", (code) => {
  process.exit(code ?? 0);
});
