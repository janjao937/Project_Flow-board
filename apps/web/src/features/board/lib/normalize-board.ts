import { createEmptyBoard, type BoardState } from "@/features/workflow/domain/document-data";

export const EMPTY_BOARD: BoardState = createEmptyBoard();

export function normalizeBoard(current: BoardState | null | undefined): BoardState {
  if (!current) {
    return EMPTY_BOARD;
  }
  if (
    current.stickies &&
    current.shapes &&
    current.connectors &&
    current.images &&
    current.frames &&
    current.strokes &&
    current.groups &&
    typeof current.gridEnabled === "boolean"
  ) {
    return current;
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
