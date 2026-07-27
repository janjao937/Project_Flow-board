import { strToU8, zipSync } from "fflate";
import { ASSETS_DIR, DOCUMENT_PATH, MANIFEST_PATH } from "./constants";
import type { FlowPackage } from "./types";

export function packFlowPackage(pkg: FlowPackage): Uint8Array {
  const files: Record<string, Uint8Array> = {
    [MANIFEST_PATH]: strToU8(JSON.stringify(pkg.manifest, null, 2)),
    [DOCUMENT_PATH]: pkg.document,
  };

  for (const asset of pkg.assets) {
    const path = asset.path.startsWith(ASSETS_DIR)
      ? asset.path
      : `${ASSETS_DIR}${asset.path}`;
    files[path] = asset.data;
  }

  return zipSync(files, { level: 6 });
}
