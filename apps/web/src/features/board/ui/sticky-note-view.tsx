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
  autoEdit?: boolean;
  dragOffset?: { dx: number; dy: number } | null;
  zoom: number;
  onSelect: (additive: boolean) => void;
  onChange: (next: StickyNote) => void;
  onDragMove?: (dx: number, dy: number) => void;
  onDragEnd?: (dx: number, dy: number) => void;
  onEditEnd?: () => void;
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
  autoEdit = false,
  dragOffset = null,
  zoom,
  onSelect,
  onChange,
  onDragMove,
  onDragEnd,
  onEditEnd,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [textDraft, setTextDraft] = useState(sticky.text);

  useEffect(() => {
    if (!editing) {
      setTextDraft(sticky.text);
    }
  }, [sticky.text, editing]);

  useEffect(() => {
    if (!selected) {
      setEditing(false);
    }
  }, [selected]);

  useEffect(() => {
    if (autoEdit && canEdit && selected) {
      setEditing(true);
    }
  }, [autoEdit, canEdit, selected]);

  const beginEdit = () => {
    if (!canEdit) {
      return;
    }
    onSelect(false);
    setTextDraft(sticky.text);
    setEditing(true);
  };

  const commitEdit = () => {
    if (textDraft !== sticky.text) {
      onChange({ ...sticky, text: textDraft });
    }
    setEditing(false);
    onEditEnd?.();
  };

  return (
    <DraggableBoardItem
      item={sticky}
      selected={selected}
      canEdit={canEdit}
      canDrag={canDrag && !editing}
      canResize={canResize}
      canRotate={canRotate}
      dragOffset={dragOffset}
      zoom={zoom}
      minWidth={120}
      minHeight={100}
      className={`absolute flex flex-col overflow-visible rounded-md shadow-sm ${selected ? "ring-2 ring-teal-700" : ""}`}
      style={{ zIndex: sticky.zIndex, backgroundColor: stickyBackground(sticky.color) }}
      onSelect={onSelect}
      onChange={(next) => onChange({ ...next, text: editing ? textDraft : next.text })}
      onTransformStart={() => {
        if (editing && textDraft !== sticky.text) {
          onChange({ ...sticky, text: textDraft });
        }
      }}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      <div
        className="h-full w-full overflow-hidden rounded-md"
        onDoubleClick={(event) => {
          event.stopPropagation();
          beginEdit();
        }}
      >
        {editing ? (
          <textarea
            autoFocus
            className="h-full w-full resize-none bg-transparent p-3 text-sm text-zinc-900 outline-none"
            value={textDraft}
            placeholder="Type here…"
            onChange={(event) => setTextDraft(event.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Escape") {
                event.preventDefault();
                setTextDraft(sticky.text);
                setEditing(false);
                onEditEnd?.();
              }
            }}
            onBlur={commitEdit}
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
