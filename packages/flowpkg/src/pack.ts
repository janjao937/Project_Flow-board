import { strToU8, zipSync } from "fflate";
import { computePackageChecksum } from "./checksum";
import { ASSETS_DIR, CHECKSUM_PATH, DOCUMENT_PATH, MANIFEST_PATH, PREVIEW_PATH } from "./constants";
import type { FlowPackage } from "./types";

export async function packFlowPackage(pkg: FlowPackage): Promise<Uint8Array> {
  const manifestBytes = strToU8(JSON.stringify(pkg.manifest, null, 2));
  const files: Record<string, Uint8Array> = {
    [MANIFEST_PATH]: manifestBytes,
    [DOCUMENT_PATH]: pkg.document,
  };

  for (const asset of pkg.assets) {
    const path = asset.path.startsWith(ASSETS_DIR)
      ? asset.path
      : `${ASSETS_DIR}${asset.path}`;
    files[path] = asset.data;
    if (path === PREVIEW_PATH || path.endsWith(`/${PREVIEW_PATH}`)) {
      files[PREVIEW_PATH] = asset.data;
    }
  }

  const checksum = await computePackageChecksum([manifestBytes, pkg.document]);
  files[CHECKSUM_PATH] = strToU8(checksum);

  return zipSync(files, { level: 6 });
}
