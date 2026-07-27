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
): Promise<Uint8Array> {
  const updated: WorkflowManifest = {
    ...manifest,
    updatedAt: new Date().toISOString(),
  };
  const assets = preview ? [{ path: "preview.png", data: preview }] : [];
  return packFlowPackage({
    manifest: updated,
    document: encodeDocumentData(data),
    assets,
  });
}

export async function unpackWorkflow(bytes: Uint8Array): Promise<{
  manifest: WorkflowManifest;
  data: WorkflowDocumentData;
}> {
  const unpacked = await unpackFlowPackage(bytes);
  return {
    manifest: unpacked.manifest,
    data: decodeDocumentData(unpacked.document),
  };
}
