import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, isCurrentSchemaVersion, parseManifest } from "./manifest.js";
import { migrateManifest } from "./migrate.js";

function buildManifest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: "wf_1",
    name: "Sprint Q3",
    pages: [{ id: "p1", kind: "board", title: "Brainstorm", sortOrder: 0 }],
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseManifest", () => {
  it("parses a valid manifest", () => {
    const manifest = parseManifest(buildManifest());
    expect(manifest.id).toBe("wf_1");
    expect(manifest.pages).toHaveLength(1);
  });

  it("rejects an invalid page kind", () => {
    expect(() =>
      parseManifest(
        buildManifest({
          pages: [{ id: "p1", kind: "unknown", title: "x", sortOrder: 0 }],
        }),
      ),
    ).toThrow();
  });

  it("detects the current schema version", () => {
    const manifest = parseManifest(buildManifest());
    expect(isCurrentSchemaVersion(manifest)).toBe(true);
  });
});

describe("migrateManifest", () => {
  it("returns a manifest unchanged when already at the current version", () => {
    const manifest = migrateManifest(buildManifest());
    expect(manifest.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});
