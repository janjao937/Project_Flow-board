"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  STICKY_COLORS,
  createEmptyBoard,
  snapToGrid,
  type BoardShape,
  type ShapeKind,
  type StickyNote,
} from "@/features/workflow/domain/document-data";
import { useSessionStore } from "@/features/join/store/session-store";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";
import { StickyNoteView } from "./sticky-note-view";

type Tool = "select" | "pan" | "sticky" | ShapeKind | "image" | "connector";

const COLOR_CLASS: Record<string, string> = {
  butter: "bg-[#f3e2a4]",
  mint: "bg-[#b8e0d2]",
  sky: "bg-[#a9d4ef]",
  blush: "bg-[#f0c4c0]",
  fog: "bg-[#d9dde3]",
};

export function BoardCanvas({ pageId }: { pageId: string }) {
  const t = useTranslations("board");
  const board = useWorkflowStore((s) => s.data?.boards[pageId] ?? createEmptyBoard());
  const updateBoard = useWorkflowStore((s) => s.updateBoard);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const canEdit = useSessionStore((s) => (s.sessionId ? s.canEdit : true));
  const participants = useSessionStore((s) => s.participants);

  const [tool, setTool] = useState<Tool>("select");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [connectorFrom, setConnectorFrom] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<{ stickies: StickyNote[]; shapes: BoardShape[] } | null>(null);
  const panRef = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const normalizeBoard = useCallback(
    (current: typeof board) => ({
      stickies: current.stickies ?? [],
      shapes: current.shapes ?? [],
      connectors: current.connectors ?? [],
      images: current.images ?? [],
      gridEnabled: current.gridEnabled ?? false,
    }),
    [],
  );

  const screenToWorld = (clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }
    return {
      x: (clientX - rect.left - camera.x) / camera.zoom,
      y: (clientY - rect.top - camera.y) / camera.zoom,
    };
  };

  const addSticky = useCallback(
    (x: number, y: number) => {
      if (!canEdit) {
        return;
      }
      const sticky: StickyNote = {
        id: crypto.randomUUID(),
        x: snapToGrid(x, board.gridEnabled),
        y: snapToGrid(y, board.gridEnabled),
        width: 180,
        height: 160,
        text: "",
        color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)] ?? "butter",
        zIndex: board.stickies.length + board.shapes.length + 1,
      };
      updateBoard(pageId, (current) => {
        const next = normalizeBoard(current);
        return { ...next, stickies: [...next.stickies, sticky] };
      });
      setSelectedIds([sticky.id]);
    },
    [board.gridEnabled, board.shapes.length, board.stickies.length, canEdit, normalizeBoard, pageId, updateBoard],
  );

  const addShape = useCallback(
    (kind: ShapeKind, x: number, y: number) => {
      if (!canEdit) {
        return;
      }
      const shape: BoardShape = {
        id: crypto.randomUUID(),
        kind,
        x: snapToGrid(x, board.gridEnabled),
        y: snapToGrid(y, board.gridEnabled),
        width: 140,
        height: 100,
        stroke: "#0f766e",
        fill: "rgba(15,118,110,0.12)",
        zIndex: board.stickies.length + board.shapes.length + 1,
      };
      updateBoard(pageId, (current) => {
        const next = normalizeBoard(current);
        return { ...next, shapes: [...next.shapes, shape] };
      });
      setSelectedIds([shape.id]);
      setTool("select");
    },
    [board.gridEnabled, board.shapes.length, board.stickies.length, canEdit, normalizeBoard, pageId, updateBoard],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!canEdit) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        const stickies = board.stickies.filter((item) => selectedIds.includes(item.id));
        const shapes = board.shapes.filter((item) => selectedIds.includes(item.id));
        setClipboard({ stickies, shapes });
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v" && clipboard) {
        const offset = 24;
        const mapped = new Map<string, string>();
        const stickies = clipboard.stickies.map((item) => {
          const id = crypto.randomUUID();
          mapped.set(item.id, id);
          return { ...item, id, x: item.x + offset, y: item.y + offset };
        });
        const shapes = clipboard.shapes.map((item) => {
          const id = crypto.randomUUID();
          mapped.set(item.id, id);
          return { ...item, id, x: item.x + offset, y: item.y + offset };
        });
        updateBoard(pageId, (current) => {
          const next = normalizeBoard(current);
          return {
            ...next,
            stickies: [...next.stickies, ...stickies],
            shapes: [...next.shapes, ...shapes],
          };
        });
        setSelectedIds([...mapped.values()]);
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) {
          return;
        }
        updateBoard(pageId, (current) => {
          const next = normalizeBoard(current);
          return {
            ...next,
            stickies: next.stickies.filter((item) => !selectedIds.includes(item.id)),
            shapes: next.shapes.filter((item) => !selectedIds.includes(item.id)),
            images: next.images.filter((item) => !selectedIds.includes(item.id)),
            connectors: next.connectors.filter(
              (item) => !selectedIds.includes(item.fromId) && !selectedIds.includes(item.toId),
            ),
          };
        });
        setSelectedIds([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [board.shapes, board.stickies, canEdit, clipboard, normalizeBoard, pageId, redo, selectedIds, undo, updateBoard]);

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div className="border-border/60 bg-background/80 absolute inset-x-0 top-0 z-20 flex flex-wrap items-center gap-1 border-b px-2 py-2 backdrop-blur md:px-3">
        {(
          [
            ["select", t("select")],
            ["pan", t("pan")],
            ["sticky", t("addSticky")],
            ["rect", t("rect")],
            ["ellipse", t("ellipse")],
            ["triangle", t("triangle")],
            ["arrow", t("arrow")],
            ["connector", t("connector")],
            ["image", t("image")],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={tool === id ? "default" : "ghost"}
            disabled={!canEdit && id !== "select" && id !== "pan"}
            onClick={() => setTool(id)}
          >
            {label}
          </Button>
        ))}
        <Button
          size="sm"
          variant={board.gridEnabled ? "default" : "ghost"}
          disabled={!canEdit}
          onClick={() =>
            updateBoard(pageId, (current) => {
              const next = normalizeBoard(current);
              return { ...next, gridEnabled: !next.gridEnabled };
            })
          }
        >
          {t("grid")}
        </Button>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" disabled={!canEdit} onClick={undo}>
            {t("undo")}
          </Button>
          <Button size="sm" variant="ghost" disabled={!canEdit} onClick={redo}>
            {t("redo")}
          </Button>
        </div>
      </div>

      {!canEdit ? (
        <div className="bg-amber-500/15 text-amber-950 dark:text-amber-100 absolute inset-x-0 top-12 z-20 px-3 py-1 text-center text-xs">
          {t("readOnly")}
        </div>
      ) : null}

      <div
        ref={viewportRef}
        className={`board-surface relative mt-12 min-h-0 flex-1 touch-none overflow-hidden ${board.gridEnabled ? "board-grid" : ""}`}
        onWheel={(event) => {
          event.preventDefault();
          const factor = event.deltaY > 0 ? 0.92 : 1.08;
          setCamera((prev) => ({
            ...prev,
            zoom: Math.min(2.5, Math.max(0.35, prev.zoom * factor)),
          }));
        }}
        onPointerDown={(event) => {
          if (tool === "pan" || event.button === 1) {
            panRef.current = { px: event.clientX, py: event.clientY, cx: camera.x, cy: camera.y };
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
          }
        }}
        onPointerMove={(event) => {
          if (!panRef.current) {
            return;
          }
          const dx = event.clientX - panRef.current.px;
          const dy = event.clientY - panRef.current.py;
          setCamera({ x: panRef.current.cx + dx, y: panRef.current.cy + dy, zoom: camera.zoom });
        }}
        onPointerUp={() => {
          panRef.current = null;
        }}
        onDoubleClick={(event) => {
          if (!canEdit || tool !== "select") {
            return;
          }
          const world = screenToWorld(event.clientX, event.clientY);
          addSticky(world.x - 90, world.y - 80);
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) {
            return;
          }
          const world = screenToWorld(event.clientX, event.clientY);
          if (tool === "sticky") {
            addSticky(world.x - 90, world.y - 80);
            setTool("select");
            return;
          }
          if (tool === "rect" || tool === "ellipse" || tool === "triangle" || tool === "arrow") {
            addShape(tool, world.x - 70, world.y - 50);
            return;
          }
          if (tool === "image") {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.onchange = async () => {
              const file = input.files?.[0];
              if (!file) {
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                const src = String(reader.result);
                updateBoard(pageId, (current) => {
                  const next = normalizeBoard(current);
                  return {
                    ...next,
                    images: [
                      ...next.images,
                      {
                        id: crypto.randomUUID(),
                        x: snapToGrid(world.x - 80, next.gridEnabled),
                        y: snapToGrid(world.y - 60, next.gridEnabled),
                        width: 160,
                        height: 120,
                        src,
                        zIndex: next.stickies.length + next.shapes.length + next.images.length + 1,
                      },
                    ],
                  };
                });
                setTool("select");
              };
              reader.readAsDataURL(file);
            };
            input.click();
            return;
          }
          setSelectedIds([]);
          setConnectorFrom(null);
        }}
        onTouchStart={(event) => {
          if (event.touches.length === 2) {
            const [a, b] = [event.touches[0], event.touches[1]];
            if (!a || !b) {
              return;
            }
            const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            pinchRef.current = { distance, zoom: camera.zoom };
          }
        }}
        onTouchMove={(event) => {
          if (event.touches.length === 2 && pinchRef.current) {
            const [a, b] = [event.touches[0], event.touches[1]];
            if (!a || !b) {
              return;
            }
            const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            const nextZoom = Math.min(
              2.5,
              Math.max(0.35, pinchRef.current.zoom * (distance / pinchRef.current.distance)),
            );
            setCamera((prev) => ({ ...prev, zoom: nextZoom }));
          }
        }}
        onTouchEnd={() => {
          pinchRef.current = null;
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}
        >
          <svg className="pointer-events-none absolute overflow-visible" style={{ left: 0, top: 0, width: 1, height: 1 }}>
            {board.connectors.map((connector) => {
              const from =
                board.stickies.find((item) => item.id === connector.fromId) ??
                board.shapes.find((item) => item.id === connector.fromId);
              const to =
                board.stickies.find((item) => item.id === connector.toId) ??
                board.shapes.find((item) => item.id === connector.toId);
              if (!from || !to) {
                return null;
              }
              const x1 = from.x + from.width / 2;
              const y1 = from.y + from.height / 2;
              const x2 = to.x + to.width / 2;
              const y2 = to.y + to.height / 2;
              return (
                <line
                  key={connector.id}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#0f766e"
                  strokeWidth={2}
                  markerEnd="url(#arrowhead)"
                />
              );
            })}
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="#0f766e" />
              </marker>
            </defs>
          </svg>

          {board.shapes.map((shape) => (
            <div
              key={shape.id}
              className={`absolute border-2 ${selectedIds.includes(shape.id) ? "ring-2 ring-teal-700" : ""}`}
              style={{
                left: shape.x,
                top: shape.y,
                width: shape.width,
                height: shape.height,
                borderColor: shape.stroke,
                background: shape.kind === "ellipse" ? shape.fill : shape.fill,
                borderRadius: shape.kind === "ellipse" ? "9999px" : shape.kind === "triangle" ? 0 : 8,
                clipPath: shape.kind === "triangle" ? "polygon(50% 0%, 0% 100%, 100% 100%)" : undefined,
                zIndex: shape.zIndex,
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (tool === "connector") {
                  if (!connectorFrom) {
                    setConnectorFrom(shape.id);
                  } else if (connectorFrom !== shape.id) {
                    updateBoard(pageId, (current) => {
                      const next = normalizeBoard(current);
                      return {
                        ...next,
                        connectors: [
                          ...next.connectors,
                          {
                            id: crypto.randomUUID(),
                            fromId: connectorFrom,
                            toId: shape.id,
                            fromAnchor: "e",
                            toAnchor: "w",
                          },
                        ],
                      };
                    });
                    setConnectorFrom(null);
                    setTool("select");
                  }
                  return;
                }
                if (event.shiftKey) {
                  setSelectedIds((prev) =>
                    prev.includes(shape.id) ? prev.filter((id) => id !== shape.id) : [...prev, shape.id],
                  );
                } else {
                  setSelectedIds([shape.id]);
                }
              }}
            />
          ))}

          {board.images.map((image) => (
            <div
              key={image.id}
              className={`absolute bg-cover bg-center ${selectedIds.includes(image.id) ? "ring-2 ring-teal-700" : ""}`}
              style={{
                left: image.x,
                top: image.y,
                width: image.width,
                height: image.height,
                zIndex: image.zIndex,
                backgroundImage: `url(${image.src})`,
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                setSelectedIds(event.shiftKey ? [...selectedIds, image.id] : [image.id]);
              }}
            />
          ))}

          {board.stickies.map((sticky) => (
            <StickyNoteView
              key={sticky.id}
              sticky={sticky}
              selected={selectedIds.includes(sticky.id)}
              colorClass={COLOR_CLASS[sticky.color] ?? COLOR_CLASS.butter}
              zoom={camera.zoom}
              onSelect={() => {
                if (tool === "connector") {
                  if (!connectorFrom) {
                    setConnectorFrom(sticky.id);
                  } else if (connectorFrom !== sticky.id) {
                    updateBoard(pageId, (current) => {
                      const next = normalizeBoard(current);
                      return {
                        ...next,
                        connectors: [
                          ...next.connectors,
                          {
                            id: crypto.randomUUID(),
                            fromId: connectorFrom,
                            toId: sticky.id,
                            fromAnchor: "e",
                            toAnchor: "w",
                          },
                        ],
                      };
                    });
                    setConnectorFrom(null);
                    setTool("select");
                  }
                  return;
                }
                setSelectedIds([sticky.id]);
              }}
              onChange={(nextSticky) => {
                if (!canEdit) {
                  return;
                }
                updateBoard(pageId, (current) => {
                  const next = normalizeBoard(current);
                  return {
                    ...next,
                    stickies: next.stickies.map((item) =>
                      item.id === nextSticky.id
                        ? {
                            ...nextSticky,
                            x: snapToGrid(nextSticky.x, next.gridEnabled),
                            y: snapToGrid(nextSticky.y, next.gridEnabled),
                          }
                        : item,
                    ),
                  };
                });
              }}
            />
          ))}

          {participants
            .filter((participant) => participant.cursor && participant.pageId === pageId)
            .map((participant) => (
              <div
                key={participant.participantId}
                className="pointer-events-none absolute z-50"
                style={{ left: participant.cursor?.x, top: participant.cursor?.y }}
              >
                <div className="h-3 w-3 rounded-full bg-teal-600" />
                <span className="bg-teal-700 ml-1 rounded px-1 text-[10px] text-white">{participant.displayName}</span>
              </div>
            ))}
        </div>
        {board.stickies.length === 0 && board.shapes.length === 0 ? (
          <p className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
            {t("emptyHint")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
