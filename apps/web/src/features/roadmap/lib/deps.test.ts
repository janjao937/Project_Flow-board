import { describe, expect, it } from "vitest";
import {
  isBlockedByDependencies,
  setDependsOn,
  toggleDependsOn,
  toggleLinkedCard,
  wouldCreateCycle,
} from "./deps";
import type { RoadmapMilestone } from "@/features/workflow/domain/document-data";

function milestone(partial: Partial<RoadmapMilestone> & { id: string }): RoadmapMilestone {
  return {
    title: partial.title ?? partial.id,
    date: "2026-07-01",
    startDate: "2026-07-01",
    endDate: "2026-07-02",
    status: "planned",
    lane: "Product",
    dependsOn: [],
    linkedCardIds: [],
    ...partial,
  };
}

describe("roadmap deps", () => {
  it("detects a direct cycle", () => {
    const milestones = [
      milestone({ id: "a", dependsOn: ["b"] }),
      milestone({ id: "b", dependsOn: [] }),
    ];
    expect(wouldCreateCycle(milestones, "b", ["a"])).toBe(true);
  });

  it("detects an indirect cycle", () => {
    const milestones = [
      milestone({ id: "a", dependsOn: ["b"] }),
      milestone({ id: "b", dependsOn: ["c"] }),
      milestone({ id: "c", dependsOn: [] }),
    ];
    expect(wouldCreateCycle(milestones, "c", ["a"])).toBe(true);
  });

  it("rejects cyclic setDependsOn", () => {
    const milestones = [
      milestone({ id: "a", dependsOn: ["b"] }),
      milestone({ id: "b", dependsOn: [] }),
    ];
    const result = setDependsOn(milestones, "b", ["a"]);
    expect(result.rejected).toBe(true);
    expect(result.milestones[1]?.dependsOn).toEqual([]);
  });

  it("toggles dependencies and linked cards", () => {
    const milestones = [milestone({ id: "a" }), milestone({ id: "b" })];
    const withDep = toggleDependsOn(milestones, "a", "b");
    expect(withDep.rejected).toBe(false);
    expect(withDep.milestones[0]?.dependsOn).toEqual(["b"]);
    const withCard = toggleLinkedCard(withDep.milestones, "a", "card-1");
    expect(withCard[0]?.linkedCardIds).toEqual(["card-1"]);
  });

  it("marks blocked when dependency is not done", () => {
    const milestones = [
      milestone({ id: "a", dependsOn: ["b"], status: "active" }),
      milestone({ id: "b", status: "planned" }),
    ];
    expect(isBlockedByDependencies(milestones[0]!, milestones)).toBe(true);
  });
});
