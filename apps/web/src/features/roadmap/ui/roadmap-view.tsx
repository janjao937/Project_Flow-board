"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MilestoneStatus, RoadmapMilestone } from "@/features/workflow/domain/document-data";
import { useSessionStore } from "@/features/join/store/session-store";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";
import {
  isBlockedByDependencies,
  setDependsOn,
  toggleDependsOn,
  toggleLinkedCard,
} from "../lib/deps";
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
  const manifest = useWorkflowStore((s) => s.manifest);
  const tasksByPage = useWorkflowStore((s) => s.data?.tasks ?? EMPTY_TASKS_MAP);
  const updateRoadmap = useWorkflowStore((s) => s.updateRoadmap);
  const setActivePage = useWorkflowStore((s) => s.setActivePage);
  const canEdit = useSessionStore((s) => (s.sessionId ? s.canEdit : true));

  const [zoom, setZoom] = useState<TimelineZoom>("month");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tasksPageId = manifest?.pages.find((page) => page.kind === "tasks")?.id ?? null;

  const allCards = useMemo(() => {
    return Object.values(tasksByPage).flatMap((tasks) =>
      Object.values(tasks.cards).map((card) => ({ id: card.id, title: card.title })),
    );
  }, [tasksByPage]);

  const lanes = ensureLanes(roadmap);
  const sorted = useMemo(() => sortMilestones(roadmap.milestones), [roadmap.milestones]);
  const selected = sorted.find((item) => item.id === selectedId) ?? null;
  const selectedBlocked = selected ? isBlockedByDependencies(selected, roadmap.milestones) : false;

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

  const applyDependencyToggle = (dependencyId: string) => {
    if (!selected) {
      return;
    }
    let rejected = false;
    updateRoadmap(pageId, (current) => {
      const result = toggleDependsOn(current.milestones, selected.id, dependencyId);
      if (result.rejected) {
        rejected = true;
        return current;
      }
      return { ...current, milestones: result.milestones };
    });
    if (rejected) {
      toast.error(t("cycleRejected"));
    }
  };

  const addMilestone = () => {
    const nextLanes = ensureLanes(roadmap);
    const draft = createMilestoneDraft(nextLanes[0] ?? "Product", t("milestone"));
    updateRoadmap(pageId, (current) => ({
      ...current,
      lanes: ensureLanes(current),
      milestones: [...current.milestones, draft],
    }));
    setSelectedId(draft.id);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 md:p-4">
      <div className="flex shrink-0 flex-col gap-2 pr-24 sm:pr-36">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight">{t("title")}</h2>
            <p className="text-muted-foreground text-sm md:truncate">{t("subtitle")}</p>
          </div>
          <div
            className="border-border/60 flex flex-wrap items-center gap-1 rounded-lg border p-0.5"
            role="group"
            aria-label={t("zoomLabel")}
          >
            {(["week", "month", "quarter"] as const).map((level) => (
              <Button
                key={level}
                size="sm"
                variant={zoom === level ? "default" : "ghost"}
                aria-pressed={zoom === level}
                onClick={() => setZoom(level)}
              >
                {t(`zoom.${level}`)}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <Button size="sm" disabled={!canEdit} onClick={addMilestone}>
            {t("addMilestone")}
          </Button>
        </div>
      </div>

      {!canEdit ? (
        <div className="bg-amber-500/15 text-amber-950 dark:text-amber-100 shrink-0 rounded-lg px-3 py-2 text-xs">
          {t("readOnlyHint")}
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <div className="border-border/60 bg-background/50 flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
          <div className="max-w-sm">
            <p className="font-medium">{t("emptyRoadmapTitle")}</p>
            <p className="text-muted-foreground mt-1 text-sm">{t("emptyRoadmapBody")}</p>
          </div>
          <Button size="sm" disabled={!canEdit} onClick={addMilestone}>
            {t("emptyRoadmapCta")}
          </Button>
        </div>
      ) : (
        <>
      <div className="flex shrink-0 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem]">
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
          {canEdit ? <p className="text-muted-foreground text-[11px]">{t("dragHint")}</p> : null}
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
          <div className="border-border/60 text-muted-foreground flex h-full min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center text-sm">
            <div>
              <p className="font-medium text-foreground/80">{t("editorEmptyTitle")}</p>
              <p className="mt-1">{t("selectHint")}</p>
            </div>
            <Button size="sm" disabled={!canEdit} onClick={addMilestone}>
              {t("addMilestone")}
            </Button>
          </div>
        ) : (
          <article className="border-border/70 bg-background/70 mx-auto w-full max-w-xl rounded-xl border p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-medium">{t("editTitle")}</h3>
              <div className="flex items-center gap-1">
                {selectedBlocked ? (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                    {t("blocked")}
                  </span>
                ) : null}
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_CLASS[selected.status]}`}>
                  {t(`status.${selected.status}`)}
                </span>
              </div>
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
            <div className="border-border/60 mb-3 max-h-36 space-y-1 overflow-y-auto rounded-md border p-2">
              {roadmap.milestones.filter((item) => item.id !== selected.id).length === 0 ? (
                <p className="text-muted-foreground text-xs">{t("noDependencies")}</p>
              ) : (
                roadmap.milestones
                  .filter((item) => item.id !== selected.id)
                  .map((item) => {
                    const checked = selected.dependsOn.includes(item.id);
                    return (
                      <label key={item.id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canEdit}
                          onChange={() => applyDependencyToggle(item.id)}
                        />
                        <span className="truncate">{item.title}</span>
                        <span className="text-muted-foreground shrink-0">({t(`status.${item.status}`)})</span>
                      </label>
                    );
                  })
              )}
            </div>
            {selected.dependsOn.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canEdit}
                  onClick={() => {
                    updateRoadmap(pageId, (current) => {
                      const result = setDependsOn(current.milestones, selected.id, []);
                      return { ...current, milestones: result.milestones };
                    });
                  }}
                >
                  {t("clearDependencies")}
                </Button>
              </div>
            ) : null}

            <label className="text-muted-foreground mb-1 block text-[11px]">{t("linkedCards")}</label>
            <div className="border-border/60 mb-3 max-h-36 space-y-1 overflow-y-auto rounded-md border p-2">
              {allCards.length === 0 ? (
                <p className="text-muted-foreground text-xs">{t("noCards")}</p>
              ) : (
                allCards.map((card) => {
                  const checked = selected.linkedCardIds.includes(card.id);
                  return (
                    <div key={card.id} className="flex items-center justify-between gap-2 text-xs">
                      <label className="flex min-w-0 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canEdit}
                          onChange={() => {
                            updateRoadmap(pageId, (current) => ({
                              ...current,
                              milestones: toggleLinkedCard(current.milestones, selected.id, card.id),
                            }));
                          }}
                        />
                        <span className="truncate">{card.title}</span>
                      </label>
                      {tasksPageId ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 shrink-0 px-2"
                          onClick={() => setActivePage(tasksPageId)}
                        >
                          {t("openTasks")}
                        </Button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            <p className="text-muted-foreground mb-3 text-[11px]">
              {t("linkedSelected", { count: selected.linkedCardIds.length })}
            </p>

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
        </>
      )}
    </div>
  );
}
