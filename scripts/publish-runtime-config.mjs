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

function writeLocalMirror(payload) {
  fs.writeFileSync(localMirror, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function publishRuntimeConfig(baseUrl, { quiet = false } = {}) {
  const token = process.env.CLOUDFLARE_API_TOKEN ?? "";
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const namespaceId = process.env.FLOWBOARD_CF_KV_NAMESPACE_ID ?? "";
  const normalized = (baseUrl ?? "").replace(/\/$/, "");
  const updatedAt = new Date().toISOString();
  const payload = { apiBaseUrl: normalized, updatedAt, published: false };

  if (!token || !accountId || !namespaceId) {
    if (!quiet) {
      console.warn(
        "Runtime config: skipped Cloudflare KV publish (missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / FLOWBOARD_CF_KV_NAMESPACE_ID).",
      );
      console.warn(`Wrote local mirror only: ${localMirror}`);
    }
    writeLocalMirror(payload);
    return { published: false, payload };
  }

  const kvBase = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/`;
  const entries = [
    ["apiBaseUrl", normalized],
    ["updatedAt", updatedAt],
  ];

  for (const [key, value] of entries) {
    const response = await fetch(`${kvBase}${encodeURIComponent(key)}`, {
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

  // KV PUT returning 2xx does not prove the value will be served; read the
  // primary key back (404 is expected only when publishing an empty/cleared value).
  // A mismatch or missing read-back makes the publish failure loud instead of silent.
  const readBack = await fetch(`${kvBase}${encodeURIComponent("apiBaseUrl")}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const readBackValue = readBack.ok ? (await readBack.text()).trim().replace(/\/$/, "") : null;
  const expected = normalized === "" ? "" : normalized;
  const isExpected = normalized === "" ? readBack.status === 404 || readBackValue === "" : readBackValue === expected;
  if (!isExpected) {
    throw new Error(
      `KV read-back after publish does not match (expected "${expected || "(empty)"}", got HTTP ${readBack.status} "${readBackValue ?? "(no body)"}") — the value may not have propagated; retry publish`,
    );
  }

  const publishedPayload = { ...payload, published: true };
  if (!quiet) {
    console.log(`Runtime config published to Cloudflare KV: apiBaseUrl=${normalized || "(cleared)"}`);
  }
  writeLocalMirror(publishedPayload);
  return { published: true, payload: publishedPayload };
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
