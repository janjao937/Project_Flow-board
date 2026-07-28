#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = path.join("docker", "docker-compose.trycloudflare.yml");
const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi;

function runDocker(args, options = {}) {
  return spawn("docker", args, {
    cwd: root,
    shell: process.platform === "win32",
    ...options,
  });
}

function ensureDocker() {
  const check = spawnSync("docker", ["compose", "version"], {
    cwd: root,
    shell: process.platform === "win32",
    encoding: "utf8",
  });
  if (check.status !== 0) {
    console.error("Docker Compose is required. Install Docker Desktop, then retry.");
    process.exit(1);
  }
}

function printPublicUrl(url) {
  const line = "=".repeat(Math.min(72, url.length + 14));
  console.log(`\n${line}`);
  console.log(`Public URL: ${url}`);
  console.log("Share this link. Host: Start session, then send the join code.");
  console.log("Stop with Ctrl+C or: npm run trycloudflare:stop");
  console.log(`${line}\n`);
}

ensureDocker();

console.log("Starting Flowboard (web + api + nats + tunnel)...");
console.log("First run may take a few minutes to build images.\n");

let announcedUrl = null;
const child = runDocker(["compose", "-f", composeFile, "up", "--build"], {
  stdio: ["inherit", "pipe", "pipe"],
});

function scan(chunk, stream) {
  const text = chunk.toString();
  stream.write(text);
  if (announcedUrl) {
    return;
  }
  const matches = text.match(urlPattern);
  if (!matches?.length) {
    return;
  }
  announcedUrl = matches[matches.length - 1].replace(/\/$/, "");
  printPublicUrl(announcedUrl);
}

child.stdout.on("data", (chunk) => scan(chunk, process.stdout));
child.stderr.on("data", (chunk) => scan(chunk, process.stderr));

function shutdown(signal) {
  console.log(`\nStopping stack (${signal})...`);
  const down = runDocker(["compose", "-f", composeFile, "down"], {
    stdio: "inherit",
  });
  down.on("exit", (code) => {
    process.exit(code ?? 0);
  });
  child.kill("SIGTERM");
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code) => {
  if (code && code !== 0) {
    console.error(`\nStack exited with code ${code}`);
  }
  process.exit(code ?? 0);
});
