import type { RoadmapMilestone } from "@/features/workflow/domain/document-data";
import { normalizeMilestone } from "./normalize";

function adjacency(milestones: RoadmapMilestone[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const milestone of milestones) {
    map.set(milestone.id, [...milestone.dependsOn]);
  }
  return map;
}

export function canReachDependency(
  milestones: RoadmapMilestone[],
  fromId: string,
  toId: string,
): boolean {
  if (fromId === toId) {
    return true;
  }
  const adj = adjacency(milestones);
  const stack = [...(adj.get(fromId) ?? [])];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) {
      continue;
    }
    if (current === toId) {
      return true;
    }
    seen.add(current);
    stack.push(...(adj.get(current) ?? []));
  }
  return false;
}

export function wouldCreateCycle(
  milestones: RoadmapMilestone[],
  milestoneId: string,
  nextDependsOn: string[],
): boolean {
  const simulated = milestones.map((item) =>
    item.id === milestoneId ? { ...item, dependsOn: nextDependsOn } : item,
  );
  for (const depId of nextDependsOn) {
    if (depId === milestoneId) {
      return true;
    }
    if (canReachDependency(simulated, depId, milestoneId)) {
      return true;
    }
  }
  return false;
}

export function setDependsOn(
  milestones: RoadmapMilestone[],
  milestoneId: string,
  nextDependsOn: string[],
): { milestones: RoadmapMilestone[]; rejected: boolean } {
  const unique = [...new Set(nextDependsOn.filter((id) => id && id !== milestoneId))];
  if (wouldCreateCycle(milestones, milestoneId, unique)) {
    return { milestones, rejected: true };
  }
  return {
    rejected: false,
    milestones: milestones.map((item) =>
      item.id === milestoneId ? normalizeMilestone({ ...item, dependsOn: unique }) : item,
    ),
  };
}

export function toggleDependsOn(
  milestones: RoadmapMilestone[],
  milestoneId: string,
  dependencyId: string,
): { milestones: RoadmapMilestone[]; rejected: boolean } {
  const current = milestones.find((item) => item.id === milestoneId);
  if (!current) {
    return { milestones, rejected: false };
  }
  const exists = current.dependsOn.includes(dependencyId);
  const next = exists
    ? current.dependsOn.filter((id) => id !== dependencyId)
    : [...current.dependsOn, dependencyId];
  return setDependsOn(milestones, milestoneId, next);
}

export function toggleLinkedCard(
  milestones: RoadmapMilestone[],
  milestoneId: string,
  cardId: string,
): RoadmapMilestone[] {
  return milestones.map((item) => {
    if (item.id !== milestoneId) {
      return item;
    }
    const linked = item.linkedCardIds.includes(cardId)
      ? item.linkedCardIds.filter((id) => id !== cardId)
      : [...item.linkedCardIds, cardId];
    return normalizeMilestone({ ...item, linkedCardIds: linked });
  });
}

export interface DependencyEdge {
  fromId: string;
  toId: string;
}

export function listDependencyEdges(milestones: RoadmapMilestone[]): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  for (const milestone of milestones) {
    for (const depId of milestone.dependsOn) {
      if (milestones.some((item) => item.id === depId)) {
        edges.push({ fromId: milestone.id, toId: depId });
      }
    }
  }
  return edges;
}

export function isBlockedByDependencies(milestone: RoadmapMilestone, milestones: RoadmapMilestone[]): boolean {
  if (milestone.status === "done") {
    return false;
  }
  return milestone.dependsOn.some((depId) => {
    const dep = milestones.find((item) => item.id === depId);
    return !dep || dep.status !== "done";
  });
}
