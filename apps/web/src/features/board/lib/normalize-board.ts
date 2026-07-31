import { createEmptyBoard, type BoardState } from "@/features/workflow/domain/document-data";

export const EMPTY_BOARD: BoardState = createEmptyBoard();

export function normalizeBoard(current: BoardState | null | undefined): BoardState {
  if (!current) {
    return EMPTY_BOARD;
  }
  return {
    stickies: current.stickies ?? [],
    shapes: current.shapes ?? [],
    connectors: current.connectors ?? [],
    images: current.images ?? [],
    frames: current.frames ?? [],
    texts: current.texts ?? [],
    strokes: current.strokes ?? [],
    groups: current.groups ?? [],
    gridEnabled: current.gridEnabled ?? false,
  };
}
