"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  STICKY_COLORS,
  snapToGrid,
  type BoardFrame,
  type BoardShape,
  type FreehandStroke,
  type ShapeKind,
  type StickyNote,
} from "@/features/workflow/domain/document-data";
import { useSessionStore } from "@/features/join/store/session-store";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";
import { alignItems, distributeItems, type AlignMode } from "../lib/align";
import { exportBoardPdf, exportBoardPng } from "../lib/export-board";
import { EMPTY_BOARD, normalizeBoard } from "../lib/normalize-board";
import { DraggableBoardItem } from "./draggable-board-item";
import { StickyNoteView } from "./sticky-note-view";

type Tool = "select" | "pan" | "sticky" | ShapeKind | "image" | "connector" | "frame" | "freehand";

const COLOR_CLASS: Record<string, string> = {
  butter: "bg-[#f3e2a4]",
  mint: "bg-[#b8e0d2]",
  sky: "bg-[#a9d4ef]",
  blush: "bg-[#f0c4c0]",
  fog: "bg-[#d9dde3]",
};

const PEN_COLORS = [
  { id: "teal", value: "#0f766e" },
  { id: "ink", value: "#1f2937" },
  { id: "crimson", value: "#b91c1c" },
  { id: "amber", value: "#d97706" },
  { id: "sky", value: "#0284c7" },
  { id: "violet", value: "#7c3aed" },
  { id: "rose", value: "#e11d48" },
  { id: "white", value: "#f8fafc" },
] as const;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => part + part)
          .join("")
      : normalized.padEnd(6, "0").slice(0, 6);
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) {
    return { r: 15, g: 118, b: 110 };
  }
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export function BoardCanvas({ pageId }: { pageId: string }) {
  const t = useTranslations("board");
  const board = useWorkflowStore((s) => s.data?.boards[pageId] ?? EMPTY_BOARD);
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
  const [draftStroke, setDraftStroke] = useState<FreehandStroke | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0]!.value);
  const panRef = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const contentBounds = useMemo(() => {
    const boxes = [...board.stickies, ...board.shapes, ...board.images, ...board.frames];
    if (boxes.length === 0) {
      return { minX: -200, minY: -200, maxX: 800, maxY: 600 };
    }
    return {
      minX: Math.min(...boxes.map((box) => box.x)) - 80,
      minY: Math.min(...boxes.map((box) => box.y)) - 80,
      maxX: Math.max(...boxes.map((box) => box.x + box.width)) + 80,
      maxY: Math.max(...boxes.map((box) => box.y + box.height)) + 80,
    };
  }, [board.frames, board.images, board.shapes, board.stickies]);

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

  const nextZ = () =>
    board.stickies.length + board.shapes.length + board.images.length + board.frames.length + board.strokes.length + 1;

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
        zIndex: nextZ(),
      };
      updateBoard(pageId, (current) => {
        const next = normalizeBoard(current);
        return { ...next, stickies: [...next.stickies, sticky] };
      });
      setSelectedIds([sticky.id]);
    },
    [board.gridEnabled, canEdit, pageId, updateBoard],
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
        zIndex: nextZ(),
      };
      updateBoard(pageId, (current) => {
        const next = normalizeBoard(current);
        return { ...next, shapes: [...next.shapes, shape] };
      });
      setSelectedIds([shape.id]);
      setTool("select");
    },
    [board.gridEnabled, canEdit, pageId, updateBoard],
  );

  const addFrame = useCallback(
    (x: number, y: number) => {
      if (!canEdit) {
        return;
      }
      const frame: BoardFrame = {
        id: crypto.randomUUID(),
        x: snapToGrid(x, board.gridEnabled),
        y: snapToGrid(y, board.gridEnabled),
        width: 420,
        height: 280,
        title: t("frame"),
        zIndex: 0,
      };
      updateBoard(pageId, (current) => {
        const next = normalizeBoard(current);
        return { ...next, frames: [...next.frames, frame] };
      });
      setSelectedIds([frame.id]);
      setTool("select");
    },
    [board.gridEnabled, canEdit, pageId, t, updateBoard],
  );

  const applyAlign = (mode: AlignMode) => {
    if (!canEdit || selectedIds.length < 2) {
      return;
    }
    updateBoard(pageId, (current) => {
      const next = normalizeBoard(current);
      const selected = [
        ...next.stickies.filter((item) => selectedIds.includes(item.id)),
        ...next.shapes.filter((item) => selectedIds.includes(item.id)),
        ...next.images.filter((item) => selectedIds.includes(item.id)),
        ...next.frames.filter((item) => selectedIds.includes(item.id)),
      ];
      const aligned = alignItems(selected, mode);
      const byId = new Map(aligned.map((item) => [item.id, item]));
      return {
        ...next,
        stickies: next.stickies.map((item) => {
          const hit = byId.get(item.id);
          return hit ? { ...item, x: hit.x, y: hit.y } : item;
        }),
        shapes: next.shapes.map((item) => {
          const hit = byId.get(item.id);
          return hit ? { ...item, x: hit.x, y: hit.y } : item;
        }),
        images: next.images.map((item) => {
          const hit = byId.get(item.id);
          return hit ? { ...item, x: hit.x, y: hit.y } : item;
        }),
        frames: next.frames.map((item) => {
          const hit = byId.get(item.id);
          return hit ? { ...item, x: hit.x, y: hit.y } : item;
        }),
      };
    });
  };

  const applyDistribute = (mode: "horizontal" | "vertical") => {
    if (!canEdit || selectedIds.length < 3) {
      return;
    }
    updateBoard(pageId, (current) => {
      const next = normalizeBoard(current);
      const selected = [
        ...next.stickies.filter((item) => selectedIds.includes(item.id)),
        ...next.shapes.filter((item) => selectedIds.includes(item.id)),
        ...next.images.filter((item) => selectedIds.includes(item.id)),
      ];
      const distributed = distributeItems(selected, mode);
      const byId = new Map(distributed.map((item) => [item.id, item]));
      return {
        ...next,
        stickies: next.stickies.map((item) => {
          const hit = byId.get(item.id);
          return hit ? { ...item, x: hit.x, y: hit.y } : item;
        }),
        shapes: next.shapes.map((item) => {
          const hit = byId.get(item.id);
          return hit ? { ...item, x: hit.x, y: hit.y } : item;
        }),
        images: next.images.map((item) => {
          const hit = byId.get(item.id);
          return hit ? { ...item, x: hit.x, y: hit.y } : item;
        }),
      };
    });
  };

  const groupSelected = () => {
    if (!canEdit || selectedIds.length < 2) {
      return;
    }
    const groupId = crypto.randomUUID();
    updateBoard(pageId, (current) => {
      const next = normalizeBoard(current);
      return {
        ...next,
        groups: [...next.groups, { id: groupId, memberIds: selectedIds }],
        stickies: next.stickies.map((item) =>
          selectedIds.includes(item.id) ? { ...item, groupId } : item,
        ),
        shapes: next.shapes.map((item) =>
          selectedIds.includes(item.id) ? { ...item, groupId } : item,
        ),
        images: next.images.map((item) =>
          selectedIds.includes(item.id) ? { ...item, groupId } : item,
        ),
        strokes: next.strokes.map((item) =>
          selectedIds.includes(item.id) ? { ...item, groupId } : item,
        ),
      };
    });
  };

  const ungroupSelected = () => {
    if (!canEdit || selectedIds.length === 0) {
      return;
    }
    updateBoard(pageId, (current) => {
      const next = normalizeBoard(current);
      const groupIds = new Set(
        [
          ...next.stickies.filter((item) => selectedIds.includes(item.id)).map((item) => item.groupId),
          ...next.shapes.filter((item) => selectedIds.includes(item.id)).map((item) => item.groupId),
          ...next.images.filter((item) => selectedIds.includes(item.id)).map((item) => item.groupId),
        ].filter(Boolean),
      );
      return {
        ...next,
        groups: next.groups.filter((group) => !groupIds.has(group.id)),
        stickies: next.stickies.map((item) =>
          selectedIds.includes(item.id) ? { ...item, groupId: null } : item,
        ),
        shapes: next.shapes.map((item) =>
          selectedIds.includes(item.id) ? { ...item, groupId: null } : item,
        ),
        images: next.images.map((item) =>
          selectedIds.includes(item.id) ? { ...item, groupId: null } : item,
        ),
        strokes: next.strokes.map((item) =>
          selectedIds.includes(item.id) ? { ...item, groupId: null } : item,
        ),
      };
    });
  };

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
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "g") {
        event.preventDefault();
        if (event.shiftKey) {
          ungroupSelected();
        } else {
          groupSelected();
        }
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
            frames: next.frames.filter((item) => !selectedIds.includes(item.id)),
            strokes: next.strokes.filter((item) => !selectedIds.includes(item.id)),
            connectors: next.connectors.filter(
              (item) => !selectedIds.includes(item.fromId) && !selectedIds.includes(item.toId),
            ),
            groups: next.groups
              .map((group) => ({
                ...group,
                memberIds: group.memberIds.filter((id) => !selectedIds.includes(id)),
              }))
              .filter((group) => group.memberIds.length > 1),
          };
        });
        setSelectedIds([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [board.shapes, board.stickies, canEdit, clipboard, pageId, redo, selectedIds, undo, updateBoard]);

  const minimapScale = 0.08;
  const worldW = contentBounds.maxX - contentBounds.minX;
  const worldH = contentBounds.maxY - contentBounds.minY;
  const viewport = viewportRef.current?.getBoundingClientRect();
  const viewW = (viewport?.width ?? 800) / camera.zoom;
  const viewH = (viewport?.height ?? 600) / camera.zoom;
  const viewX = -camera.x / camera.zoom;
  const viewY = -camera.y / camera.zoom;

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div className="border-border/60 bg-background/90 z-20 flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-2 backdrop-blur md:px-3">
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
            ["frame", t("frame")],
            ["freehand", t("freehand")],
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
        <Button size="sm" variant="ghost" disabled={!canEdit || selectedIds.length < 2} onClick={() => applyAlign("left")}>
          {t("alignLeft")}
        </Button>
        <Button size="sm" variant="ghost" disabled={!canEdit || selectedIds.length < 2} onClick={() => applyAlign("top")}>
          {t("alignTop")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!canEdit || selectedIds.length < 3}
          onClick={() => applyDistribute("horizontal")}
        >
          {t("distributeH")}
        </Button>
        <Button size="sm" variant="ghost" disabled={!canEdit || selectedIds.length < 2} onClick={groupSelected}>
          {t("group")}
        </Button>
        <Button size="sm" variant="ghost" disabled={!canEdit || selectedIds.length < 1} onClick={ungroupSelected}>
          {t("ungroup")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowMinimap((value) => !value)}>
          {t("minimap")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void exportBoardPng(board)}>
          {t("exportPng")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void exportBoardPdf(board)}>
          {t("exportPdf")}
        </Button>
        {tool === "freehand" ? (
          <div className="border-border/60 ml-1 flex max-w-full flex-wrap items-center gap-2 rounded-lg border px-1.5 py-1" role="group" aria-label={t("penColor")}>
            {PEN_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                disabled={!canEdit}
                aria-label={t(`penColors.${color.id}`)}
                aria-pressed={penColor === color.value}
                className={`h-6 w-6 rounded-full border-2 ${penColor === color.value ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ backgroundColor: color.value }}
                onClick={() => setPenColor(color.value)}
              />
            ))}
            <label className="relative inline-flex h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-border/80" title={t("penRgbPicker")}>
              <span className="sr-only">{t("penRgbPicker")}</span>
              <input
                type="color"
                disabled={!canEdit}
                value={penColor.length === 7 ? penColor : rgbToHex(hexToRgb(penColor).r, hexToRgb(penColor).g, hexToRgb(penColor).b)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                onChange={(event) => setPenColor(event.target.value)}
              />
              <span className="block h-full w-full" style={{ backgroundColor: penColor }} />
            </label>
            <div className="flex min-w-[11rem] flex-1 flex-col gap-0.5 sm:min-w-[14rem]">
              {(["r", "g", "b"] as const).map((channel) => {
                const rgb = hexToRgb(penColor);
                const value = rgb[channel];
                return (
                  <label key={channel} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <span className="w-3">{channel}</span>
                    <input
                      type="range"
                      min={0}
                      max={255}
                      value={value}
                      disabled={!canEdit}
                      aria-label={t(`penRgb.${channel}`)}
                      className="h-1.5 flex-1 accent-teal-700"
                      onChange={(event) => {
                        const next = { ...rgb, [channel]: Number(event.target.value) };
                        setPenColor(rgbToHex(next.r, next.g, next.b));
                      }}
                    />
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={value}
                      disabled={!canEdit}
                      aria-label={t(`penRgb.${channel}`)}
                      className="border-input bg-background h-6 w-12 rounded border px-1 text-[11px]"
                      onChange={(event) => {
                        const next = { ...rgb, [channel]: Number(event.target.value) || 0 };
                        setPenColor(rgbToHex(next.r, next.g, next.b));
                      }}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
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
        <div className="bg-amber-500/15 text-amber-950 dark:text-amber-100 shrink-0 px-3 py-1 text-center text-xs">
          {t("readOnly")}
        </div>
      ) : null}

      <div
        ref={viewportRef}
        className={`board-surface relative min-h-0 flex-1 touch-none overflow-hidden ${board.gridEnabled ? "board-grid" : ""}`}
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
            return;
          }
          if (tool === "freehand" && canEdit && event.button === 0) {
            const world = screenToWorld(event.clientX, event.clientY);
            setDraftStroke({
              id: crypto.randomUUID(),
              points: [{ x: world.x, y: world.y }],
              color: penColor,
              width: 3,
              zIndex: nextZ(),
            });
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
          }
        }}
        onPointerMove={(event) => {
          if (panRef.current) {
            const dx = event.clientX - panRef.current.px;
            const dy = event.clientY - panRef.current.py;
            setCamera({ x: panRef.current.cx + dx, y: panRef.current.cy + dy, zoom: camera.zoom });
            return;
          }
          if (draftStroke) {
            const world = screenToWorld(event.clientX, event.clientY);
            setDraftStroke({
              ...draftStroke,
              points: [...draftStroke.points, { x: world.x, y: world.y }],
            });
          }
        }}
        onPointerUp={() => {
          panRef.current = null;
          if (draftStroke && draftStroke.points.length > 1) {
            updateBoard(pageId, (current) => {
              const next = normalizeBoard(current);
              return { ...next, strokes: [...next.strokes, draftStroke] };
            });
            setSelectedIds([draftStroke.id]);
          }
          setDraftStroke(null);
        }}
        onDoubleClick={(event) => {
          if (!canEdit || tool !== "select" || event.target !== event.currentTarget) {
            return;
          }
          const world = screenToWorld(event.clientX, event.clientY);
          addSticky(world.x - 90, world.y - 80);
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget || tool === "freehand") {
            return;
          }
          const world = screenToWorld(event.clientX, event.clientY);
          if (tool === "sticky") {
            addSticky(world.x - 90, world.y - 80);
            setTool("select");
            return;
          }
          if (tool === "frame") {
            addFrame(world.x - 210, world.y - 140);
            setTool("select");
            return;
          }
          if (tool === "rect" || tool === "ellipse" || tool === "triangle" || tool === "arrow") {
            addShape(tool, world.x - 70, world.y - 50);
            setTool("select");
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
          {board.frames.map((frame) => (
            <DraggableBoardItem
              key={frame.id}
              item={frame}
              selected={selectedIds.includes(frame.id)}
              canEdit={canEdit && tool === "select"}
              zoom={camera.zoom}
              className={`absolute border-2 border-dashed border-teal-700/70 bg-teal-700/5 ${selectedIds.includes(frame.id) ? "ring-2 ring-teal-700" : ""}`}
              style={{
                width: frame.width,
                height: frame.height,
                zIndex: frame.zIndex,
              }}
              onSelect={(additive) => {
                setSelectedIds((prev) =>
                  additive
                    ? prev.includes(frame.id)
                      ? prev.filter((id) => id !== frame.id)
                      : [...prev, frame.id]
                    : [frame.id],
                );
              }}
              onMove={(nextFrame) => {
                updateBoard(pageId, (current) => {
                  const next = normalizeBoard(current);
                  return {
                    ...next,
                    frames: next.frames.map((item) =>
                      item.id === frame.id
                        ? {
                            ...item,
                            x: snapToGrid(nextFrame.x, next.gridEnabled),
                            y: snapToGrid(nextFrame.y, next.gridEnabled),
                          }
                        : item,
                    ),
                  };
                });
              }}
            >
              <Input
                value={frame.title}
                disabled={!canEdit}
                className="h-8 border-0 bg-transparent text-sm font-medium shadow-none focus-visible:ring-0"
                onChange={(event) => {
                  const title = event.target.value;
                  updateBoard(pageId, (current) => {
                    const next = normalizeBoard(current);
                    return {
                      ...next,
                      frames: next.frames.map((item) => (item.id === frame.id ? { ...item, title } : item)),
                    };
                  });
                }}
              />
            </DraggableBoardItem>
          ))}

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
            {[...board.strokes, ...(draftStroke ? [draftStroke] : [])].map((stroke) => (
              <polyline
                key={stroke.id}
                fill="none"
                stroke={stroke.color}
                strokeWidth={stroke.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={stroke.points.map((point) => `${point.x},${point.y}`).join(" ")}
                className={selectedIds.includes(stroke.id) ? "opacity-90" : undefined}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelectedIds([stroke.id]);
                }}
                style={{ pointerEvents: "stroke" }}
              />
            ))}
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="#0f766e" />
              </marker>
            </defs>
          </svg>

          {board.shapes.map((shape) => (
            <DraggableBoardItem
              key={shape.id}
              item={shape}
              selected={selectedIds.includes(shape.id)}
              canEdit={canEdit && (tool === "select" || tool === "connector")}
              canDrag={tool === "select"}
              zoom={camera.zoom}
              className={`absolute border-2 ${selectedIds.includes(shape.id) ? "ring-2 ring-teal-700" : ""}`}
              style={{
                width: shape.width,
                height: shape.height,
                borderColor: shape.stroke,
                background: shape.fill,
                borderRadius: shape.kind === "ellipse" ? "9999px" : shape.kind === "triangle" ? 0 : 8,
                clipPath: shape.kind === "triangle" ? "polygon(50% 0%, 0% 100%, 100% 100%)" : undefined,
                zIndex: shape.zIndex,
              }}
              onSelect={(additive) => {
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
                setSelectedIds((prev) =>
                  additive
                    ? prev.includes(shape.id)
                      ? prev.filter((id) => id !== shape.id)
                      : [...prev, shape.id]
                    : [shape.id],
                );
              }}
              onMove={(nextShape) => {
                if (tool !== "select") {
                  return;
                }
                updateBoard(pageId, (current) => {
                  const next = normalizeBoard(current);
                  return {
                    ...next,
                    shapes: next.shapes.map((item) =>
                      item.id === shape.id
                        ? {
                            ...item,
                            x: snapToGrid(nextShape.x, next.gridEnabled),
                            y: snapToGrid(nextShape.y, next.gridEnabled),
                          }
                        : item,
                    ),
                  };
                });
              }}
            >
              <span className="sr-only">{shape.kind}</span>
            </DraggableBoardItem>
          ))}

          {board.images.map((image) => (
            <DraggableBoardItem
              key={image.id}
              item={image}
              selected={selectedIds.includes(image.id)}
              canEdit={canEdit && tool === "select"}
              canDrag={tool === "select"}
              zoom={camera.zoom}
              className={`absolute bg-cover bg-center ${selectedIds.includes(image.id) ? "ring-2 ring-teal-700" : ""}`}
              style={{
                width: image.width,
                height: image.height,
                zIndex: image.zIndex,
                backgroundImage: `url(${image.src})`,
              }}
              onSelect={(additive) => {
                setSelectedIds((prev) =>
                  additive
                    ? prev.includes(image.id)
                      ? prev.filter((id) => id !== image.id)
                      : [...prev, image.id]
                    : [image.id],
                );
              }}
              onMove={(nextImage) => {
                updateBoard(pageId, (current) => {
                  const next = normalizeBoard(current);
                  return {
                    ...next,
                    images: next.images.map((item) =>
                      item.id === image.id
                        ? {
                            ...item,
                            x: snapToGrid(nextImage.x, next.gridEnabled),
                            y: snapToGrid(nextImage.y, next.gridEnabled),
                          }
                        : item,
                    ),
                  };
                });
              }}
            >
              <span className="sr-only">image</span>
            </DraggableBoardItem>
          ))}

          {board.stickies.map((sticky) => (
            <StickyNoteView
              key={sticky.id}
              sticky={sticky}
              selected={selectedIds.includes(sticky.id)}
              canEdit={canEdit && (tool === "select" || tool === "connector")}
              canDrag={tool === "select"}
              colorClass={COLOR_CLASS[sticky.color] ?? COLOR_CLASS.butter!}
              zoom={camera.zoom}
              onSelect={(additive) => {
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
                setSelectedIds((prev) =>
                  additive
                    ? prev.includes(sticky.id)
                      ? prev.filter((id) => id !== sticky.id)
                      : [...prev, sticky.id]
                    : [sticky.id],
                );
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
        {board.stickies.length === 0 && board.shapes.length === 0 && board.frames.length === 0 ? (
          <p className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
            {t("emptyHint")}
          </p>
        ) : null}

        {showMinimap ? (
          <div className="border-border/70 bg-background/90 absolute bottom-3 right-3 z-20 overflow-hidden rounded-md border p-1 shadow-sm">
            <div
              className="relative bg-[#e8efed]"
              style={{ width: Math.max(120, worldW * minimapScale), height: Math.max(80, worldH * minimapScale) }}
            >
              {board.stickies.map((sticky) => (
                <div
                  key={sticky.id}
                  className="absolute bg-[#f3e2a4]"
                  style={{
                    left: (sticky.x - contentBounds.minX) * minimapScale,
                    top: (sticky.y - contentBounds.minY) * minimapScale,
                    width: Math.max(2, sticky.width * minimapScale),
                    height: Math.max(2, sticky.height * minimapScale),
                  }}
                />
              ))}
              {board.frames.map((frame) => (
                <div
                  key={frame.id}
                  className="absolute border border-teal-700/60"
                  style={{
                    left: (frame.x - contentBounds.minX) * minimapScale,
                    top: (frame.y - contentBounds.minY) * minimapScale,
                    width: Math.max(2, frame.width * minimapScale),
                    height: Math.max(2, frame.height * minimapScale),
                  }}
                />
              ))}
              <div
                className="absolute border border-teal-800 bg-teal-700/20"
                style={{
                  left: (viewX - contentBounds.minX) * minimapScale,
                  top: (viewY - contentBounds.minY) * minimapScale,
                  width: Math.max(8, viewW * minimapScale),
                  height: Math.max(8, viewH * minimapScale),
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
