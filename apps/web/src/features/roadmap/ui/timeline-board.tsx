"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MilestoneStatus, RoadmapMilestone } from "@/features/workflow/domain/document-data";
import {
  barForMilestone,
  buildTimelineRange,
  buildTimelineTicks,
  todayOffsetPx,
  type TimelineZoom,
} from "../lib/timeline-range";

const LANE_WIDTH = 112;
const ROW_HEIGHT = 56;

const BAR_CLASS: Record<MilestoneStatus, string> = {
  planned: "bg-slate-500/80",
  active: "bg-teal-700",
  done: "bg-emerald-600",
};

export function TimelineBoard({
  lanes,
  milestones,
  zoom,
  selectedId,
  onSelect,
}: {
  lanes: string[];
  milestones: RoadmapMilestone[];
  zoom: TimelineZoom;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("roadmap");
  const locale = useLocale();

  const range = useMemo(() => buildTimelineRange(milestones, zoom), [milestones, zoom]);
  const ticks = useMemo(() => buildTimelineTicks(range, zoom, locale), [locale, range, zoom]);
  const todayX = useMemo(() => todayOffsetPx(range), [range]);

  return (
    <div className="border-border/70 bg-background/70 max-h-[min(50vh,28rem)] min-h-[16rem] overflow-auto rounded-xl border">
      <div className="sticky top-0 z-20 flex min-w-max border-b border-border/60 bg-muted/80 backdrop-blur">
        <div
          className="border-border/60 bg-muted/90 sticky left-0 z-30 shrink-0 border-r px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          style={{ width: LANE_WIDTH }}
        >
          {t("lane")}
        </div>
        <div className="relative h-9" style={{ width: range.widthPx }}>
          {ticks.map((tick) => (
            <div
              key={tick.date}
              className="absolute top-0 h-full border-l border-border/50 px-1 pt-2 text-[10px] text-muted-foreground"
              style={{ left: tick.left }}
            >
              {tick.label}
            </div>
          ))}
        </div>
      </div>

      {lanes.map((lane) => {
        const laneItems = milestones.filter((item) => item.lane === lane);
        return (
          <div key={lane} className="flex min-w-max border-b border-border/40 last:border-b-0">
            <div
              className="border-border/60 bg-background/95 sticky left-0 z-10 flex shrink-0 items-center border-r px-2 text-xs font-medium"
              style={{ width: LANE_WIDTH, height: ROW_HEIGHT }}
            >
              <span className="truncate">{lane}</span>
            </div>
            <div className="relative" style={{ width: range.widthPx, height: ROW_HEIGHT }}>
              <div className="pointer-events-none absolute inset-0 opacity-40">
                {ticks.map((tick) => (
                  <div
                    key={`${lane}-${tick.date}`}
                    className="absolute top-0 h-full border-l border-border/30"
                    style={{ left: tick.left }}
                  />
                ))}
              </div>
              {todayX !== null ? (
                <div
                  className="pointer-events-none absolute top-0 z-10 h-full w-px bg-amber-500/80"
                  style={{ left: todayX }}
                />
              ) : null}
              {laneItems.map((milestone) => {
                const bar = barForMilestone(milestone, range);
                const selected = selectedId === milestone.id;
                return (
                  <button
                    key={milestone.id}
                    type="button"
                    title={`${milestone.title} (${milestone.startDate} → ${milestone.endDate})`}
                    className={`absolute top-3 h-8 truncate rounded px-2 text-left text-[11px] font-medium text-white shadow-sm transition-opacity ${BAR_CLASS[milestone.status]} ${selected ? "ring-2 ring-offset-1 ring-teal-900 ring-offset-background" : "hover:opacity-90"}`}
                    style={{ left: bar.left, width: bar.width }}
                    onClick={() => onSelect(milestone.id)}
                  >
                    {milestone.title}
                  </button>
                );
              })}
              {laneItems.length === 0 ? (
                <p className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center px-3 text-[11px]">
                  {t("emptyLane")}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
