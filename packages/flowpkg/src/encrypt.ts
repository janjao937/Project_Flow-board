import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  ENCRYPTION_FORMAT,
  ENCRYPTION_META_PATH,
  ENCRYPTION_PAYLOAD_PATH,
  MANIFEST_PATH,
  PBKDF2_ITERATIONS,
} from "./constants";
import { FlowPackError } from "./unpack";

export interface EncryptionMeta {
  format: typeof ENCRYPTION_FORMAT;
  version: 1;
  kdf: "PBKDF2";
  hash: "SHA-256";
  iterations: number;
  salt: string;
  cipher: "AES-GCM";
  iv: string;
}

function requireSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new FlowPackError("crypto_unavailable");
  }
  return subtle;
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

export function isEncryptedPackage(bytes: Uint8Array): boolean {
  try {
    const files = unzipSync(bytes);
    return Boolean(
      files[ENCRYPTION_META_PATH] && files[ENCRYPTION_PAYLOAD_PATH] && !files[MANIFEST_PATH],
    );
  } catch {
    return false;
  }
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const subtle = requireSubtle();
  const material = await subtle.importKey(
    "raw",
    asBufferSource(new TextEncoder().encode(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: asBufferSource(salt),
      iterations,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptFlowPackageBytes(
  innerZip: Uint8Array,
  passphrase: string,
): Promise<Uint8Array> {
  if (!passphrase.trim()) {
    throw new FlowPackError("missing_passphrase");
  }
  const subtle = requireSubtle();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const cipherBuffer = await subtle.encrypt(
    { name: "AES-GCM", iv: asBufferSource(iv) },
    key,
    asBufferSource(innerZip),
  );
  const meta: EncryptionMeta = {
    format: ENCRYPTION_FORMAT,
    version: 1,
    kdf: "PBKDF2",
    hash: "SHA-256",
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    cipher: "AES-GCM",
    iv: toBase64(iv),
  };
  return zipSync(
    {
      [ENCRYPTION_META_PATH]: strToU8(JSON.stringify(meta)),
      [ENCRYPTION_PAYLOAD_PATH]: new Uint8Array(cipherBuffer),
    },
    { level: 0 },
  );
}

export async function decryptFlowPackageBytes(
  outerZip: Uint8Array,
  passphrase: string,
): Promise<Uint8Array> {
  if (!passphrase.trim()) {
    throw new FlowPackError("missing_passphrase");
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(outerZip);
  } catch {
    throw new FlowPackError("not_a_zip");
  }

  const metaBytes = files[ENCRYPTION_META_PATH];
  const payload = files[ENCRYPTION_PAYLOAD_PATH];
  if (!metaBytes || !payload) {
    throw new FlowPackError("not_encrypted");
  }

  let meta: EncryptionMeta;
  try {
    meta = JSON.parse(strFromU8(metaBytes)) as EncryptionMeta;
  } catch {
    throw new FlowPackError("invalid_encryption_meta");
  }

  if (meta.format !== ENCRYPTION_FORMAT || meta.version !== 1 || meta.cipher !== "AES-GCM") {
    throw new FlowPackError("unsupported_encryption");
  }

  const salt = fromBase64(meta.salt);
  const iv = fromBase64(meta.iv);
  const iterations = meta.iterations > 0 ? meta.iterations : PBKDF2_ITERATIONS;
  const key = await deriveKey(passphrase, salt, iterations);
  const subtle = requireSubtle();

  try {
    const plain = await subtle.decrypt(
      { name: "AES-GCM", iv: asBufferSource(iv) },
      key,
      asBufferSource(payload),
    );
    return new Uint8Array(plain);
  } catch {
    throw new FlowPackError("decrypt_failed");
  }
}
