"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Box = { x: number; y: number };

interface Props<T extends Box> {
  item: T;
  selected: boolean;
  canEdit: boolean;
  canDrag?: boolean;
  zoom: number;
  className?: string;
  style?: React.CSSProperties;
  onSelect: (additive: boolean) => void;
  onMove: (next: T) => void;
  children: ReactNode;
}

export function DraggableBoardItem<T extends Box>({
  item,
  selected,
  canEdit,
  canDrag = true,
  zoom,
  className,
  style,
  onSelect,
  onMove,
  children,
}: Props<T>) {
  const [draft, setDraft] = useState(item);
  const draftRef = useRef(item);
  const drag = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);
  const moved = useRef(false);

  draftRef.current = draft;

  useEffect(() => {
    if (!drag.current) {
      setDraft(item);
    }
  }, [item]);

  return (
    <div
      className={className}
      style={{
        ...style,
        left: draft.x,
        top: draft.y,
        cursor: canEdit && canDrag ? "grab" : undefined,
      }}
      onPointerDown={(event) => {
        if (!canEdit) {
          return;
        }
        if ((event.target as HTMLElement).closest("input,textarea,button")) {
          onSelect(event.shiftKey);
          event.stopPropagation();
          return;
        }
        event.stopPropagation();
        onSelect(event.shiftKey);
        if (!canDrag) {
          return;
        }
        drag.current = { ox: event.clientX, oy: event.clientY, sx: draft.x, sy: draft.y };
        moved.current = false;
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current) {
          return;
        }
        const dx = (event.clientX - drag.current.ox) / zoom;
        const dy = (event.clientY - drag.current.oy) / zoom;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          moved.current = true;
        }
        setDraft((prev) => ({ ...prev, x: drag.current!.sx + dx, y: drag.current!.sy + dy }));
      }}
      onPointerUp={() => {
        if (drag.current && moved.current) {
          onMove(draftRef.current);
        }
        drag.current = null;
        moved.current = false;
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
