async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    let hash = 0;
    for (let i = 0; i < bytes.length; i += 1) {
      hash = (hash * 31 + bytes[i]!) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }
  const digest = await subtle.digest("SHA-256", bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function computePackageChecksum(parts: Uint8Array[]): Promise<string> {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.byteLength;
  }
  return sha256Hex(merged);
}
