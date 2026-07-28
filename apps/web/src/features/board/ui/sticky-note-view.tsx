"use client";

import { useEffect, useRef, useState } from "react";
import type { StickyNote } from "@/features/workflow/domain/document-data";

interface Props {
  sticky: StickyNote;
  selected: boolean;
  canEdit: boolean;
  canDrag?: boolean;
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
  colorClass,
  zoom,
  onSelect,
  onChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sticky);
  const draftRef = useRef(sticky);
  const drag = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);
  const resize = useRef<{ ox: number; oy: number; sw: number; sh: number } | null>(null);
  const moved = useRef(false);

  draftRef.current = draft;

  useEffect(() => {
    if (!drag.current && !resize.current) {
      setDraft(sticky);
    }
  }, [sticky]);

  useEffect(() => {
    if (!selected) {
      setEditing(false);
    }
  }, [selected]);

  return (
    <div
      className={`absolute flex flex-col overflow-hidden rounded-md shadow-sm ${colorClass} ${selected ? "ring-2 ring-teal-700" : ""}`}
      style={{
        left: draft.x,
        top: draft.y,
        width: draft.width,
        height: draft.height,
        zIndex: draft.zIndex,
        cursor: canEdit && canDrag && !editing ? "grab" : undefined,
      }}
      onPointerDown={(event) => {
        if (!canEdit || editing || (event.target as HTMLElement).dataset.resize === "1") {
          return;
        }
        event.stopPropagation();
        onSelect(event.shiftKey);
        if (!canDrag) {
          return;
        }
        drag.current = {
          ox: event.clientX,
          oy: event.clientY,
          sx: draft.x,
          sy: draft.y,
        };
        moved.current = false;
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (drag.current) {
          const dx = (event.clientX - drag.current.ox) / zoom;
          const dy = (event.clientY - drag.current.oy) / zoom;
          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            moved.current = true;
          }
          setDraft((prev) => ({ ...prev, x: drag.current!.sx + dx, y: drag.current!.sy + dy }));
        }
        if (resize.current) {
          const dx = (event.clientX - resize.current.ox) / zoom;
          const dy = (event.clientY - resize.current.oy) / zoom;
          moved.current = true;
          setDraft((prev) => ({
            ...prev,
            width: Math.max(120, resize.current!.sw + dx),
            height: Math.max(100, resize.current!.sh + dy),
          }));
        }
      }}
      onPointerUp={() => {
        if ((drag.current || resize.current) && moved.current) {
          onChange(draftRef.current);
        }
        drag.current = null;
        resize.current = null;
        moved.current = false;
      }}
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
          value={draft.text}
          onChange={(event) => {
            const text = event.target.value;
            const next = { ...draft, text };
            setDraft(next);
            onChange(next);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onBlur={() => setEditing(false)}
        />
      ) : (
        <div className="h-full w-full overflow-hidden p-3 text-sm whitespace-pre-wrap text-zinc-900">
          {draft.text || " "}
        </div>
      )}
      {canEdit ? (
        <div
          data-resize="1"
          className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelect(false);
            resize.current = {
              ox: event.clientX,
              oy: event.clientY,
              sw: draft.width,
              sh: draft.height,
            };
            moved.current = false;
            (event.currentTarget.parentElement as HTMLElement | null)?.setPointerCapture(event.pointerId);
          }}
        />
      ) : null}
    </div>
  );
}
