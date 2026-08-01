#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = path.join("docker", "docker-compose.trycloudflare.yml");
const projectName = "flowboard-trycloudflare";
const urlFile = path.join(root, "trycloudflare-url.txt");
const localPort = Number(process.env.FLOWBOARD_LOCAL_PORT || 3080) || 3080;
// Quick Tunnel hostnames look like random-words.trycloudflare.com.
// Reject reserved hosts (e.g. api.trycloudflare.com) that appear in cloudflared logs.
const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi;
const reservedTrycloudflareHosts = new Set([
  "api.trycloudflare.com",
  "www.trycloudflare.com",
  "trycloudflare.com",
]);
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

function localAccessUrls() {
  const urls = [`http://127.0.0.1:${localPort}`];
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets ?? []) {
      const family = net.family;
      const isV4 = family === "IPv4" || family === 4;
      if (isV4 && !net.internal) {
        urls.push(`http://${net.address}:${localPort}`);
      }
    }
  }
  return [...new Set(urls)];
}

function extractUrl(text) {
  const matches = String(text ?? "").match(urlPattern);
  if (!matches?.length) {
    return null;
  }
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const url = matches[i].replace(/\/$/, "");
    let host;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (reservedTrycloudflareHosts.has(host)) {
      continue;
    }
    // Real quick-tunnel hosts are multi-label random names, not short reserved ones.
    if (!host.includes("-") && host.split(".")[0].length < 12) {
      continue;
    }
    return url;
  }
  return null;
}

function detectRateLimit(text) {
  const sample = String(text ?? "");
  return (
    sample.includes("429 Too Many Requests") ||
    sample.includes("error code: 1015") ||
    /rate.?limit/i.test(sample)
  );
}

function printAccessUrls(publicUrl) {
  const localUrls = localAccessUrls();
  const line = "=".repeat(78);
  console.log(`\n${line}`);
  if (publicUrl) {
    console.log("  PUBLIC URL (แชร์ชั่วคราวเท่านั้น — อย่า Install จากลิงก์นี้)");
    console.log(`  ${publicUrl}`);
    console.log("");
  }
  console.log("  LOCAL URL (ใช้ติดตั้ง/ใช้งานในเครื่องหรือ LAN — ใช้ได้แม้ปิด Cloudflare)");
  for (const url of localUrls) {
    console.log(`  ${url}`);
  }
  console.log("");
  console.log("  Host: เปิดลิงก์ → Start session → ส่ง join code");
  console.log("  ปิดเฉพาะ tunnel: Ctrl+C หรือ stop-trycloudflare-tunnel.bat");
  console.log("  หยุดทั้ง stack: stop-trycloudflare.bat");
  console.log(`${line}\n`);
  console.log(`Saved to: ${urlFile}\n`);
}

function saveUrl(publicUrl, meta = {}) {
  const updatedAt = new Date().toISOString();
  const localUrls = localAccessUrls();
  const body = [
    publicUrl || "(no public tunnel)",
    "",
    `localUrl=${localUrls[0]}`,
    ...localUrls.slice(1).map((url) => `lanUrl=${url}`),
    `updatedAt=${updatedAt}`,
    meta.note ? `note=${meta.note}` : null,
    "tip=Install/bookmark LOCAL URL for use after Cloudflare is closed",
  ]
    .filter(Boolean)
    .join("\n");
  fs.writeFileSync(urlFile, `${body}\n`, "utf8");
}

function saveWaiting() {
  const updatedAt = new Date().toISOString();
  fs.writeFileSync(
    urlFile,
    [`waiting for trycloudflare URL...`, "", `localUrl=http://127.0.0.1:${localPort}`, `updatedAt=${updatedAt}`, `status=waiting`].join(
      "\n",
    ) + "\n",
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
  let rateLimitWarned = false;
  while (Date.now() - started < timeoutMs) {
    attempt += 1;
    const logs = readCloudflaredLogs(sinceIso);
    const url = extractUrl(logs);
    if (url) {
      return { url, rateLimited: false };
    }
    if (!rateLimitWarned && detectRateLimit(logs)) {
      rateLimitWarned = true;
      console.error("");
      console.error("Cloudflare Quick Tunnel is rate-limiting this IP (HTTP 429 / error 1015).");
      console.error("Stopping cloudflared so retries do not make the limit worse...");
      dockerSync(composeArgs(["stop", "cloudflared"]), { stdio: "inherit" });
      console.error("");
      console.error("Local app is still available:");
      for (const url of localAccessUrls()) {
        console.error(`  ${url}`);
      }
      console.error("");
      console.error("Wait 15–30 minutes, then run start-trycloudflare.bat again for a public URL.");
      return { url: null, rateLimited: true };
    }
    if (attempt === 1 || attempt % 5 === 0) {
      const waited = Math.round((Date.now() - started) / 1000);
      console.log(`Waiting for Cloudflare public URL... (${waited}s)`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return { url: null, rateLimited: false };
}

/** Ctrl+C closes public tunnel only — local/LAN stack keeps running. */
function shutdownTunnelOnly() {
  console.log("\nStopping Cloudflare tunnel only (local stack stays up)...");
  dockerSync(composeArgs(["stop", "cloudflared"]), { stdio: "inherit" });
  const localUrls = localAccessUrls();
  saveUrl("", { note: "tunnel-stopped-local-only" });
  console.log("");
  console.log("Public trycloudflare URL is offline.");
  console.log("Keep using Flowboard locally:");
  for (const url of localUrls) {
    console.log(`  ${url}`);
  }
  console.log("");
  console.log("Full stop (web/api/nats/edge): stop-trycloudflare.bat");
  process.exit(0);
}

ensureDocker();

console.log("Starting Flowboard (detached): web + api + nats + caddy + tunnel");
console.log("No custom domain needed — Cloudflare assigns a random *.trycloudflare.com URL.");
console.log(`Local access (no Cloudflare): http://127.0.0.1:${localPort}`);
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

console.log("\nLocal stack is up even if the public tunnel fails.");
printAccessUrls(null);

// Always recreate the quick tunnel so each start gets a fresh public URL
// (otherwise cloudflared keeps the old container/logs and the txt file looks unchanged).
console.log("\nRecreating cloudflared tunnel for a fresh public URL...");
const tunnelSince = new Date().toISOString();
const recreate = dockerSync(composeArgs(["up", "-d", "--force-recreate", "--no-deps", "cloudflared"]), {
  stdio: "inherit",
});
if (recreate.status !== 0) {
  console.error("\nFailed to recreate cloudflared tunnel.");
  console.error("Local URLs above still work.");
  process.exit(recreate.status ?? 1);
}

console.log("\nLooking for new public URL in cloudflared logs (this run only)...\n");

const { url, rateLimited } = await waitForPublicUrl(tunnelSince);
if (!url) {
  saveUrl("", { note: rateLimited ? "rate-limited" : "no-public-url" });
  if (rateLimited) {
    process.exit(1);
  }
  console.error("Could not find a trycloudflare.com URL yet.");
  console.error("Local stack is still running — use LOCAL URL above.");
  console.error("Check manually with:");
  console.error(`  docker compose -p ${projectName} -f ${composeFile} logs cloudflared --since ${tunnelSince}`);
  console.error("Or run: show-trycloudflare-url.bat");
  process.exit(1);
}

saveUrl(url, { note: "fresh-tunnel" });
printAccessUrls(url);

process.on("SIGINT", shutdownTunnelOnly);
process.on("SIGTERM", shutdownTunnelOnly);

console.log("Following cloudflared logs (API health spam hidden).");
console.log("Ctrl+C = stop PUBLIC tunnel only (local app keeps running).\n");
const logs = dockerSpawn(
  composeArgs(["logs", "-f", "--no-color", "cloudflared", "edge", "web"]),
  {
    stdio: "inherit",
  },
);
logs.on("exit", (code) => {
  process.exit(code ?? 0);
});
