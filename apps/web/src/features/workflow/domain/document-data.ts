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
  groupId?: string | null;
}

export type ShapeKind = "rect" | "ellipse" | "triangle" | "arrow";

export interface BoardShape {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  fill: string;
  zIndex: number;
  groupId?: string | null;
}

export interface BoardConnector {
  id: string;
  fromId: string;
  toId: string;
  fromAnchor: "n" | "s" | "e" | "w";
  toAnchor: "n" | "s" | "e" | "w";
}

export interface BoardImage {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  zIndex: number;
  groupId?: string | null;
}

export interface BoardFrame {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  zIndex: number;
}

export interface FreehandStroke {
  id: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  zIndex: number;
  groupId?: string | null;
}

export interface BoardGroup {
  id: string;
  memberIds: string[];
}

export interface BoardState {
  stickies: StickyNote[];
  shapes: BoardShape[];
  connectors: BoardConnector[];
  images: BoardImage[];
  frames: BoardFrame[];
  strokes: FreehandStroke[];
  groups: BoardGroup[];
  gridEnabled: boolean;
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

export type MilestoneStatus = "planned" | "active" | "done";

export interface RoadmapMilestone {
  id: string;
  title: string;
  date: string;
  startDate: string;
  endDate: string;
  status: MilestoneStatus;
  lane: string;
  dependsOn: string[];
  linkedCardIds: string[];
}

export interface RoadmapState {
  milestones: RoadmapMilestone[];
  lanes: string[];
}

export interface PlanBox {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  linkedCardIds: string[];
  capacityHours: number;
}

export interface PlanState {
  boxes: PlanBox[];
}

export interface WorkflowDocumentData {
  boards: Record<string, BoardState>;
  tasks: Record<string, TasksState>;
  roadmaps: Record<string, RoadmapState>;
  plans: Record<string, PlanState>;
}

export const STICKY_COLORS: StickyColor[] = ["butter", "mint", "sky", "blush", "fog"];
export const GRID_SIZE = 20;

export function snapToGrid(value: number, enabled: boolean): number {
  if (!enabled) {
    return value;
  }
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function createEmptyBoard(): BoardState {
  return {
    stickies: [],
    shapes: [],
    connectors: [],
    images: [],
    frames: [],
    strokes: [],
    groups: [],
    gridEnabled: false,
  };
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

export function createEmptyRoadmap(): RoadmapState {
  const now = new Date();
  const week = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7);
  const later = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
  const laterEnd = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 21);
  const kickoffStart = now.toISOString().slice(0, 10);
  const kickoffEnd = week.toISOString().slice(0, 10);
  const betaStart = later.toISOString().slice(0, 10);
  const betaEnd = laterEnd.toISOString().slice(0, 10);
  return {
    lanes: ["Product", "Engineering"],
    milestones: [
      {
        id: crypto.randomUUID(),
        title: "Kickoff",
        date: kickoffStart,
        startDate: kickoffStart,
        endDate: kickoffEnd,
        status: "active",
        lane: "Product",
        dependsOn: [],
        linkedCardIds: [],
      },
      {
        id: crypto.randomUUID(),
        title: "Beta",
        date: betaStart,
        startDate: betaStart,
        endDate: betaEnd,
        status: "planned",
        lane: "Engineering",
        dependsOn: [],
        linkedCardIds: [],
      },
    ],
  };
}

export function createEmptyPlan(): PlanState {
  const start = new Date();
  const end = new Date(start.getTime() + 1000 * 60 * 60 * 24 * 7);
  return {
    boxes: [
      {
        id: crypto.randomUUID(),
        title: "Sprint 1",
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        linkedCardIds: [],
        capacityHours: 40,
      },
    ],
  };
}

export function createDocumentData(
  boardPageId: string,
  tasksPageId: string,
  roadmapPageId: string,
  planPageId: string,
): WorkflowDocumentData {
  return {
    boards: { [boardPageId]: createEmptyBoard() },
    tasks: { [tasksPageId]: createEmptyTasks() },
    roadmaps: { [roadmapPageId]: createEmptyRoadmap() },
    plans: { [planPageId]: createEmptyPlan() },
  };
}

export function encodeDocumentData(data: WorkflowDocumentData): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(data));
}

export function decodeDocumentData(bytes: Uint8Array): WorkflowDocumentData {
  if (bytes.byteLength === 0) {
    return { boards: {}, tasks: {}, roadmaps: {}, plans: {} };
  }
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as WorkflowDocumentData;
  const boards: Record<string, BoardState> = {};
  for (const [id, board] of Object.entries(parsed.boards ?? {})) {
    boards[id] = {
      stickies: board.stickies ?? [],
      shapes: board.shapes ?? [],
      connectors: board.connectors ?? [],
      images: board.images ?? [],
      frames: board.frames ?? [],
      strokes: board.strokes ?? [],
      groups: board.groups ?? [],
      gridEnabled: board.gridEnabled ?? false,
    };
  }
  const roadmaps: Record<string, RoadmapState> = {};
  for (const [id, roadmap] of Object.entries(parsed.roadmaps ?? {})) {
    const lanes =
      Array.isArray(roadmap.lanes) && roadmap.lanes.length > 0 ? roadmap.lanes : ["Product"];
    roadmaps[id] = {
      lanes,
      milestones: (roadmap.milestones ?? []).map((milestone) => {
        const startDate = milestone.startDate || milestone.date || new Date().toISOString().slice(0, 10);
        const endDate =
          milestone.endDate && milestone.endDate >= startDate ? milestone.endDate : startDate;
        const status =
          milestone.status === "active" || milestone.status === "done" || milestone.status === "planned"
            ? milestone.status
            : "planned";
        return {
          id: milestone.id,
          title: milestone.title ?? "Milestone",
          date: startDate,
          startDate,
          endDate,
          status,
          lane: milestone.lane || lanes[0] || "Product",
          dependsOn: milestone.dependsOn ?? [],
          linkedCardIds: milestone.linkedCardIds ?? [],
        };
      }),
    };
  }

  return {
    boards,
    tasks: parsed.tasks ?? {},
    roadmaps,
    plans: parsed.plans ?? {},
  };
}
