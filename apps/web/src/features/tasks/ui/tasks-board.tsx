"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionStore } from "@/features/join/store/session-store";
import type { TasksState } from "@/features/workflow/domain/document-data";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";

const EMPTY_TASKS: TasksState = { lists: [], cards: {}, labels: [] };
const DRAG_TYPE = "application/x-flowboard-task-card";

function moveCard(state: TasksState, cardId: string, toListId: string, toIndex: number): TasksState {
  const fromList = state.lists.find((list) => list.cardIds.includes(cardId));
  if (!fromList) {
    return state;
  }
  const fromIndex = fromList.cardIds.indexOf(cardId);
  if (fromList.id === toListId && (toIndex === fromIndex || toIndex === fromIndex + 1)) {
    return state;
  }

  let insertAt = Math.max(0, toIndex);
  if (fromList.id === toListId && insertAt > fromIndex) {
    insertAt -= 1;
  }

  const lists = state.lists.map((list) => ({
    ...list,
    cardIds: list.cardIds.filter((id) => id !== cardId),
  }));

  return {
    ...state,
    lists: lists.map((list) => {
      if (list.id !== toListId) {
        return list;
      }
      const nextIds = [...list.cardIds];
      const clamped = Math.max(0, Math.min(insertAt, nextIds.length));
      nextIds.splice(clamped, 0, cardId);
      return { ...list, cardIds: nextIds };
    }),
  };
}

export function TasksBoard({ pageId }: { pageId: string }) {
  const t = useTranslations("tasks");
  const tasks = useWorkflowStore((s) => s.data?.tasks[pageId] ?? EMPTY_TASKS);
  const updateTasks = useWorkflowStore((s) => s.updateTasks);
  const canEdit = useSessionStore((s) => (s.sessionId ? s.canEdit : true));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ listId: string; index: number } | null>(null);

  const clearDrag = () => {
    setDraggingId(null);
    setDropTarget(null);
  };

  const applyDrop = (toListId: string, toIndex: number) => {
    if (!canEdit || !draggingId) {
      clearDrag();
      return;
    }
    updateTasks(pageId, (current) => moveCard(current, draggingId, toListId, toIndex));
    clearDrag();
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <p className="text-muted-foreground shrink-0 px-3 pt-3 text-xs md:px-4">
        {canEdit ? t("dragHint") : t("readOnly")}
      </p>
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3 md:p-4">
        {tasks.lists.map((list) => {
          const isListTarget = dropTarget?.listId === list.id;
          return (
            <section
              key={list.id}
              className={`bg-background/70 flex w-72 shrink-0 flex-col rounded-xl border p-3 backdrop-blur transition-colors ${
                isListTarget ? "border-teal-700 bg-teal-700/5" : "border-border"
              }`}
              onDragOver={(event) => {
                if (!canEdit || !draggingId) {
                  return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTarget({ listId: list.id, index: list.cardIds.length });
              }}
              onDrop={(event) => {
                event.preventDefault();
                const index = dropTarget?.listId === list.id ? dropTarget.index : list.cardIds.length;
                applyDrop(list.id, index);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDropTarget((prev) => (prev?.listId === list.id ? null : prev));
                }
              }}
            >
              <Input
                value={list.title}
                disabled={!canEdit}
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
                {list.cardIds.length === 0 ? (
                  <div
                    className={`text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-xs ${
                      isListTarget ? "border-teal-700 text-teal-900 dark:text-teal-100" : "border-border"
                    }`}
                  >
                    {t("dropHere")}
                  </div>
                ) : null}
                {list.cardIds.map((cardId, index) => {
                  const card = tasks.cards[cardId];
                  if (!card) {
                    return null;
                  }
                  const showInsertBefore = dropTarget?.listId === list.id && dropTarget.index === index;
                  return (
                    <div key={card.id} className="flex flex-col gap-2">
                      {showInsertBefore ? (
                        <div className="h-1 rounded-full bg-teal-700" aria-hidden />
                      ) : null}
                      <article
                        draggable={canEdit}
                        className={`bg-card rounded-lg border p-3 shadow-sm transition-opacity ${
                          draggingId === card.id ? "border-teal-700 opacity-50" : "border-border"
                        } ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
                        onDragStart={(event) => {
                          if (!canEdit) {
                            return;
                          }
                          if ((event.target as HTMLElement).closest("input,textarea,button")) {
                            event.preventDefault();
                            return;
                          }
                          event.dataTransfer.setData(DRAG_TYPE, card.id);
                          event.dataTransfer.effectAllowed = "move";
                          setDraggingId(card.id);
                        }}
                        onDragEnd={clearDrag}
                        onDragOver={(event) => {
                          if (!canEdit || !draggingId || draggingId === card.id) {
                            return;
                          }
                          event.preventDefault();
                          event.stopPropagation();
                          const rect = event.currentTarget.getBoundingClientRect();
                          const before = event.clientY < rect.top + rect.height / 2;
                          setDropTarget({ listId: list.id, index: before ? index : index + 1 });
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const rect = event.currentTarget.getBoundingClientRect();
                          const before = event.clientY < rect.top + rect.height / 2;
                          applyDrop(list.id, before ? index : index + 1);
                        }}
                      >
                        <Input
                          value={card.title}
                          disabled={!canEdit}
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
                          onPointerDown={(event) => event.stopPropagation()}
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
                    </div>
                  );
                })}
                {dropTarget?.listId === list.id && dropTarget.index === list.cardIds.length && list.cardIds.length > 0 ? (
                  <div className="h-1 rounded-full bg-teal-700" aria-hidden />
                ) : null}
              </div>
              <Button
                className="mt-3"
                variant="ghost"
                size="sm"
                disabled={!canEdit}
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
          );
        })}
        <Button
          variant="outline"
          className="h-fit shrink-0"
          disabled={!canEdit}
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
    </div>
  );
}
