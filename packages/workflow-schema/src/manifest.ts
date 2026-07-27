import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = 1;

export const PageKind = z.enum(["board", "roadmap", "tasks", "plan"]);
export type PageKind = z.infer<typeof PageKind>;

export const PageRefSchema = z.object({
  id: z.string().min(1),
  kind: PageKind,
  title: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
});
export type PageRef = z.infer<typeof PageRefSchema>;

export const SessionDefaultsSchema = z.object({
  guestsCanEdit: z.boolean().default(false),
});
export type SessionDefaults = z.infer<typeof SessionDefaultsSchema>;

export const WorkflowManifestSchema = z.object({
  schemaVersion: z.number().int().positive(),
  id: z.string().min(1),
  name: z.string().min(1),
  pages: z.array(PageRefSchema),
  sessionDefaults: SessionDefaultsSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WorkflowManifest = z.infer<typeof WorkflowManifestSchema>;

export function parseManifest(input: unknown): WorkflowManifest {
  return WorkflowManifestSchema.parse(input);
}

export function isCurrentSchemaVersion(manifest: WorkflowManifest): boolean {
  return manifest.schemaVersion === CURRENT_SCHEMA_VERSION;
}
