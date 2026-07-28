"use client";

import { useEffect, useState } from "react";
import {
  STICKY_COLOR_HEX,
  type StickyColor,
  type StickyNote,
} from "@/features/workflow/domain/document-data";
import { DraggableBoardItem } from "./draggable-board-item";

const NAMED = new Set<string>(Object.keys(STICKY_COLOR_HEX));

interface Props {
  sticky: StickyNote;
  selected: boolean;
  canEdit: boolean;
  canDrag?: boolean;
  canResize?: boolean;
  canRotate?: boolean;
  dragOffset?: { dx: number; dy: number } | null;
  zoom: number;
  onSelect: (additive: boolean) => void;
  onChange: (next: StickyNote) => void;
  onDragMove?: (dx: number, dy: number) => void;
  onDragEnd?: (dx: number, dy: number) => void;
}

function stickyBackground(color: string): string {
  if (NAMED.has(color)) {
    return STICKY_COLOR_HEX[color as StickyColor];
  }
  return color.startsWith("#") || color.startsWith("rgb") ? color : STICKY_COLOR_HEX.butter;
}

export function StickyNoteView({
  sticky,
  selected,
  canEdit,
  canDrag = true,
  canResize = true,
  canRotate = true,
  dragOffset = null,
  zoom,
  onSelect,
  onChange,
  onDragMove,
  onDragEnd,
}: Props) {
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!selected) {
      setEditing(false);
    }
  }, [selected]);

  return (
    <DraggableBoardItem
      item={sticky}
      selected={selected}
      canEdit={canEdit}
      canDrag={canDrag && !editing}
      canResize={canResize && !editing}
      canRotate={canRotate && !editing}
      dragOffset={dragOffset}
      zoom={zoom}
      minWidth={120}
      minHeight={100}
      className={`absolute flex flex-col overflow-visible rounded-md shadow-sm ${selected ? "ring-2 ring-teal-700" : ""}`}
      style={{ zIndex: sticky.zIndex, backgroundColor: stickyBackground(sticky.color) }}
      onSelect={onSelect}
      onChange={onChange}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      <div
        className="h-full w-full overflow-hidden rounded-md"
        onDoubleClick={(event) => {
          event.stopPropagation();
          if (!canEdit) {
            return;
          }
          onSelect(false);
          setEditing(true);
        }}
      >
        {editing ? (
          <textarea
            autoFocus
            className="h-full w-full resize-none bg-transparent p-3 text-sm text-zinc-900 outline-none"
            value={sticky.text}
            onChange={(event) => {
              onChange({ ...sticky, text: event.target.value });
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onBlur={() => setEditing(false)}
          />
        ) : (
          <div className="h-full w-full overflow-hidden p-3 text-sm whitespace-pre-wrap text-zinc-900">
            {sticky.text || " "}
          </div>
        )}
      </div>
    </DraggableBoardItem>
  );
}
