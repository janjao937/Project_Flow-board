import {
  createEmptyManifest,
  decryptFlowPackageBytes,
  encryptFlowPackageBytes,
  isEncryptedPackage,
  packFlowPackage,
  unpackFlowPackage,
  type WorkflowManifest,
} from "@/shared/packages/flowpkg";
import {
  createDocumentData,
  decodeDocumentData,
  encodeDocumentData,
  type WorkflowDocumentData,
} from "../domain/document-data";

export type PackWorkflowOptions = {
  passphrase?: string;
};

export type UnpackWorkflowOptions = {
  passphrase?: string;
};

export function createNewWorkflow(name: string): {
  manifest: WorkflowManifest;
  data: WorkflowDocumentData;
} {
  const manifest = createEmptyManifest(name);
  const boardPage = manifest.pages.find((page) => page.kind === "board");
  const tasksPage = manifest.pages.find((page) => page.kind === "tasks");
  const roadmapPage = manifest.pages.find((page) => page.kind === "roadmap");
  const planPage = manifest.pages.find((page) => page.kind === "plan");
  if (!boardPage || !tasksPage || !roadmapPage || !planPage) {
    throw new Error("missing_default_pages");
  }
  return {
    manifest,
    data: createDocumentData(boardPage.id, tasksPage.id, roadmapPage.id, planPage.id),
  };
}

export async function packWorkflow(
  manifest: WorkflowManifest,
  data: WorkflowDocumentData,
  preview?: Uint8Array,
  options?: PackWorkflowOptions,
): Promise<Uint8Array> {
  const updated: WorkflowManifest = {
    ...manifest,
    updatedAt: new Date().toISOString(),
  };
  const assets = preview ? [{ path: "preview.png", data: preview }] : [];
  const plain = await packFlowPackage({
    manifest: updated,
    document: encodeDocumentData(data),
    assets,
  });
  if (options?.passphrase) {
    return encryptFlowPackageBytes(plain, options.passphrase);
  }
  return plain;
}

export async function unpackWorkflow(
  bytes: Uint8Array,
  options?: UnpackWorkflowOptions,
): Promise<{
  manifest: WorkflowManifest;
  data: WorkflowDocumentData;
  encrypted: boolean;
}> {
  let packageBytes = bytes;
  const encrypted = isEncryptedPackage(bytes);
  if (encrypted) {
    packageBytes = await decryptFlowPackageBytes(bytes, options?.passphrase ?? "");
  }
  const unpacked = await unpackFlowPackage(packageBytes);
  return {
    manifest: unpacked.manifest,
    data: decodeDocumentData(unpacked.document),
    encrypted,
  };
}
