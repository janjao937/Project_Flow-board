"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlanState } from "@/features/workflow/domain/document-data";
import { useSessionStore } from "@/features/join/store/session-store";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";

const EMPTY_PLAN: PlanState = { boxes: [] };
const EMPTY_TASKS_MAP: Record<string, never> = {};

export function PlanView({ pageId }: { pageId: string }) {
  const t = useTranslations("plan");
  const plan = useWorkflowStore((s) => s.data?.plans[pageId] ?? EMPTY_PLAN);
  const tasksByPage = useWorkflowStore((s) => s.data?.tasks ?? EMPTY_TASKS_MAP);
  const manifest = useWorkflowStore((s) => s.manifest);
  const updatePlan = useWorkflowStore((s) => s.updatePlan);
  const setActivePage = useWorkflowStore((s) => s.setActivePage);
  const canEdit = useSessionStore((s) => (s.sessionId ? s.canEdit : true));

  const allCards = useMemo(() => {
    return Object.values(tasksByPage).flatMap((tasks) =>
      Object.values(tasks.cards).map((card) => ({ id: card.id, title: card.title })),
    );
  }, [tasksByPage]);

  const tasksPageId = manifest?.pages.find((page) => page.kind === "tasks")?.id ?? null;
  const totalCapacity = plan.boxes.reduce((sum, box) => sum + box.capacityHours, 0);

  const addBox = () => {
    const start = new Date();
    const end = new Date(start.getTime() + 1000 * 60 * 60 * 24 * 7);
    updatePlan(pageId, (current) => ({
      boxes: [
        ...current.boxes,
        {
          id: crypto.randomUUID(),
          title: t("box"),
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          linkedCardIds: [],
          capacityHours: 40,
        },
      ],
    }));
  };

  const toggleCard = (boxId: string, cardId: string) => {
    updatePlan(pageId, (current) => ({
      boxes: current.boxes.map((item) => {
        if (item.id !== boxId) {
          return item;
        }
        const linked = item.linkedCardIds.includes(cardId)
          ? item.linkedCardIds.filter((id) => id !== cardId)
          : [...item.linkedCardIds, cardId];
        return { ...item, linkedCardIds: linked };
      }),
    }));
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-auto p-3 pr-24 md:p-4 md:pr-36">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground text-sm">
            {t("capacityTotal")}: <span className="text-foreground font-medium">{totalCapacity}h</span>
          </div>
          <Button size="sm" disabled={!canEdit} onClick={addBox}>
            {t("addBox")}
          </Button>
        </div>
      </div>

      {plan.boxes.length === 0 ? (
        <div className="border-border/60 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <div className="max-w-sm">
            <p className="font-medium">{t("emptyTitle")}</p>
            <p className="text-muted-foreground mt-1 text-sm">{t("emptyBody")}</p>
          </div>
          <Button size="sm" disabled={!canEdit} onClick={addBox}>
            {t("emptyCta")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plan.boxes.map((box) => (
            <article key={box.id} className="border-border/70 bg-background/70 rounded-xl border p-4">
              <Input
                value={box.title}
                disabled={!canEdit}
                aria-label={t("box")}
                className="mb-3 border-0 bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0"
                onChange={(event) => {
                  const title = event.target.value;
                  updatePlan(pageId, (current) => ({
                    boxes: current.boxes.map((item) => (item.id === box.id ? { ...item, title } : item)),
                  }));
                }}
              />
              <div className="mb-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-muted-foreground mb-1 block text-[11px]">{t("start")}</label>
                  <Input
                    type="date"
                    value={box.startDate}
                    disabled={!canEdit}
                    onChange={(event) => {
                      const startDate = event.target.value;
                      updatePlan(pageId, (current) => ({
                        boxes: current.boxes.map((item) => (item.id === box.id ? { ...item, startDate } : item)),
                      }));
                    }}
                  />
                </div>
                <div>
                  <label className="text-muted-foreground mb-1 block text-[11px]">{t("end")}</label>
                  <Input
                    type="date"
                    value={box.endDate}
                    disabled={!canEdit}
                    onChange={(event) => {
                      const endDate = event.target.value;
                      updatePlan(pageId, (current) => ({
                        boxes: current.boxes.map((item) => (item.id === box.id ? { ...item, endDate } : item)),
                      }));
                    }}
                  />
                </div>
              </div>
              <label className="text-muted-foreground mb-1 block text-[11px]">{t("capacity")}</label>
              <Input
                type="number"
                min={0}
                value={box.capacityHours}
                disabled={!canEdit}
                className="mb-3"
                onChange={(event) => {
                  const capacityHours = Number(event.target.value) || 0;
                  updatePlan(pageId, (current) => ({
                    boxes: current.boxes.map((item) => (item.id === box.id ? { ...item, capacityHours } : item)),
                  }));
                }}
              />
              <label className="text-muted-foreground mb-1 block text-[11px]">{t("linkedCards")}</label>
              {allCards.length === 0 ? (
                <div className="border-border/60 mb-3 rounded-md border border-dashed px-3 py-3 text-xs">
                  <p className="text-muted-foreground">{t("noCards")}</p>
                  {tasksPageId ? (
                    <Button
                      className="mt-2"
                      size="sm"
                      variant="ghost"
                      onClick={() => setActivePage(tasksPageId)}
                    >
                      {t("openTasks")}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="border-border/60 mb-3 max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                  {allCards.map((card) => {
                    const checked = box.linkedCardIds.includes(card.id);
                    return (
                      <label key={card.id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canEdit}
                          onChange={() => toggleCard(box.id, card.id)}
                        />
                        <span className="truncate">{card.title}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-muted-foreground mb-3 text-[11px]">
                {t("linkedSelected", { count: box.linkedCardIds.length })}
              </p>
              <Button
                size="sm"
                variant="ghost"
                disabled={!canEdit}
                onClick={() => {
                  updatePlan(pageId, (current) => ({
                    boxes: current.boxes.filter((item) => item.id !== box.id),
                  }));
                }}
              >
                {t("remove")}
              </Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
