"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MilestoneStatus, RoadmapMilestone } from "@/features/workflow/domain/document-data";
import { isBlockedByDependencies, listDependencyEdges } from "../lib/deps";
import {
  barForMilestone,
  buildTimelineRange,
  buildTimelineTicks,
  todayOffsetPx,
  type TimelineZoom,
} from "../lib/timeline-range";

const LANE_WIDTH = 112;
const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 36;
const DRAG_TYPE = "application/x-flowboard-milestone";

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
  canEdit,
  onSelect,
  onMoveToLane,
}: {
  lanes: string[];
  milestones: RoadmapMilestone[];
  zoom: TimelineZoom;
  selectedId: string | null;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onMoveToLane: (milestoneId: string, lane: string) => void;
}) {
  const t = useTranslations("roadmap");
  const locale = useLocale();
  const [dropLane, setDropLane] = useState<string | null>(null);

  const range = useMemo(() => buildTimelineRange(milestones, zoom), [milestones, zoom]);
  const ticks = useMemo(() => buildTimelineTicks(range, zoom, locale), [locale, range, zoom]);
  const todayX = useMemo(() => todayOffsetPx(range), [range]);
  const edges = useMemo(() => listDependencyEdges(milestones), [milestones]);

  const laneIndex = useMemo(() => {
    const map = new Map<string, number>();
    lanes.forEach((lane, index) => map.set(lane, index));
    return map;
  }, [lanes]);

  const bodyHeight = lanes.length * ROW_HEIGHT;

  const edgePaths = useMemo(() => {
    return edges.flatMap((edge) => {
      const from = milestones.find((item) => item.id === edge.fromId);
      const to = milestones.find((item) => item.id === edge.toId);
      if (!from || !to) {
        return [];
      }
      const fromLane = laneIndex.get(from.lane);
      const toLane = laneIndex.get(to.lane);
      if (fromLane === undefined || toLane === undefined) {
        return [];
      }
      const fromBar = barForMilestone(from, range);
      const toBar = barForMilestone(to, range);
      const x1 = fromBar.left;
      const y1 = fromLane * ROW_HEIGHT + ROW_HEIGHT / 2;
      const x2 = toBar.left + toBar.width;
      const y2 = toLane * ROW_HEIGHT + ROW_HEIGHT / 2;
      const midX = (x1 + x2) / 2;
      return [
        {
          key: `${edge.fromId}-${edge.toId}`,
          d: `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`,
        },
      ];
    });
  }, [edges, laneIndex, milestones, range]);

  return (
    <div className="border-border/70 bg-background/70 max-h-[min(42vh,22rem)] min-h-[12rem] overflow-auto rounded-xl border md:max-h-[min(50vh,28rem)] md:min-h-[16rem]">
      <div className="sticky top-0 z-20 flex min-w-max border-b border-border/60 bg-muted/80 backdrop-blur">
        <div
          className="border-border/60 bg-muted/90 sticky left-0 z-30 shrink-0 border-r px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          style={{ width: LANE_WIDTH, height: HEADER_HEIGHT }}
        >
          {t("lane")}
        </div>
        <div className="relative" style={{ width: range.widthPx, height: HEADER_HEIGHT }}>
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

      <div className="relative min-w-max">
        <div
          className="pointer-events-none absolute top-0 z-[5]"
          style={{ left: LANE_WIDTH, width: range.widthPx, height: bodyHeight }}
        >
          <svg width={range.widthPx} height={bodyHeight} className="overflow-visible">
            <defs>
              <marker id="dep-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#0f766e" />
              </marker>
            </defs>
            {edgePaths.map((edge) => (
              <path
                key={edge.key}
                d={edge.d}
                fill="none"
                stroke="#0f766e"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                markerEnd="url(#dep-arrow)"
                opacity="0.75"
              />
            ))}
          </svg>
        </div>

        {lanes.map((lane) => {
          const laneItems = milestones.filter((item) => item.lane === lane);
          const isDropTarget = dropLane === lane;
          return (
            <div
              key={lane}
              className={`flex min-w-max border-b border-border/40 last:border-b-0 ${isDropTarget ? "bg-teal-700/10" : ""}`}
              onDragOver={(event) => {
                if (!canEdit) {
                  return;
                }
                event.preventDefault();
                setDropLane(lane);
              }}
              onDragLeave={() => {
                setDropLane((current) => (current === lane ? null : current));
              }}
              onDrop={(event) => {
                if (!canEdit) {
                  return;
                }
                event.preventDefault();
                const milestoneId = event.dataTransfer.getData(DRAG_TYPE);
                if (milestoneId) {
                  onMoveToLane(milestoneId, lane);
                }
                setDropLane(null);
              }}
            >
              <div
                className="border-border/60 bg-background/95 sticky left-0 z-10 flex shrink-0 items-center border-r px-2 text-xs font-medium"
                style={{ width: LANE_WIDTH, height: ROW_HEIGHT }}
              >
                <span className="truncate">{lane}</span>
              </div>
              <div className="relative z-[1]" style={{ width: range.widthPx, height: ROW_HEIGHT }}>
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
                  const blocked = isBlockedByDependencies(milestone, milestones);
                  return (
                    <button
                      key={milestone.id}
                      type="button"
                      draggable={canEdit}
                      title={`${milestone.title} (${milestone.startDate} → ${milestone.endDate})${blocked ? ` — ${t("blocked")}` : ""}`}
                      className={`absolute top-3 h-8 cursor-grab truncate rounded px-2 text-left text-[11px] font-medium text-white shadow-sm transition-opacity active:cursor-grabbing ${BAR_CLASS[milestone.status]} ${selected ? "ring-2 ring-offset-1 ring-teal-900 ring-offset-background" : "hover:opacity-90"} ${blocked ? "outline outline-1 outline-amber-400" : ""}`}
                      style={{ left: bar.left, width: bar.width }}
                      onClick={() => onSelect(milestone.id)}
                      onDragStart={(event) => {
                        if (!canEdit) {
                          return;
                        }
                        event.dataTransfer.setData(DRAG_TYPE, milestone.id);
                        event.dataTransfer.effectAllowed = "move";
                        onSelect(milestone.id);
                      }}
                      onDragEnd={() => setDropLane(null)}
                    >
                      {blocked ? `! ${milestone.title}` : milestone.title}
                    </button>
                  );
                })}
                {laneItems.length === 0 ? (
                  <p className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center px-3 text-[11px]">
                    {isDropTarget ? t("dropHere") : t("emptyLane")}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
