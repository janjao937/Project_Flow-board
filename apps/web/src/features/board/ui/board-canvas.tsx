"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { STICKY_COLORS, type StickyNote } from "@/features/workflow/domain/document-data";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";
import { StickyNoteView } from "./sticky-note-view";

type Tool = "select" | "pan";

const COLOR_CLASS: Record<string, string> = {
  butter: "bg-[#f3e2a4]",
  mint: "bg-[#b8e0d2]",
  sky: "bg-[#a9d4ef]",
  blush: "bg-[#f0c4c0]",
  fog: "bg-[#d9dde3]",
};

export function BoardCanvas({ pageId }: { pageId: string }) {
  const t = useTranslations("board");
  const board = useWorkflowStore((s) => s.data?.boards[pageId] ?? { stickies: [] });
  const updateBoard = useWorkflowStore((s) => s.updateBoard);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);

  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const panRef = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const addSticky = useCallback(
    (x: number, y: number) => {
      const sticky: StickyNote = {
        id: crypto.randomUUID(),
        x,
        y,
        width: 180,
        height: 160,
        text: "",
        color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)] ?? "butter",
        zIndex: board.stickies.length + 1,
      };
      updateBoard(pageId, (current) => ({ stickies: [...current.stickies, sticky] }));
      setSelectedId(sticky.id);
    },
    [board.stickies.length, pageId, updateBoard],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
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
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!selectedId) {
          return;
        }
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) {
          return;
        }
        updateBoard(pageId, (current) => ({
          stickies: current.stickies.filter((item) => item.id !== selectedId),
        }));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageId, redo, selectedId, undo, updateBoard]);

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

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div className="border-border/60 bg-background/80 absolute inset-x-0 top-0 z-20 flex items-center gap-1 border-b px-2 py-2 backdrop-blur md:px-3">
        <Button size="sm" variant={tool === "select" ? "default" : "ghost"} onClick={() => setTool("select")}>
          {t("select")}
        </Button>
        <Button size="sm" variant={tool === "pan" ? "default" : "ghost"} onClick={() => setTool("pan")}>
          {t("pan")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const world = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
            addSticky(world.x - 90, world.y - 80);
          }}
        >
          {t("addSticky")}
        </Button>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={undo}>
            {t("undo")}
          </Button>
          <Button size="sm" variant="ghost" onClick={redo}>
            {t("redo")}
          </Button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="board-surface relative mt-12 min-h-0 flex-1 touch-none overflow-hidden"
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
          if (tool !== "select") {
            return;
          }
          const world = screenToWorld(event.clientX, event.clientY);
          addSticky(world.x - 90, world.y - 80);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setSelectedId(null);
          }
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
          {board.stickies.map((sticky) => (
            <StickyNoteView
              key={sticky.id}
              sticky={sticky}
              selected={selectedId === sticky.id}
              colorClass={COLOR_CLASS[sticky.color] ?? COLOR_CLASS.butter}
              zoom={camera.zoom}
              onSelect={() => setSelectedId(sticky.id)}
              onChange={(next) => {
                updateBoard(pageId, (current) => ({
                  stickies: current.stickies.map((item) => (item.id === next.id ? next : item)),
                }));
              }}
            />
          ))}
        </div>
        {board.stickies.length === 0 ? (
          <p className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
            {t("emptyHint")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
