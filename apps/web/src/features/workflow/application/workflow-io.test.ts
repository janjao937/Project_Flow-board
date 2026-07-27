import { describe, expect, it } from "vitest";
import { createNewWorkflow, packWorkflow, unpackWorkflow } from "./workflow-io";

describe("workflow-io", () => {
  it("creates a workflow with board and tasks pages", () => {
    const created = createNewWorkflow("Sprint");
    expect(created.manifest.name).toBe("Sprint");
    expect(created.manifest.pages.map((page) => page.kind).sort()).toEqual(["board", "tasks"]);
  });

  it("round-trips through pack and unpack", () => {
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
    };

    const bytes = packWorkflow(created.manifest, created.data);
    const opened = unpackWorkflow(bytes);
    expect(opened.manifest.name).toBe("Roundtrip");
    expect(opened.data.boards[boardId]?.stickies[0]?.text).toBe("Hello");
  });
});
