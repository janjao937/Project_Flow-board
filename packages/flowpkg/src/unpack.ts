import { strFromU8, unzipSync } from "fflate";
import { computePackageChecksum } from "./checksum";
import { ASSETS_DIR, CHECKSUM_PATH, DOCUMENT_PATH, ENCRYPTION_META_PATH, ENCRYPTION_PAYLOAD_PATH, MANIFEST_PATH, PREVIEW_PATH } from "./constants";
import type { FlowPackage, PackedAsset } from "./types";
import { WorkflowManifestSchema } from "./types";

export class FlowPackError extends Error {
  readonly code = "WORKFLOW_PACK_INVALID" as const;

  constructor(message: string) {
    super(message);
    this.name = "FlowPackError";
  }
}

export async function unpackFlowPackage(bytes: Uint8Array): Promise<FlowPackage> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new FlowPackError("not_a_zip");
  }

  const manifestBytes = files[MANIFEST_PATH];
  if (!manifestBytes) {
    if (files[ENCRYPTION_META_PATH] && files[ENCRYPTION_PAYLOAD_PATH]) {
      throw new FlowPackError("encrypted");
    }
    throw new FlowPackError("missing_manifest");
  }

  let manifestJson: unknown;
  try {
    manifestJson = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw new FlowPackError("invalid_manifest_json");
  }

  const parsed = WorkflowManifestSchema.safeParse(manifestJson);
  if (!parsed.success) {
    throw new FlowPackError("invalid_manifest_schema");
  }

  const document = files[DOCUMENT_PATH];
  if (!document) {
    throw new FlowPackError("missing_document");
  }

  const checksumFile = files[CHECKSUM_PATH];
  if (checksumFile) {
    const expected = strFromU8(checksumFile).trim();
    const actual = await computePackageChecksum([manifestBytes, document]);
    if (expected !== actual) {
      throw new FlowPackError("checksum_mismatch");
    }
  }

  const assets: PackedAsset[] = [];
  for (const [path, data] of Object.entries(files)) {
    if (path === MANIFEST_PATH || path === DOCUMENT_PATH || path === CHECKSUM_PATH) {
      continue;
    }
    if (path === PREVIEW_PATH || (path.startsWith(ASSETS_DIR) && !path.endsWith("/"))) {
      assets.push({ path, data: new Uint8Array(data) });
    }
  }

  return {
    manifest: parsed.data,
    document: new Uint8Array(document),
    assets,
  };
}
