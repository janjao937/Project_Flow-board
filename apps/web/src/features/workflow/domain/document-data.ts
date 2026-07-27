export type StickyColor = "butter" | "mint" | "sky" | "blush" | "fog";

export interface StickyNote {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: StickyColor;
  zIndex: number;
}

export interface BoardState {
  stickies: StickyNote[];
}

export interface TaskLabel {
  id: string;
  name: string;
  color: string;
}

export interface TaskCard {
  id: string;
  title: string;
  labelIds: string[];
}

export interface TaskList {
  id: string;
  title: string;
  cardIds: string[];
}

export interface TasksState {
  lists: TaskList[];
  cards: Record<string, TaskCard>;
  labels: TaskLabel[];
}

export interface WorkflowDocumentData {
  boards: Record<string, BoardState>;
  tasks: Record<string, TasksState>;
}

export const STICKY_COLORS: StickyColor[] = ["butter", "mint", "sky", "blush", "fog"];

export function createEmptyBoard(): BoardState {
  return { stickies: [] };
}

export function createEmptyTasks(): TasksState {
  const todoId = crypto.randomUUID();
  const doingId = crypto.randomUUID();
  const doneId = crypto.randomUUID();
  return {
    lists: [
      { id: todoId, title: "To do", cardIds: [] },
      { id: doingId, title: "Doing", cardIds: [] },
      { id: doneId, title: "Done", cardIds: [] },
    ],
    cards: {},
    labels: [
      { id: crypto.randomUUID(), name: "Priority", color: "#0f766e" },
      { id: crypto.randomUUID(), name: "Design", color: "#0369a1" },
    ],
  };
}

export function createDocumentData(boardPageId: string, tasksPageId: string): WorkflowDocumentData {
  return {
    boards: { [boardPageId]: createEmptyBoard() },
    tasks: { [tasksPageId]: createEmptyTasks() },
  };
}

export function encodeDocumentData(data: WorkflowDocumentData): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(data));
}

export function decodeDocumentData(bytes: Uint8Array): WorkflowDocumentData {
  if (bytes.byteLength === 0) {
    return { boards: {}, tasks: {} };
  }
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as WorkflowDocumentData;
  return {
    boards: parsed.boards ?? {},
    tasks: parsed.tasks ?? {},
  };
}
