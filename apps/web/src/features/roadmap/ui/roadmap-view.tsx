"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MilestoneStatus, RoadmapMilestone } from "@/features/workflow/domain/document-data";
import { useSessionStore } from "@/features/join/store/session-store";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";
import {
  addLane,
  ensureLanes,
  moveLane,
  moveMilestoneToLane,
  removeLane,
  renameLane,
} from "../lib/lanes";
import {
  EMPTY_ROADMAP,
  MILESTONE_STATUSES,
  createMilestoneDraft,
  normalizeMilestone,
  sortMilestones,
} from "../lib/normalize";
import type { TimelineZoom } from "../lib/timeline-range";
import { LaneManager } from "./lane-manager";
import { TimelineBoard } from "./timeline-board";

const EMPTY_TASKS_MAP: Record<string, never> = {};

const STATUS_CLASS: Record<MilestoneStatus, string> = {
  planned: "bg-slate-500/15 text-slate-700 dark:text-slate-200",
  active: "bg-teal-700/15 text-teal-800 dark:text-teal-200",
  done: "bg-emerald-600/15 text-emerald-800 dark:text-emerald-200",
};

export function RoadmapView({ pageId }: { pageId: string }) {
  const t = useTranslations("roadmap");
  const roadmap = useWorkflowStore((s) => s.data?.roadmaps[pageId] ?? EMPTY_ROADMAP);
  const tasksByPage = useWorkflowStore((s) => s.data?.tasks ?? EMPTY_TASKS_MAP);
  const updateRoadmap = useWorkflowStore((s) => s.updateRoadmap);
  const canEdit = useSessionStore((s) => (s.sessionId ? s.canEdit : true));

  const [zoom, setZoom] = useState<TimelineZoom>("month");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allCards = useMemo(() => {
    return Object.values(tasksByPage).flatMap((tasks) =>
      Object.values(tasks.cards).map((card) => ({ id: card.id, title: card.title })),
    );
  }, [tasksByPage]);

  const lanes = ensureLanes(roadmap);
  const sorted = useMemo(() => sortMilestones(roadmap.milestones), [roadmap.milestones]);
  const selected = sorted.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && !roadmap.milestones.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [roadmap.milestones, selectedId]);

  const patchMilestone = (milestoneId: string, patch: Partial<RoadmapMilestone>) => {
    updateRoadmap(pageId, (current) => ({
      ...current,
      milestones: current.milestones.map((item) => {
        if (item.id !== milestoneId) {
          return item;
        }
        const next = { ...item, ...patch };
        if (patch.startDate && !patch.date) {
          next.date = patch.startDate;
        }
        if (patch.startDate && patch.endDate && patch.endDate < patch.startDate) {
          next.endDate = patch.startDate;
        }
        if (patch.startDate && !patch.endDate && next.endDate < patch.startDate) {
          next.endDate = patch.startDate;
        }
        return normalizeMilestone(next);
      }),
    }));
  };

  const applyLaneUpdate = (updater: (current: typeof roadmap) => typeof roadmap) => {
    updateRoadmap(pageId, (current) => updater(current));
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 md:p-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground truncate text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {(["week", "month", "quarter"] as const).map((level) => (
            <Button
              key={level}
              size="sm"
              variant={zoom === level ? "default" : "ghost"}
              onClick={() => setZoom(level)}
            >
              {t(`zoom.${level}`)}
            </Button>
          ))}
          <Button
            size="sm"
            disabled={!canEdit}
            onClick={() => {
              updateRoadmap(pageId, (current) => {
                const nextLanes = ensureLanes(current);
                const draft = createMilestoneDraft(nextLanes[0] ?? "Product", t("milestone"));
                setSelectedId(draft.id);
                return {
                  ...current,
                  lanes: nextLanes,
                  milestones: [...current.milestones, draft],
                };
              });
            }}
          >
            {t("addMilestone")}
          </Button>
        </div>
      </div>

      <div className="grid shrink-0 gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <TimelineBoard
            lanes={lanes}
            milestones={sorted}
            zoom={zoom}
            selectedId={selectedId}
            canEdit={canEdit}
            onSelect={setSelectedId}
            onMoveToLane={(milestoneId, lane) => {
              applyLaneUpdate((current) => moveMilestoneToLane(current, milestoneId, lane));
            }}
          />
          <p className="text-muted-foreground mt-1 text-[11px]">{t("timelineHint")}</p>
          <p className="text-muted-foreground text-[11px]">{t("dragHint")}</p>
        </div>
        <LaneManager
          lanes={lanes}
          canEdit={canEdit}
          onAdd={(name) => applyLaneUpdate((current) => addLane(current, name))}
          onRename={(from, to) => applyLaneUpdate((current) => renameLane(current, from, to))}
          onRemove={(name) => applyLaneUpdate((current) => removeLane(current, name))}
          onMove={(name, direction) => applyLaneUpdate((current) => moveLane(current, name, direction))}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        {!selected ? (
          <div className="border-border/60 text-muted-foreground flex h-full min-h-40 items-center justify-center rounded-xl border border-dashed px-4 text-sm">
            {t("selectHint")}
          </div>
        ) : (
          <article className="border-border/70 bg-background/70 mx-auto w-full max-w-xl rounded-xl border p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-medium">{t("editTitle")}</h3>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_CLASS[selected.status]}`}>
                {t(`status.${selected.status}`)}
              </span>
            </div>

            <Input
              value={selected.title}
              disabled={!canEdit}
              aria-label={t("milestone")}
              className="mb-3 h-9"
              onChange={(event) => patchMilestone(selected.id, { title: event.target.value })}
            />

            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className="text-muted-foreground mb-1 block text-[11px]">{t("startDate")}</label>
                <Input
                  type="date"
                  value={selected.startDate}
                  disabled={!canEdit}
                  className="h-8"
                  onChange={(event) =>
                    patchMilestone(selected.id, { startDate: event.target.value, date: event.target.value })
                  }
                />
              </div>
              <div className="min-w-0">
                <label className="text-muted-foreground mb-1 block text-[11px]">{t("endDate")}</label>
                <Input
                  type="date"
                  value={selected.endDate}
                  disabled={!canEdit}
                  className="h-8"
                  onChange={(event) => patchMilestone(selected.id, { endDate: event.target.value })}
                />
              </div>
            </div>

            <label className="text-muted-foreground mb-1 block text-[11px]">{t("statusLabel")}</label>
            <select
              className="border-input bg-background mb-3 h-8 w-full rounded-md border px-2 text-xs"
              disabled={!canEdit}
              value={selected.status}
              onChange={(event) =>
                patchMilestone(selected.id, { status: event.target.value as MilestoneStatus })
              }
            >
              {MILESTONE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`status.${status}`)}
                </option>
              ))}
            </select>

            <label className="text-muted-foreground mb-1 block text-[11px]">{t("lane")}</label>
            <select
              className="border-input bg-background mb-3 h-8 w-full rounded-md border px-2 text-xs"
              disabled={!canEdit}
              value={selected.lane}
              onChange={(event) => {
                applyLaneUpdate((current) => moveMilestoneToLane(current, selected.id, event.target.value));
              }}
            >
              {lanes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <div className="mb-3 flex flex-wrap gap-1">
              {lanes
                .filter((lane) => lane !== selected.lane)
                .map((lane) => (
                  <Button
                    key={lane}
                    size="sm"
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() => applyLaneUpdate((current) => moveMilestoneToLane(current, selected.id, lane))}
                  >
                    {t("moveToLane", { lane })}
                  </Button>
                ))}
            </div>

            <label className="text-muted-foreground mb-1 block text-[11px]">{t("dependsOn")}</label>
            <select
              className="border-input bg-background mb-3 h-8 w-full rounded-md border px-2 text-xs"
              disabled={!canEdit}
              value={selected.dependsOn[0] ?? ""}
              onChange={(event) =>
                patchMilestone(selected.id, {
                  dependsOn: event.target.value ? [event.target.value] : [],
                })
              }
            >
              <option value="">{t("none")}</option>
              {roadmap.milestones
                .filter((item) => item.id !== selected.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
            </select>

            <label className="text-muted-foreground mb-1 block text-[11px]">{t("linkedCards")}</label>
            <select
              className="border-input bg-background mb-3 h-8 w-full rounded-md border px-2 text-xs"
              disabled={!canEdit || allCards.length === 0}
              value={selected.linkedCardIds[0] ?? ""}
              onChange={(event) =>
                patchMilestone(selected.id, {
                  linkedCardIds: event.target.value ? [event.target.value] : [],
                })
              }
            >
              <option value="">{allCards.length === 0 ? t("noCards") : t("none")}</option>
              {allCards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.title}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
                {t("closeEditor")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!canEdit}
                onClick={() => {
                  updateRoadmap(pageId, (current) => ({
                    ...current,
                    milestones: current.milestones
                      .filter((item) => item.id !== selected.id)
                      .map((item) => ({
                        ...item,
                        dependsOn: item.dependsOn.filter((id) => id !== selected.id),
                      })),
                  }));
                  setSelectedId(null);
                }}
              >
                {t("remove")}
              </Button>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
