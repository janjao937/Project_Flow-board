import type { RoadmapMilestone, RoadmapState } from "@/features/workflow/domain/document-data";

export type MilestoneStatus = "planned" | "active" | "done";

export const MILESTONE_STATUSES: MilestoneStatus[] = ["planned", "active", "done"];

export const EMPTY_ROADMAP: RoadmapState = { milestones: [], lanes: [] };

type RawMilestone = Partial<RoadmapMilestone> & {
  id?: string;
  title?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  lane?: string;
  dependsOn?: string[];
  linkedCardIds?: string[];
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function isStatus(value: string | undefined): value is MilestoneStatus {
  return value === "planned" || value === "active" || value === "done";
}

export function normalizeMilestone(raw: RawMilestone, fallbackId?: string): RoadmapMilestone {
  const startDate = raw.startDate || raw.date || today();
  const endDate = raw.endDate && raw.endDate >= startDate ? raw.endDate : startDate;
  return {
    id: raw.id || fallbackId || crypto.randomUUID(),
    title: raw.title?.trim() ? raw.title : "Milestone",
    date: startDate,
    startDate,
    endDate,
    status: isStatus(raw.status) ? raw.status : "planned",
    lane: raw.lane?.trim() ? raw.lane : "Product",
    dependsOn: Array.isArray(raw.dependsOn) ? raw.dependsOn.filter(Boolean) : [],
    linkedCardIds: Array.isArray(raw.linkedCardIds) ? raw.linkedCardIds.filter(Boolean) : [],
  };
}

export function normalizeRoadmap(raw: Partial<RoadmapState> | null | undefined): RoadmapState {
  if (!raw) {
    return EMPTY_ROADMAP;
  }
  const lanes = Array.isArray(raw.lanes) && raw.lanes.length > 0 ? raw.lanes.map(String) : ["Product"];
  const milestones = Array.isArray(raw.milestones)
    ? raw.milestones.map((item) => normalizeMilestone(item))
    : [];
  return { lanes, milestones };
}

export function sortMilestones(milestones: RoadmapMilestone[]): RoadmapMilestone[] {
  return [...milestones].sort((a, b) => {
    const byStart = a.startDate.localeCompare(b.startDate);
    if (byStart !== 0) {
      return byStart;
    }
    return a.endDate.localeCompare(b.endDate);
  });
}

export function createMilestoneDraft(lane: string, title = "Milestone"): RoadmapMilestone {
  const start = today();
  const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10);
  return normalizeMilestone({
    id: crypto.randomUUID(),
    title,
    startDate: start,
    endDate: end,
    status: "planned",
    lane,
    dependsOn: [],
    linkedCardIds: [],
  });
}
