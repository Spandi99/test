import { randomUUID } from "crypto";

import { Prisma, PrismaClient } from "@prisma/client";

const MIN_SEGMENT_MINUTES = 60;

function isJsonNull(value: unknown): boolean {
  return value === Prisma.JsonNull;
}

type BaseEventData = {
  title: string;
  description?: string | null;
  location?: string | null;
  allDay?: boolean;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
};

type CalendarEventRecord = {
  id: string;
  start: Date | string;
  end: Date | string | null;
  metadata?: Prisma.JsonValue | null;
  feed?: { type?: string | null } | null;
};

function extractFlags(metadata: Prisma.JsonValue | null | undefined): string[] {
  if (!metadata || isJsonNull(metadata)) {
    return [];
  }
  if (Array.isArray(metadata) || typeof metadata !== "object") {
    return [];
  }
  const rawFlags = (metadata as Record<string, unknown>).flags;
  if (!Array.isArray(rawFlags)) {
    return [];
  }
  return rawFlags.filter((flag): flag is string => typeof flag === "string");
}

function extractProgressionTag(
  metadata: Prisma.JsonValue | null | undefined
): string | undefined {
  if (!metadata || isJsonNull(metadata)) {
    return undefined;
  }
  if (Array.isArray(metadata) || typeof metadata !== "object") {
    return undefined;
  }
  const value = (metadata as Record<string, unknown>).progressionTagId;
  return typeof value === "string" ? value : undefined;
}

function isFixedBlocker(event: CalendarEventRecord): boolean {
  const flags = extractFlags(event.metadata);
  if (flags.includes("fixed")) {
    return true;
  }
  const progressionTagId = extractProgressionTag(event.metadata);
  if (progressionTagId === "uni") {
    return true;
  }
  const feedType = event.feed?.type?.toUpperCase();
  return feedType === "CALDAV" || feedType === "ICAL";
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

type Segment = { start: Date; end: Date };

function clampSegment(baseStart: Date, baseEnd: Date, segment: Segment): Segment | null {
  const start = segment.start < baseStart ? baseStart : segment.start;
  const end = segment.end > baseEnd ? baseEnd : segment.end;
  if (end <= start) {
    return null;
  }
  return { start, end };
}

function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function computeSegments(
  start: Date,
  end: Date,
  blockers: Segment[]
): Segment[] {
  if (end <= start) {
    return [];
  }

  const sorted = blockers
    .map((blocker) => clampSegment(start, end, blocker))
    .filter((segment): segment is Segment => Boolean(segment))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const segments: Segment[] = [];
  let cursor = new Date(start);

  sorted.forEach((blocker) => {
    if (blocker.start > cursor) {
      segments.push({ start: new Date(cursor), end: new Date(blocker.start) });
    }
    if (blocker.end > cursor) {
      cursor = new Date(blocker.end);
    }
  });

  if (cursor < end) {
    segments.push({ start: new Date(cursor), end: new Date(end) });
  }

  return segments.filter(
    (segment) => minutesBetween(segment.start, segment.end) >= MIN_SEGMENT_MINUTES
  );
}

function cloneMetadata(
  metadata: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (!metadata || isJsonNull(metadata)) {
    return metadata;
  }
  if (Array.isArray(metadata) || typeof metadata !== "object") {
    return metadata;
  }
  return { ...(metadata as Prisma.JsonObject) };
}

export async function createConditionalLearningEvents({
  prisma,
  userId,
  feedId,
  baseData,
  start,
  end,
  metadata,
  ignoreEventId,
}: {
  prisma: PrismaClient | Prisma.TransactionClient;
  userId: string;
  feedId: string;
  baseData: BaseEventData;
  start: Date;
  end: Date;
  metadata: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  ignoreEventId?: string;
}) {
  const blockersRaw = await prisma.calendarEvent.findMany({
    where: {
      id: ignoreEventId ? { not: ignoreEventId } : undefined,
      feed: { userId },
      start: { lt: end },
      end: { gt: start },
    },
    include: {
      feed: {
        select: {
          type: true,
        },
      },
    },
  });

  const blockers = blockersRaw
    .filter((event) => isFixedBlocker(event))
    .map((event) => ({
      start: toDate(event.start) ?? start,
      end: toDate(event.end) ?? toDate(event.start) ?? start,
    }));

  const segments = computeSegments(start, end, blockers);
  if (segments.length === 0) {
    return [];
  }

  const groupId = randomUUID();
  const segmentCount = segments.length;

  const createdEvents = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const metadataForSegment = cloneMetadata(metadata);
    if (metadataForSegment !== Prisma.JsonNull && metadataForSegment) {
      const payload = metadataForSegment as Prisma.JsonObject;
      payload.segmentIndex = index;
      payload.segmentCount = segmentCount;
      payload.segmentGroupId = groupId;
      payload.originalStart = start.toISOString();
      payload.originalEnd = end.toISOString();
    }

    const createData = {
      feed: { connect: { id: feedId } },
      title: baseData.title,
      description: baseData.description ?? null,
      location: baseData.location ?? null,
      start: segment.start,
      end: segment.end,
      isRecurring: baseData.isRecurring ?? false,
      recurrenceRule: baseData.recurrenceRule ?? null,
      allDay: baseData.allDay ?? false,
      metadata: metadataForSegment,
    };

    const created = await prisma.calendarEvent.create({
      data: createData as unknown as Prisma.CalendarEventUncheckedCreateInput,
      include: {
        feed: {
          select: {
            id: true,
            name: true,
            color: true,
            type: true,
          },
        },
      },
    });

    createdEvents.push(created);
  }

  return createdEvents;
}

export function hasConditionalLearningFlag(
  metadata: Prisma.InputJsonObject | null | undefined
): boolean {
  if (!metadata) {
    return false;
  }
  const flags = metadata.flags;
  if (!Array.isArray(flags)) {
    return false;
  }
  return flags.some((flag) => flag === "conditional-learning");
}
