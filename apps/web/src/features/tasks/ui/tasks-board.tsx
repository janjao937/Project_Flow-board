"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TasksState } from "@/features/workflow/domain/document-data";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";

const EMPTY_TASKS: TasksState = { lists: [], cards: {}, labels: [] };

export function TasksBoard({ pageId }: { pageId: string }) {
  const t = useTranslations("tasks");
  const tasks = useWorkflowStore((s) => s.data?.tasks[pageId] ?? EMPTY_TASKS);
  const updateTasks = useWorkflowStore((s) => s.updateTasks);

  return (
    <div className="flex h-full min-h-0 flex-1 gap-3 overflow-x-auto p-3 md:p-4">
      {tasks.lists.map((list) => (
        <section
          key={list.id}
          className="border-border/70 bg-background/70 flex w-72 shrink-0 flex-col rounded-xl border p-3 backdrop-blur"
        >
          <Input
            value={list.title}
            aria-label={t("listTitle")}
            className="mb-3 border-0 bg-transparent text-base font-semibold shadow-none focus-visible:ring-0"
            onChange={(event) => {
              const title = event.target.value;
              updateTasks(pageId, (current) => ({
                ...current,
                lists: current.lists.map((item) => (item.id === list.id ? { ...item, title } : item)),
              }));
            }}
          />
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {list.cardIds.map((cardId) => {
              const card = tasks.cards[cardId];
              if (!card) {
                return null;
              }
              return (
                <article key={card.id} className="border-border/60 bg-card rounded-lg border p-3 shadow-sm">
                  <Input
                    value={card.title}
                    aria-label={t("cardTitle")}
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    onChange={(event) => {
                      const title = event.target.value;
                      updateTasks(pageId, (current) => ({
                        ...current,
                        cards: {
                          ...current.cards,
                          [card.id]: { ...card, title },
                        },
                      }));
                    }}
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {card.labelIds.map((labelId) => {
                      const label = tasks.labels.find((item) => item.id === labelId);
                      if (!label) {
                        return null;
                      }
                      return (
                        <span
                          key={label.id}
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: label.color }}
                        >
                          {label.name}
                        </span>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
          <Button
            className="mt-3"
            variant="ghost"
            size="sm"
            onClick={() => {
              const id = crypto.randomUUID();
              updateTasks(pageId, (current) => ({
                ...current,
                cards: {
                  ...current.cards,
                  [id]: { id, title: t("cardTitle"), labelIds: [] },
                },
                lists: current.lists.map((item) =>
                  item.id === list.id ? { ...item, cardIds: [...item.cardIds, id] } : item,
                ),
              }));
            }}
          >
            {t("addCard")}
          </Button>
        </section>
      ))}
      <Button
        variant="outline"
        className="h-fit shrink-0"
        onClick={() => {
          const id = crypto.randomUUID();
          updateTasks(pageId, (current) => ({
            ...current,
            lists: [...current.lists, { id, title: t("listTitle"), cardIds: [] }],
          }));
        }}
      >
        {t("addList")}
      </Button>
    </div>
  );
}
