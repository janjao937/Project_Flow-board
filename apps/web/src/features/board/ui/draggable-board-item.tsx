"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type Box = { x: number; y: number; width: number; height: number; rotation?: number };

type ResizeCorner = "nw" | "ne" | "sw" | "se";

interface Props<T extends Box> {
  item: T;
  selected: boolean;
  canEdit: boolean;
  canDrag?: boolean;
  canResize?: boolean;
  canRotate?: boolean;
  /** When true, resize keeps aspect ratio unless Alt is held. */
  lockAspectRatio?: boolean;
  /** Live multi-select / group drag offset in world units. */
  dragOffset?: { dx: number; dy: number } | null;
  zoom: number;
  minWidth?: number;
  minHeight?: number;
  className?: string;
  style?: CSSProperties;
  onSelect: (additive: boolean) => void;
  onChange: (next: T) => void;
  /** Click without drag — e.g. enter text edit. */
  onTap?: () => void;
  /** Called while dragging; parent can move the whole selection. */
  onDragMove?: (dx: number, dy: number) => void;
  /** Called when a drag ends; parent should commit selection move. */
  onDragEnd?: (dx: number, dy: number) => void;
  children: ReactNode;
}

const CORNERS: Array<{ id: ResizeCorner; className: string; cursor: string }> = [
  { id: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "nwse-resize" },
  { id: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2", cursor: "nesw-resize" },
  { id: "sw", className: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2", cursor: "nesw-resize" },
  { id: "se", className: "bottom-0 right-0 translate-x-1/2 translate-y-1/2", cursor: "nwse-resize" },
];

function toLocalDelta(dx: number, dy: number, rotationDeg: number) {
  const rad = (-rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { dx: dx * cos - dy * sin, dy: dx * sin + dy * cos };
}

function normalizeRotation(deg: number) {
  let next = deg % 360;
  if (next > 180) {
    next -= 360;
  }
  if (next <= -180) {
    next += 360;
  }
  return Math.round(next * 10) / 10;
}

function scaleBox(
  start: Box,
  corner: ResizeCorner,
  dx: number,
  dy: number,
  proportional: boolean,
  minWidth: number,
  minHeight: number,
): Pick<Box, "x" | "y" | "width" | "height"> {
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
  canRotate = true,
  lockAspectRatio = false,
  dragOffset = null,
  zoom,
  minWidth = 48,
  minHeight = 40,
  className,
  style,
  onSelect,
  onChange,
  onTap,
  onDragMove,
  onDragEnd,
  children,
}: Props<T>) {
  const [draft, setDraft] = useState(item);
  const draftRef = useRef(item);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ ox: number; oy: number; capturing: boolean } | null>(null);
  const resize = useRef<{
    ox: number;
    oy: number;
    start: Box;
    corner: ResizeCorner;
    proportional: boolean;
  } | null>(null);
  const rotate = useRef<{
    startPointerAngle: number;
    startRotation: number;
    cx: number;
    cy: number;
  } | null>(null);
  const moved = useRef(false);
  const lastDelta = useRef({ dx: 0, dy: 0 });

  draftRef.current = draft;
  const rotation = draft.rotation ?? 0;
  const offsetX = dragOffset?.dx ?? 0;
  const offsetY = dragOffset?.dy ?? 0;

  useEffect(() => {
    if (!drag.current && !resize.current && !rotate.current) {
      setDraft(item);
    }
  }, [item]);

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        ...style,
        left: draft.x + offsetX,
        top: draft.y + offsetY,
        width: draft.width,
        height: draft.height,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "center center",
        cursor: canEdit && canDrag ? "grab" : undefined,
      }}
      onPointerDown={(event) => {
        if (!canEdit) {
          return;
        }
        if ((event.target as HTMLElement).dataset.handle) {
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
        // Delay pointer capture until the pointer actually moves — keeps double-click / tap-to-edit working.
        drag.current = { ox: event.clientX, oy: event.clientY, capturing: false };
        lastDelta.current = { dx: 0, dy: 0 };
        moved.current = false;
      }}
      onPointerMove={(event) => {
        const activeDrag = drag.current;
        if (activeDrag) {
          const dx = (event.clientX - activeDrag.ox) / zoom;
          const dy = (event.clientY - activeDrag.oy) / zoom;
          if (!activeDrag.capturing && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
            activeDrag.capturing = true;
            moved.current = true;
            rootRef.current?.setPointerCapture(event.pointerId);
          }
          if (!activeDrag.capturing) {
            return;
          }
          moved.current = true;
          lastDelta.current = { dx, dy };
          if (onDragMove) {
            onDragMove(dx, dy);
          } else {
            setDraft((prev) => ({ ...prev, x: item.x + dx, y: item.y + dy }));
          }
        }
        const activeResize = resize.current;
        if (activeResize) {
          const screenDx = (event.clientX - activeResize.ox) / zoom;
          const screenDy = (event.clientY - activeResize.oy) / zoom;
          const local = toLocalDelta(screenDx, screenDy, activeResize.start.rotation ?? 0);
          moved.current = true;
          const next = scaleBox(
            activeResize.start,
            activeResize.corner,
            local.dx,
            local.dy,
            activeResize.proportional || event.shiftKey || (lockAspectRatio && !event.altKey),
            minWidth,
            minHeight,
          );
          setDraft((prev) => ({ ...prev, ...next }));
        }
        const activeRotate = rotate.current;
        if (activeRotate) {
          const angle =
            (Math.atan2(event.clientY - activeRotate.cy, event.clientX - activeRotate.cx) * 180) /
            Math.PI;
          let nextRotation = activeRotate.startRotation + (angle - activeRotate.startPointerAngle);
          if (event.shiftKey) {
            nextRotation = Math.round(nextRotation / 15) * 15;
          }
          moved.current = true;
          setDraft((prev) => ({ ...prev, rotation: normalizeRotation(nextRotation) }));
        }
      }}
      onPointerUp={() => {
        const wasDrag = Boolean(drag.current);
        const didMove = moved.current;
        if (didMove) {
          if (drag.current) {
            const { dx, dy } = lastDelta.current;
            if (onDragEnd) {
              onDragEnd(dx, dy);
            } else {
              onChange(draftRef.current);
            }
          } else if (resize.current || rotate.current) {
            onChange(draftRef.current);
          }
        } else if (wasDrag && onTap) {
          onTap();
        }
        drag.current = null;
        resize.current = null;
        rotate.current = null;
        moved.current = false;
        lastDelta.current = { dx: 0, dy: 0 };
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {children}
      {canEdit && selected ? (
        <>
          {canResize
            ? CORNERS.map((corner) => (
                <div
                  key={corner.id}
                  data-handle="resize"
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
                        rotation,
                      },
                      corner: corner.id,
                      proportional: lockAspectRatio ? !event.altKey : event.shiftKey,
                    };
                    moved.current = false;
                    rootRef.current?.setPointerCapture(event.pointerId);
                  }}
                />
              ))
            : null}
          {canRotate ? (
            <>
              <div
                className="pointer-events-none absolute left-1/2 top-0 z-10 h-5 w-px -translate-x-1/2 -translate-y-full bg-teal-700"
                aria-hidden
              />
              <div
                data-handle="rotate"
                title="Rotate (Shift: 15°)"
                className="bg-background absolute left-1/2 top-0 z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-[calc(100%+14px)] cursor-grab rounded-full border-2 border-teal-700"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onSelect(false);
                  const rect = rootRef.current?.getBoundingClientRect();
                  if (!rect) {
                    return;
                  }
                  const cx = rect.left + rect.width / 2;
                  const cy = rect.top + rect.height / 2;
                  rotate.current = {
                    startPointerAngle: (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI,
                    startRotation: rotation,
                    cx,
                    cy,
                  };
                  moved.current = false;
                  rootRef.current?.setPointerCapture(event.pointerId);
                }}
              />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
