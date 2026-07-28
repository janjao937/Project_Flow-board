"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type Box = { x: number; y: number; width: number; height: number };

type ResizeCorner = "nw" | "ne" | "sw" | "se";

interface Props<T extends Box> {
  item: T;
  selected: boolean;
  canEdit: boolean;
  canDrag?: boolean;
  canResize?: boolean;
  /** When true, resize keeps aspect ratio unless Alt is held. */
  lockAspectRatio?: boolean;
  zoom: number;
  minWidth?: number;
  minHeight?: number;
  className?: string;
  style?: CSSProperties;
  onSelect: (additive: boolean) => void;
  onChange: (next: T) => void;
  children: ReactNode;
}

const CORNERS: Array<{ id: ResizeCorner; className: string; cursor: string }> = [
  { id: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "nwse-resize" },
  { id: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2", cursor: "nesw-resize" },
  { id: "sw", className: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2", cursor: "nesw-resize" },
  { id: "se", className: "bottom-0 right-0 translate-x-1/2 translate-y-1/2", cursor: "nwse-resize" },
];

function scaleBox(
  start: Box,
  corner: ResizeCorner,
  dx: number,
  dy: number,
  proportional: boolean,
  minWidth: number,
  minHeight: number,
): Box {
  let { x, y, width, height } = start;
  const aspect = start.width / Math.max(1, start.height);

  if (corner.includes("e")) {
    width = start.width + dx;
  }
  if (corner.includes("w")) {
    width = start.width - dx;
    x = start.x + dx;
  }
  if (corner.includes("s")) {
    height = start.height + dy;
  }
  if (corner.includes("n")) {
    height = start.height - dy;
    y = start.y + dy;
  }

  if (proportional) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      height = width / aspect;
      if (corner.includes("n")) {
        y = start.y + start.height - height;
      }
    } else {
      width = height * aspect;
      if (corner.includes("w")) {
        x = start.x + start.width - width;
      }
    }
  }

  if (width < minWidth) {
    if (corner.includes("w")) {
      x -= minWidth - width;
    }
    width = minWidth;
  }
  if (height < minHeight) {
    if (corner.includes("n")) {
      y -= minHeight - height;
    }
    height = minHeight;
  }

  return { x, y, width, height };
}

export function DraggableBoardItem<T extends Box>({
  item,
  selected,
  canEdit,
  canDrag = true,
  canResize = true,
  lockAspectRatio = false,
  zoom,
  minWidth = 48,
  minHeight = 40,
  className,
  style,
  onSelect,
  onChange,
  children,
}: Props<T>) {
  const [draft, setDraft] = useState(item);
  const draftRef = useRef(item);
  const drag = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);
  const resize = useRef<{
    ox: number;
    oy: number;
    start: Box;
    corner: ResizeCorner;
    proportional: boolean;
  } | null>(null);
  const moved = useRef(false);

  draftRef.current = draft;

  useEffect(() => {
    if (!drag.current && !resize.current) {
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
        width: draft.width,
        height: draft.height,
        cursor: canEdit && canDrag ? "grab" : undefined,
      }}
      onPointerDown={(event) => {
        if (!canEdit) {
          return;
        }
        if ((event.target as HTMLElement).dataset.resize === "1") {
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
        const activeDrag = drag.current;
        if (activeDrag) {
          const dx = (event.clientX - activeDrag.ox) / zoom;
          const dy = (event.clientY - activeDrag.oy) / zoom;
          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            moved.current = true;
          }
          const nextX = activeDrag.sx + dx;
          const nextY = activeDrag.sy + dy;
          setDraft((prev) => ({ ...prev, x: nextX, y: nextY }));
        }
        const activeResize = resize.current;
        if (activeResize) {
          const dx = (event.clientX - activeResize.ox) / zoom;
          const dy = (event.clientY - activeResize.oy) / zoom;
          moved.current = true;
          const next = scaleBox(
            activeResize.start,
            activeResize.corner,
            dx,
            dy,
            activeResize.proportional || event.shiftKey || (lockAspectRatio && !event.altKey),
            minWidth,
            minHeight,
          );
          setDraft((prev) => ({ ...prev, ...next }));
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
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {children}
      {canEdit && canResize && selected ? (
        <>
          {CORNERS.map((corner) => (
            <div
              key={corner.id}
              data-resize="1"
              className={`bg-background absolute z-20 h-3 w-3 rounded-sm border-2 border-teal-700 ${corner.className}`}
              style={{ cursor: corner.cursor }}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelect(false);
                resize.current = {
                  ox: event.clientX,
                  oy: event.clientY,
                  start: {
                    x: draft.x,
                    y: draft.y,
                    width: draft.width,
                    height: draft.height,
                  },
                  corner: corner.id,
                  proportional: lockAspectRatio ? !event.altKey : event.shiftKey,
                };
                moved.current = false;
                (event.currentTarget.parentElement as HTMLElement | null)?.setPointerCapture(event.pointerId);
              }}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}
