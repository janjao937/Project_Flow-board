"use client";

import { useEffect, useState } from "react";
import type { BoardText } from "@/features/workflow/domain/document-data";
import { DraggableBoardItem } from "./draggable-board-item";

interface Props {
  textBox: BoardText;
  selected: boolean;
  canEdit: boolean;
  canDrag?: boolean;
  canResize?: boolean;
  canRotate?: boolean;
  autoEdit?: boolean;
  dragOffset?: { dx: number; dy: number } | null;
  zoom: number;
  onSelect: (additive: boolean) => void;
  onChange: (next: BoardText) => void;
  onDragMove?: (dx: number, dy: number) => void;
  onDragEnd?: (dx: number, dy: number) => void;
  onEditEnd?: () => void;
}

export function TextBoxView({
  textBox,
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
  const [textDraft, setTextDraft] = useState(textBox.text);

  useEffect(() => {
    if (!editing) {
      setTextDraft(textBox.text);
    }
  }, [textBox.text, editing]);

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
    setTextDraft(textBox.text);
    setEditing(true);
  };

  const commitEdit = () => {
    if (textDraft !== textBox.text) {
      onChange({ ...textBox, text: textDraft });
    }
    setEditing(false);
    onEditEnd?.();
  };

  return (
    <DraggableBoardItem
      item={textBox}
      selected={selected}
      canEdit={canEdit}
      canDrag={canDrag && !editing}
      canResize={canResize}
      canRotate={canRotate}
      dragOffset={dragOffset}
      zoom={zoom}
      minWidth={80}
      minHeight={36}
      className={`absolute overflow-visible ${selected ? "ring-2 ring-teal-700" : ""}`}
      style={{ zIndex: textBox.zIndex }}
      onSelect={onSelect}
      onChange={(next) => onChange({ ...next, text: editing ? textDraft : next.text })}
      onTransformStart={() => {
        if (editing && textDraft !== textBox.text) {
          onChange({ ...textBox, text: textDraft });
        }
      }}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      <div
        className="h-full w-full overflow-hidden"
        onDoubleClick={(event) => {
          event.stopPropagation();
          beginEdit();
        }}
      >
        {editing ? (
          <textarea
            autoFocus
            className="h-full w-full resize-none bg-transparent p-2 outline-none"
            style={{ color: textBox.color, fontSize: textBox.fontSize }}
            value={textDraft}
            placeholder="Type text…"
            onChange={(event) => setTextDraft(event.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Escape") {
                event.preventDefault();
                setTextDraft(textBox.text);
                setEditing(false);
                onEditEnd?.();
              }
            }}
            onBlur={commitEdit}
          />
        ) : (
          <div
            className="h-full w-full overflow-hidden p-2 whitespace-pre-wrap"
            style={{ color: textBox.color, fontSize: textBox.fontSize }}
          >
            {textBox.text || " "}
          </div>
        )}
      </div>
    </DraggableBoardItem>
  );
}
