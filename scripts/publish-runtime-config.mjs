#!/usr/bin/env node
/**
 * Publishes apiBaseUrl to Cloudflare KV for GET /runtime-config.json on the deployed web worker.
 *
 * Required env:
 *   CLOUDFLARE_API_TOKEN
 *   CLOUDFLARE_ACCOUNT_ID
 *   FLOWBOARD_CF_KV_NAMESPACE_ID
 *
 * Usage:
 *   node scripts/publish-runtime-config.mjs https://xxxx.trycloudflare.com
 *   node scripts/publish-runtime-config.mjs --clear
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localMirror = path.join(root, "runtime-config.published.json");

function readEnvFiles() {
  for (const name of [".env.trycloudflare", ".env.development", ".env"]) {
    const full = path.join(root, name);
    if (!fs.existsSync(full)) {
      continue;
    }
    const text = fs.readFileSync(full, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq <= 0) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null || process.env[key] === "") {
        process.env[key] = value;
      }
    }
  }
}

readEnvFiles();

export async function publishRuntimeConfig(baseUrl, { quiet = false } = {}) {
  const token = process.env.CLOUDFLARE_API_TOKEN ?? "";
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const namespaceId = process.env.FLOWBOARD_CF_KV_NAMESPACE_ID ?? "";
  const normalized = (baseUrl ?? "").replace(/\/$/, "");
  const updatedAt = new Date().toISOString();
  const payload = { apiBaseUrl: normalized, updatedAt };

  fs.writeFileSync(localMirror, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  if (!token || !accountId || !namespaceId) {
    if (!quiet) {
      console.warn(
        "Runtime config: skipped Cloudflare KV publish (missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / FLOWBOARD_CF_KV_NAMESPACE_ID).",
      );
      console.warn(`Wrote local mirror only: ${localMirror}`);
    }
    return { published: false, payload };
  }

  const entries = [
    ["apiBaseUrl", normalized],
    ["updatedAt", updatedAt],
  ];

  for (const [key, value] of entries) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: value,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) {
      const detail = JSON.stringify(body.errors ?? body);
      throw new Error(`Failed to put KV key ${key}: HTTP ${response.status} ${detail}`);
    }
  }

  if (!quiet) {
    console.log(`Runtime config published to Cloudflare KV: apiBaseUrl=${normalized || "(cleared)"}`);
  }
  return { published: true, payload };
}

const isMain =
  process.argv[1] != null && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const arg = process.argv[2] ?? "";
  const clear = arg === "--clear";
  const apiBaseUrl = clear ? "" : arg.replace(/\/$/, "");
  if (!clear && !apiBaseUrl) {
    console.error("Usage: node scripts/publish-runtime-config.mjs <https://api-base-url> | --clear");
    process.exit(1);
  }
  try {
    await publishRuntimeConfig(apiBaseUrl);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
