import { describe, expect, it } from "vitest";
import { normalizeMilestone, normalizeRoadmap, sortMilestones } from "./normalize";

describe("roadmap normalize", () => {
  it("migrates legacy date-only milestones", () => {
    const milestone = normalizeMilestone({
      id: "m1",
      title: "Kickoff",
      date: "2026-01-10",
      lane: "Product",
    });
    expect(milestone.startDate).toBe("2026-01-10");
    expect(milestone.endDate).toBe("2026-01-10");
    expect(milestone.status).toBe("planned");
    expect(milestone.date).toBe("2026-01-10");
  });

  it("keeps endDate after startDate", () => {
    const milestone = normalizeMilestone({
      id: "m2",
      startDate: "2026-02-01",
      endDate: "2026-01-01",
    });
    expect(milestone.endDate).toBe("2026-02-01");
  });

  it("normalizes empty roadmap lanes", () => {
    const roadmap = normalizeRoadmap({ milestones: [], lanes: [] });
    expect(roadmap.lanes).toEqual(["Product"]);
  });

  it("sorts milestones by start then end date", () => {
    const sorted = sortMilestones([
      normalizeMilestone({ id: "b", startDate: "2026-07-10", endDate: "2026-07-12" }),
      normalizeMilestone({ id: "a", startDate: "2026-07-01", endDate: "2026-07-20" }),
      normalizeMilestone({ id: "c", startDate: "2026-07-01", endDate: "2026-07-02" }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["c", "a", "b"]);
  });
});
