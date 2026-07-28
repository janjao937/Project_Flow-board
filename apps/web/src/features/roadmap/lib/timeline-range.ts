import type { RoadmapMilestone } from "@/features/workflow/domain/document-data";

export type TimelineZoom = "week" | "month" | "quarter";

export const ZOOM_PX_PER_DAY: Record<TimelineZoom, number> = {
  week: 36,
  month: 18,
  quarter: 8,
};

const DAY_MS = 1000 * 60 * 60 * 24;

export interface TimelineRange {
  start: string;
  end: string;
  dayCount: number;
  widthPx: number;
  pxPerDay: number;
}

export interface TimelineBar {
  id: string;
  left: number;
  width: number;
}

export interface TimelineTick {
  date: string;
  left: number;
  label: string;
  major: boolean;
}

function parseDay(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1));
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, amount: number): string {
  const date = parseDay(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatDay(date);
}

function dayDiff(start: string, end: string): number {
  return Math.round((parseDay(end).getTime() - parseDay(start).getTime()) / DAY_MS);
}

export function buildTimelineRange(
  milestones: RoadmapMilestone[],
  zoom: TimelineZoom,
  padDays = 3,
): TimelineRange {
  const pxPerDay = ZOOM_PX_PER_DAY[zoom];
  const today = new Date().toISOString().slice(0, 10);

  let min = today;
  let max = today;
  if (milestones.length > 0) {
    min = milestones.reduce((acc, item) => (item.startDate < acc ? item.startDate : acc), milestones[0]!.startDate);
    max = milestones.reduce((acc, item) => (item.endDate > acc ? item.endDate : acc), milestones[0]!.endDate);
  }

  const start = addDays(min, -padDays);
  let end = addDays(max, padDays);
  const minSpan = zoom === "week" ? 14 : zoom === "month" ? 42 : 90;
  if (dayDiff(start, end) + 1 < minSpan) {
    end = addDays(start, minSpan - 1);
  }

  const dayCount = dayDiff(start, end) + 1;
  return {
    start,
    end,
    dayCount,
    widthPx: dayCount * pxPerDay,
    pxPerDay,
  };
}

export function barForMilestone(milestone: RoadmapMilestone, range: TimelineRange): TimelineBar {
  const offset = Math.max(0, dayDiff(range.start, milestone.startDate));
  const span = Math.max(1, dayDiff(milestone.startDate, milestone.endDate) + 1);
  const left = offset * range.pxPerDay;
  const width = Math.max(range.pxPerDay, span * range.pxPerDay - 4);
  const maxLeft = Math.max(0, range.widthPx - range.pxPerDay);
  return {
    id: milestone.id,
    left: Math.min(left, maxLeft),
    width: Math.min(width, range.widthPx - Math.min(left, maxLeft)),
  };
}

export function buildTimelineTicks(range: TimelineRange, zoom: TimelineZoom, locale = "en"): TimelineTick[] {
  const ticks: TimelineTick[] = [];
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: zoom === "quarter" ? undefined : "numeric",
  });

  for (let i = 0; i < range.dayCount; i += 1) {
    const date = addDays(range.start, i);
    const parsed = parseDay(date);
    const day = parsed.getUTCDate();
    const weekday = parsed.getUTCDay();
    const major =
      zoom === "week"
        ? weekday === 1 || i === 0
        : zoom === "month"
          ? day === 1 || i === 0
          : day === 1 || i === 0;

    if (!major && zoom !== "week") {
      continue;
    }
    if (zoom === "week" && !major && weekday !== 1) {
      continue;
    }

    ticks.push({
      date,
      left: i * range.pxPerDay,
      label: formatter.format(parsed),
      major: true,
    });
  }

  return ticks;
}

export function todayOffsetPx(range: TimelineRange): number | null {
  const today = new Date().toISOString().slice(0, 10);
  if (today < range.start || today > range.end) {
    return null;
  }
  return dayDiff(range.start, today) * range.pxPerDay + range.pxPerDay / 2;
}
