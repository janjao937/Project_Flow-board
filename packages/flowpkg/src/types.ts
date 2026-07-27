import { z } from "zod";
import {
  CURRENT_SCHEMA_VERSION,
  type WorkflowManifest,
  WorkflowManifestSchema,
} from "../../workflow-schema/src/manifest";

export { WorkflowManifestSchema };
export type { WorkflowManifest };

export const PackedAssetSchema = z.object({
  path: z.string().min(1),
  data: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
});
export type PackedAsset = z.infer<typeof PackedAssetSchema>;

export interface FlowPackage {
  manifest: WorkflowManifest;
  document: Uint8Array;
  assets: PackedAsset[];
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyManifest(name: string): WorkflowManifest {
  const now = new Date().toISOString();
  const boardId = newId();
  const tasksId = newId();
  const roadmapId = newId();
  const planId = newId();
  return WorkflowManifestSchema.parse({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: newId(),
    name,
    pages: [
      { id: boardId, kind: "board", title: "Board", sortOrder: 0 },
      { id: tasksId, kind: "tasks", title: "Tasks", sortOrder: 1 },
      { id: roadmapId, kind: "roadmap", title: "Roadmap", sortOrder: 2 },
      { id: planId, kind: "plan", title: "Plan", sortOrder: 3 },
    ],
    sessionDefaults: { guestsCanEdit: false },
    createdAt: now,
    updatedAt: now,
  });
}
