import {
  createEmptyManifest,
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

export function createNewWorkflow(name: string): {
  manifest: WorkflowManifest;
  data: WorkflowDocumentData;
} {
  const manifest = createEmptyManifest(name);
  const boardPage = manifest.pages.find((page) => page.kind === "board");
  const tasksPage = manifest.pages.find((page) => page.kind === "tasks");
  if (!boardPage || !tasksPage) {
    throw new Error("missing_default_pages");
  }
  return {
    manifest,
    data: createDocumentData(boardPage.id, tasksPage.id),
  };
}

export function packWorkflow(manifest: WorkflowManifest, data: WorkflowDocumentData): Uint8Array {
  const updated: WorkflowManifest = {
    ...manifest,
    updatedAt: new Date().toISOString(),
  };
  return packFlowPackage({
    manifest: updated,
    document: encodeDocumentData(data),
    assets: [],
  });
}

export function unpackWorkflow(bytes: Uint8Array): {
  manifest: WorkflowManifest;
  data: WorkflowDocumentData;
} {
  const unpacked = unpackFlowPackage(bytes);
  return {
    manifest: unpacked.manifest,
    data: decodeDocumentData(unpacked.document),
  };
}
