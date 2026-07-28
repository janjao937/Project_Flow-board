import { describe, expect, it } from "vitest";
import { barForMilestone, buildTimelineRange, buildTimelineTicks, todayOffsetPx } from "./timeline-range";
import type { RoadmapMilestone } from "@/features/workflow/domain/document-data";

const sample: RoadmapMilestone[] = [
  {
    id: "a",
    title: "A",
    date: "2026-07-01",
    startDate: "2026-07-01",
    endDate: "2026-07-03",
    status: "planned",
    lane: "Product",
    dependsOn: [],
    linkedCardIds: [],
  },
  {
    id: "b",
    title: "B",
    date: "2026-07-10",
    startDate: "2026-07-10",
    endDate: "2026-07-12",
    status: "active",
    lane: "Engineering",
    dependsOn: [],
    linkedCardIds: [],
  },
];

describe("timeline-range", () => {
  it("builds a padded range wide enough for month zoom", () => {
    const range = buildTimelineRange(sample, "month", 2);
    expect(range.start <= "2026-07-01").toBe(true);
    expect(range.end >= "2026-07-12").toBe(true);
    expect(range.widthPx).toBe(range.dayCount * range.pxPerDay);
  });

  it("positions bars inside the track", () => {
    const range = buildTimelineRange(sample, "week", 0);
    const bar = barForMilestone(sample[0]!, range);
    expect(bar.left).toBeGreaterThanOrEqual(0);
    expect(bar.left + bar.width).toBeLessThanOrEqual(range.widthPx);
    expect(bar.width).toBeGreaterThan(0);
  });

  it("returns today marker when in range", () => {
    const today = new Date().toISOString().slice(0, 10);
    const range = buildTimelineRange(
      [
        {
          ...sample[0]!,
          startDate: today,
          endDate: today,
          date: today,
        },
      ],
      "week",
      5,
    );
    expect(todayOffsetPx(range)).not.toBeNull();
  });

  it("builds readable ticks for month zoom", () => {
    const range = buildTimelineRange(sample, "month", 2);
    const ticks = buildTimelineTicks(range, "month", "en");
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks[0]?.label.length).toBeGreaterThan(0);
  });
});
