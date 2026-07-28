import { describe, expect, it } from "vitest";
import { createNewWorkflow, packWorkflow, unpackWorkflow } from "./workflow-io";

describe("workflow-io", () => {
  it("creates a workflow with board, tasks, roadmap, and plan pages", () => {
    const created = createNewWorkflow("Sprint");
    expect(created.manifest.name).toBe("Sprint");
    expect(created.manifest.pages.map((page) => page.kind).sort()).toEqual([
      "board",
      "plan",
      "roadmap",
      "tasks",
    ]);
  });

  it("round-trips through pack and unpack", async () => {
    const created = createNewWorkflow("Roundtrip");
    const boardId = created.manifest.pages.find((page) => page.kind === "board")?.id;
    if (!boardId) {
      throw new Error("missing board");
    }
    created.data.boards[boardId] = {
      stickies: [
        {
          id: "s1",
          x: 10,
          y: 20,
          width: 180,
          height: 160,
          text: "Hello",
          color: "mint",
          zIndex: 1,
        },
      ],
      shapes: [],
      connectors: [],
      images: [],
      frames: [],
      strokes: [],
      groups: [],
      gridEnabled: false,
    };

    const bytes = await packWorkflow(created.manifest, created.data);
    const opened = await unpackWorkflow(bytes);
    expect(opened.manifest.name).toBe("Roundtrip");
    expect(opened.encrypted).toBe(false);
    expect(opened.data.boards[boardId]?.stickies[0]?.text).toBe("Hello");
    expect(Object.keys(opened.data.roadmaps).length).toBeGreaterThan(0);
    expect(Object.keys(opened.data.plans).length).toBeGreaterThan(0);
  });

  it("round-trips encrypted packages with passphrase", async () => {
    const created = createNewWorkflow("Vault");
    const bytes = await packWorkflow(created.manifest, created.data, undefined, {
      passphrase: "s3cret-phrase",
    });
    const opened = await unpackWorkflow(bytes, { passphrase: "s3cret-phrase" });
    expect(opened.encrypted).toBe(true);
    expect(opened.manifest.name).toBe("Vault");
  });
});
