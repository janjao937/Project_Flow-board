import type { RoadmapState } from "@/features/workflow/domain/document-data";
import { normalizeMilestone } from "./normalize";

function uniqueLaneName(lanes: string[], base: string): string {
  const trimmed = base.trim() || "Lane";
  if (!lanes.includes(trimmed)) {
    return trimmed;
  }
  let index = 2;
  while (lanes.includes(`${trimmed} ${index}`)) {
    index += 1;
  }
  return `${trimmed} ${index}`;
}

export function ensureLanes(state: RoadmapState): string[] {
  return state.lanes.length > 0 ? [...state.lanes] : ["Product"];
}

export function addLane(state: RoadmapState, name = "Lane"): RoadmapState {
  const lanes = ensureLanes(state);
  return {
    ...state,
    lanes: [...lanes, uniqueLaneName(lanes, name)],
  };
}

export function renameLane(state: RoadmapState, from: string, to: string): RoadmapState {
  const lanes = ensureLanes(state);
  if (!lanes.includes(from)) {
    return state;
  }
  const nextName = to.trim();
  if (!nextName || nextName === from) {
    return state;
  }
  if (lanes.includes(nextName)) {
    return state;
  }
  return {
    lanes: lanes.map((lane) => (lane === from ? nextName : lane)),
    milestones: state.milestones.map((item) =>
      item.lane === from ? normalizeMilestone({ ...item, lane: nextName }) : item,
    ),
  };
}

export function removeLane(state: RoadmapState, name: string): RoadmapState {
  const lanes = ensureLanes(state);
  if (lanes.length <= 1 || !lanes.includes(name)) {
    return state;
  }
  const remaining = lanes.filter((lane) => lane !== name);
  const fallback = remaining[0] ?? "Product";
  return {
    lanes: remaining,
    milestones: state.milestones.map((item) =>
      item.lane === name ? normalizeMilestone({ ...item, lane: fallback }) : item,
    ),
  };
}

export function moveLane(state: RoadmapState, name: string, direction: -1 | 1): RoadmapState {
  const lanes = ensureLanes(state);
  const index = lanes.indexOf(name);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= lanes.length) {
    return state;
  }
  const next = [...lanes];
  const [item] = next.splice(index, 1);
  if (!item) {
    return state;
  }
  next.splice(target, 0, item);
  return { ...state, lanes: next };
}

export function moveMilestoneToLane(
  state: RoadmapState,
  milestoneId: string,
  lane: string,
): RoadmapState {
  const lanes = ensureLanes(state);
  if (!lanes.includes(lane)) {
    return state;
  }
  return {
    ...state,
    milestones: state.milestones.map((item) =>
      item.id === milestoneId ? normalizeMilestone({ ...item, lane }) : item,
    ),
  };
}
