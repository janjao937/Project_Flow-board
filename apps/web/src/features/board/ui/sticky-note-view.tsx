"use client";

import { useRef } from "react";
import type { StickyNote } from "@/features/workflow/domain/document-data";

interface Props {
  sticky: StickyNote;
  selected: boolean;
  colorClass: string;
  zoom: number;
  onSelect: () => void;
  onChange: (next: StickyNote) => void;
}

export function StickyNoteView({ sticky, selected, colorClass, zoom, onSelect, onChange }: Props) {
  const drag = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);
  const resize = useRef<{ ox: number; oy: number; sw: number; sh: number } | null>(null);

  return (
    <div
      className={`absolute flex flex-col rounded-md shadow-sm ${colorClass} ${selected ? "ring-2 ring-teal-700" : ""}`}
      style={{
        left: sticky.x,
        top: sticky.y,
        width: sticky.width,
        height: sticky.height,
        zIndex: sticky.zIndex,
      }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).dataset.resize === "1") {
          return;
        }
        event.stopPropagation();
        onSelect();
        drag.current = {
          ox: event.clientX,
          oy: event.clientY,
          sx: sticky.x,
          sy: sticky.y,
        };
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (drag.current) {
          const dx = (event.clientX - drag.current.ox) / zoom;
          const dy = (event.clientY - drag.current.oy) / zoom;
          onChange({ ...sticky, x: drag.current.sx + dx, y: drag.current.sy + dy });
        }
        if (resize.current) {
          const dx = (event.clientX - resize.current.ox) / zoom;
          const dy = (event.clientY - resize.current.oy) / zoom;
          onChange({
            ...sticky,
            width: Math.max(120, resize.current.sw + dx),
            height: Math.max(100, resize.current.sh + dy),
          });
        }
      }}
      onPointerUp={() => {
        drag.current = null;
        resize.current = null;
      }}
    >
      <textarea
        className="h-full w-full resize-none bg-transparent p-3 text-sm text-zinc-900 outline-none"
        value={sticky.text}
        onChange={(event) => onChange({ ...sticky, text: event.target.value })}
        onPointerDown={(event) => event.stopPropagation()}
      />
      <div
        data-resize="1"
        className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect();
          resize.current = {
            ox: event.clientX,
            oy: event.clientY,
            sw: sticky.width,
            sh: sticky.height,
          };
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!resize.current) {
            return;
          }
          const dx = (event.clientX - resize.current.ox) / zoom;
          const dy = (event.clientY - resize.current.oy) / zoom;
          onChange({
            ...sticky,
            width: Math.max(120, resize.current.sw + dx),
            height: Math.max(100, resize.current.sh + dy),
          });
        }}
        onPointerUp={() => {
          resize.current = null;
        }}
      />
    </div>
  );
}
