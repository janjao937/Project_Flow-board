import { describe, expect, it } from "vitest";
import { addLane, moveLane, moveMilestoneToLane, removeLane, renameLane } from "./lanes";
import type { RoadmapState } from "@/features/workflow/domain/document-data";

const base: RoadmapState = {
  lanes: ["Product", "Engineering"],
  milestones: [
    {
      id: "m1",
      title: "Kickoff",
      date: "2026-07-01",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      status: "planned",
      lane: "Product",
      dependsOn: [],
      linkedCardIds: [],
    },
  ],
};

describe("roadmap lanes", () => {
  it("adds a unique lane name", () => {
    const next = addLane(base, "Product");
    expect(next.lanes).toContain("Product 2");
  });

  it("renames a lane and updates milestones", () => {
    const next = renameLane(base, "Product", "Growth");
    expect(next.lanes).toEqual(["Growth", "Engineering"]);
    expect(next.milestones[0]?.lane).toBe("Growth");
  });

  it("removes a lane and moves milestones to fallback", () => {
    const next = removeLane(base, "Product");
    expect(next.lanes).toEqual(["Engineering"]);
    expect(next.milestones[0]?.lane).toBe("Engineering");
  });

  it("reorders lanes", () => {
    const next = moveLane(base, "Engineering", -1);
    expect(next.lanes).toEqual(["Engineering", "Product"]);
  });

  it("moves a milestone across lanes", () => {
    const next = moveMilestoneToLane(base, "m1", "Engineering");
    expect(next.milestones[0]?.lane).toBe("Engineering");
  });
});
