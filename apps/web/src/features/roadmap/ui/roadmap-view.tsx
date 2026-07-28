"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RoadmapState } from "@/features/workflow/domain/document-data";
import { useSessionStore } from "@/features/join/store/session-store";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";

const EMPTY_ROADMAP: RoadmapState = { milestones: [], lanes: [] };
const EMPTY_TASKS_MAP: Record<string, never> = {};

export function RoadmapView({ pageId }: { pageId: string }) {
  const t = useTranslations("roadmap");
  const roadmap = useWorkflowStore((s) => s.data?.roadmaps[pageId] ?? EMPTY_ROADMAP);
  const tasksByPage = useWorkflowStore((s) => s.data?.tasks ?? EMPTY_TASKS_MAP);
  const updateRoadmap = useWorkflowStore((s) => s.updateRoadmap);
  const canEdit = useSessionStore((s) => (s.sessionId ? s.canEdit : true));

  const allCards = useMemo(() => {
    return Object.values(tasksByPage).flatMap((tasks) =>
      Object.values(tasks.cards).map((card) => ({ id: card.id, title: card.title })),
    );
  }, [tasksByPage]);

  const sorted = useMemo(
    () => [...roadmap.milestones].sort((a, b) => a.date.localeCompare(b.date)),
    [roadmap.milestones],
  );

  const minDate = sorted[0]?.date ?? new Date().toISOString().slice(0, 10);
  const maxDate = sorted[sorted.length - 1]?.date ?? minDate;
  const spanMs = Math.max(1, new Date(maxDate).getTime() - new Date(minDate).getTime());

  const positionFor = (date: string) => {
    const ratio = (new Date(date).getTime() - new Date(minDate).getTime()) / spanMs;
    return `${Math.min(95, Math.max(2, ratio * 90 + 2))}%`;
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-auto p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button
          size="sm"
          disabled={!canEdit}
          onClick={() => {
            updateRoadmap(pageId, (current) => ({
              ...current,
              milestones: [
                ...current.milestones,
                {
                  id: crypto.randomUUID(),
                  title: t("milestone"),
                  date: new Date().toISOString().slice(0, 10),
                  lane: current.lanes[0] ?? "Product",
                  dependsOn: [],
                  linkedCardIds: [],
                },
              ],
            }));
          }}
        >
          {t("addMilestone")}
        </Button>
      </div>

      <div className="border-border/70 bg-background/60 relative min-h-[320px] overflow-x-auto rounded-xl border p-4">
        <div className="bg-border absolute inset-x-8 top-1/2 h-px" />
        {roadmap.lanes.map((lane, laneIndex) => (
          <div key={lane} className="relative mb-10 last:mb-0" style={{ minHeight: 72 }}>
            <div className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">{lane}</div>
            {sorted
              .filter((item) => item.lane === lane)
              .map((milestone) => (
                <article
                  key={milestone.id}
                  className="border-border bg-card absolute w-52 -translate-x-1/2 rounded-lg border p-3 shadow-sm"
                  style={{ left: positionFor(milestone.date), top: laneIndex === 0 ? 28 : 28 }}
                >
                  <Input
                    value={milestone.title}
                    disabled={!canEdit}
                    aria-label={t("milestone")}
                    className="mb-2 h-8 border-0 bg-transparent px-0 font-medium shadow-none focus-visible:ring-0"
                    onChange={(event) => {
                      const title = event.target.value;
                      updateRoadmap(pageId, (current) => ({
                        ...current,
                        milestones: current.milestones.map((item) =>
                          item.id === milestone.id ? { ...item, title } : item,
                        ),
                      }));
                    }}
                  />
                  <Input
                    type="date"
                    value={milestone.date}
                    disabled={!canEdit}
                    aria-label={t("date")}
                    className="mb-2 h-8"
                    onChange={(event) => {
                      const date = event.target.value;
                      updateRoadmap(pageId, (current) => ({
                        ...current,
                        milestones: current.milestones.map((item) =>
                          item.id === milestone.id ? { ...item, date } : item,
                        ),
                      }));
                    }}
                  />
                  <label className="text-muted-foreground mb-1 block text-[11px]">{t("dependsOn")}</label>
                  <select
                    className="border-input bg-background mb-2 h-8 w-full rounded-md border px-2 text-xs"
                    disabled={!canEdit}
                    value={milestone.dependsOn[0] ?? ""}
                    onChange={(event) => {
                      const dependsOn = event.target.value ? [event.target.value] : [];
                      updateRoadmap(pageId, (current) => ({
                        ...current,
                        milestones: current.milestones.map((item) =>
                          item.id === milestone.id ? { ...item, dependsOn } : item,
                        ),
                      }));
                    }}
                  >
                    <option value="">{t("none")}</option>
                    {roadmap.milestones
                      .filter((item) => item.id !== milestone.id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                  </select>
                  <label className="text-muted-foreground mb-1 block text-[11px]">{t("linkedCards")}</label>
                  <select
                    className="border-input bg-background h-8 w-full rounded-md border px-2 text-xs"
                    disabled={!canEdit || allCards.length === 0}
                    value={milestone.linkedCardIds[0] ?? ""}
                    onChange={(event) => {
                      const linkedCardIds = event.target.value ? [event.target.value] : [];
                      updateRoadmap(pageId, (current) => ({
                        ...current,
                        milestones: current.milestones.map((item) =>
                          item.id === milestone.id ? { ...item, linkedCardIds } : item,
                        ),
                      }));
                    }}
                  >
                    <option value="">{allCards.length === 0 ? t("noCards") : t("none")}</option>
                    {allCards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.title}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
          </div>
        ))}
        {sorted.map((milestone) => {
          const depId = milestone.dependsOn[0];
          if (!depId) {
            return null;
          }
          const dep = roadmap.milestones.find((item) => item.id === depId);
          if (!dep) {
            return null;
          }
          return (
            <svg key={`${milestone.id}-dep`} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
              <line
                x1={positionFor(dep.date)}
                y1="50%"
                x2={positionFor(milestone.date)}
                y2="50%"
                stroke="#0f766e"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            </svg>
          );
        })}
      </div>
    </div>
  );
}
