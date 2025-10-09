import { newDate } from "@/lib/date-utils";

import { CalendarEvent, EventFlag } from "@/types/calendar";

const DEFAULT_EVENT_COLOR = "#3b82f6";
const MIN_SEGMENT_MINUTES = 15;

type Segment = { start: Date; end: Date };

export interface CalendarDisplayEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  backgroundColor: string;
  borderColor: string;
  allDay: boolean;
  classNames: string[];
  extendedProps?: Record<string, unknown>;
}

function getFlags(event: CalendarEvent): EventFlag[] {
  const rawFlags = event.metadata?.flags;
  if (!Array.isArray(rawFlags)) {
    return [];
  }
  return (rawFlags.filter(Boolean) as EventFlag[]) ?? [];
}

function isTaskItem(event: CalendarEvent): boolean {
  return event.feedId === "tasks" || Boolean(event.extendedProps?.isTask);
}

function isFixedEvent(event: CalendarEvent): boolean {
  if (isTaskItem(event)) return false;
  const flags = getFlags(event);
  if (flags.includes("fixed")) return true;
  const feedType = event.metadata?.feedType || event.feed?.type;
  if (feedType && feedType.toUpperCase() === "CALDAV") {
    return true;
  }
  const progressionTagId = event.metadata?.progressionTagId;
  return progressionTagId === "uni";
}

function isConditionalLearning(event: CalendarEvent): boolean {
  const flags = getFlags(event);
  return flags.includes("conditional-learning");
}

function clampToEventRange(
  eventStart: Date,
  eventEnd: Date,
  candidate: Segment
): Segment | null {
  const start = candidate.start < eventStart ? eventStart : candidate.start;
  const end = candidate.end > eventEnd ? eventEnd : candidate.end;
  if (end <= start) {
    return null;
  }
  return { start, end };
}

function diffInMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function splitConditionalEvent(
  event: CalendarEvent,
  blockers: CalendarEvent[]
): Segment[] {
  const eventStart = newDate(event.start);
  const eventEnd = newDate(event.end ?? event.start);
  if (!isConditionalLearning(event) || eventEnd <= eventStart) {
    return [{ start: eventStart, end: eventEnd }];
  }

  const relevantBlockers = blockers
    .filter((blocker) => blocker.id !== event.id)
    .map((blocker) => ({
      start: newDate(blocker.start),
      end: newDate(blocker.end ?? blocker.start),
    }))
    .filter((blocker) => blocker.end > eventStart && blocker.start < eventEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const segments: Segment[] = [];
  let cursor = eventStart;

  relevantBlockers.forEach((blocker) => {
    const clamped = clampToEventRange(eventStart, eventEnd, blocker);
    if (!clamped) {
      return;
    }

    if (clamped.start > cursor) {
      segments.push({ start: new Date(cursor), end: new Date(clamped.start) });
    }

    if (clamped.end > cursor) {
      cursor = new Date(clamped.end);
    }
  });

  if (cursor < eventEnd) {
    segments.push({ start: new Date(cursor), end: new Date(eventEnd) });
  }

  return segments.filter(
    (segment) => diffInMinutes(segment.start, segment.end) >= MIN_SEGMENT_MINUTES
  );
}

function resolveAccentColor(event: CalendarEvent): string {
  const metadataTags = Array.isArray(event.metadata?.tags)
    ? event.metadata?.tags
    : [];
  const extendedTags = Array.isArray(event.extendedProps?.tags)
    ? event.extendedProps?.tags
    : [];
  const primaryTag = [...metadataTags, ...extendedTags].find(Boolean);
  if (primaryTag?.color) {
    return primaryTag.color;
  }
  if (event.color) {
    return event.color;
  }
  return DEFAULT_EVENT_COLOR;
}

function buildTaskDisplayEvent(task: CalendarEvent): CalendarDisplayEvent {
  const accent = task.color || DEFAULT_EVENT_COLOR;
  return {
    id: task.id,
    title: task.title,
    start: newDate(task.start),
    end: newDate(task.end ?? task.start),
    location: task.location,
    backgroundColor: accent,
    borderColor: accent,
    allDay: Boolean(task.allDay),
    classNames: ["calendar-task"],
    extendedProps: {
      ...task,
      isTask: true,
    },
  };
}

function buildEventSegmentDisplay(
  event: CalendarEvent,
  segment: Segment,
  index: number,
  totalSegments: number
): CalendarDisplayEvent {
  const accent = resolveAccentColor(event);
  const segmentId = totalSegments > 1 ? `${event.id}::${index}` : event.id;
  return {
    id: segmentId,
    title: event.title,
    start: segment.start,
    end: segment.end,
    location: event.location,
    backgroundColor: accent,
    borderColor: accent,
    allDay: Boolean(event.allDay),
    classNames: ["calendar-event"],
    extendedProps: {
      ...event,
      isTask: false,
      sourceEventId: event.id,
      segmentIndex: index,
      segmentCount: totalSegments,
    },
  };
}

export function buildCalendarDisplayEvents(
  items: CalendarEvent[]
): CalendarDisplayEvent[] {
  const results: CalendarDisplayEvent[] = [];
  const blockers = items.filter((item) => isFixedEvent(item));

  items.forEach((item) => {
    if (isTaskItem(item)) {
      results.push(buildTaskDisplayEvent(item));
      return;
    }

    const segments = splitConditionalEvent(item, blockers);
    if (segments.length === 0) {
      return;
    }

    segments.forEach((segment, index) => {
      results.push(
        buildEventSegmentDisplay(item, segment, index, segments.length)
      );
    });
  });

  return results;
}
