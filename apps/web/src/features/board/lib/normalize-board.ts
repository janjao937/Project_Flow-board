import { createEmptyBoard, type BoardState } from "@/features/workflow/domain/document-data";

export function normalizeBoard(current: BoardState | null | undefined): BoardState {
  const empty = createEmptyBoard();
  if (!current) {
    return empty;
  }
  return {
    stickies: current.stickies ?? [],
    shapes: current.shapes ?? [],
    connectors: current.connectors ?? [],
    images: current.images ?? [],
    frames: current.frames ?? [],
    strokes: current.strokes ?? [],
    groups: current.groups ?? [],
    gridEnabled: current.gridEnabled ?? false,
  };
}
