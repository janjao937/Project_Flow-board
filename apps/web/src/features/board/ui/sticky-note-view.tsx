"use client";

import { useEffect, useState } from "react";
import type { StickyNote } from "@/features/workflow/domain/document-data";
import { DraggableBoardItem } from "./draggable-board-item";

interface Props {
  sticky: StickyNote;
  selected: boolean;
  canEdit: boolean;
  canDrag?: boolean;
  canResize?: boolean;
  colorClass: string;
  zoom: number;
  onSelect: (additive: boolean) => void;
  onChange: (next: StickyNote) => void;
}

export function StickyNoteView({
  sticky,
  selected,
  canEdit,
  canDrag = true,
  canResize = true,
  colorClass,
  zoom,
  onSelect,
  onChange,
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
      zoom={zoom}
      minWidth={120}
      minHeight={100}
      className={`absolute flex flex-col overflow-visible rounded-md shadow-sm ${colorClass} ${selected ? "ring-2 ring-teal-700" : ""}`}
      style={{ zIndex: sticky.zIndex }}
      onSelect={onSelect}
      onChange={onChange}
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
