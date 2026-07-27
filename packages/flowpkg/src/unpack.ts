import { strFromU8, unzipSync } from "fflate";
import { ASSETS_DIR, DOCUMENT_PATH, MANIFEST_PATH } from "./constants";
import type { FlowPackage, PackedAsset } from "./types";
import { WorkflowManifestSchema } from "./types";

export class FlowPackError extends Error {
  readonly code = "WORKFLOW_PACK_INVALID" as const;

  constructor(message: string) {
    super(message);
    this.name = "FlowPackError";
  }
}

export function unpackFlowPackage(bytes: Uint8Array): FlowPackage {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new FlowPackError("not_a_zip");
  }

  const manifestBytes = files[MANIFEST_PATH];
  if (!manifestBytes) {
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

  const assets: PackedAsset[] = [];
  for (const [path, data] of Object.entries(files)) {
    if (path === MANIFEST_PATH || path === DOCUMENT_PATH) {
      continue;
    }
    if (path.startsWith(ASSETS_DIR) && !path.endsWith("/")) {
      assets.push({ path, data: new Uint8Array(data) });
    }
  }

  return {
    manifest: parsed.data,
    document: new Uint8Array(document),
    assets,
  };
}
