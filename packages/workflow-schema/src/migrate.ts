import { CURRENT_SCHEMA_VERSION, WorkflowManifest, WorkflowManifestSchema } from "./manifest";

type RawManifest = Record<string, unknown> & { schemaVersion?: number };

type Migration = (input: RawManifest) => RawManifest;

const migrations: Record<number, Migration> = {};

export function migrateManifest(input: RawManifest): WorkflowManifest {
  let current = input;
  let version = typeof current.schemaVersion === "number" ? current.schemaVersion : 1;

  while (version < CURRENT_SCHEMA_VERSION) {
    const migration = migrations[version];
    if (!migration) {
      break;
    }
    current = migration(current);
    version += 1;
    current.schemaVersion = version;
  }

  return WorkflowManifestSchema.parse(current);
}
