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
  const updatePlan = useWorkflowStore((s) => s.updatePlan);
  const canEdit = useSessionStore((s) => (s.sessionId ? s.canEdit : true));

  const allCards = useMemo(() => {
    return Object.values(tasksByPage).flatMap((tasks) =>
      Object.values(tasks.cards).map((card) => ({ id: card.id, title: card.title })),
    );
  }, [tasksByPage]);

  const totalCapacity = plan.boxes.reduce((sum, box) => sum + box.capacityHours, 0);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-auto p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground text-sm">
            {t("capacityTotal")}: <span className="text-foreground font-medium">{totalCapacity}h</span>
          </div>
          <Button
            size="sm"
            disabled={!canEdit}
            onClick={() => {
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
            }}
          >
            {t("addBox")}
          </Button>
        </div>
      </div>

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
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              disabled={!canEdit || allCards.length === 0}
              value={box.linkedCardIds[0] ?? ""}
              onChange={(event) => {
                const linkedCardIds = event.target.value ? [event.target.value] : [];
                updatePlan(pageId, (current) => ({
                  boxes: current.boxes.map((item) => (item.id === box.id ? { ...item, linkedCardIds } : item)),
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
            <Button
              className="mt-3"
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
    </div>
  );
}
