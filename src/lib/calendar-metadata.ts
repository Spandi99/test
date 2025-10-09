import { Prisma } from "@prisma/client";

import { EventFlag } from "@/types/calendar";

export interface CalendarTagMetadata {
  id: string;
  name: string;
  color?: string | null;
}

function isJsonNull(value: unknown): boolean {
  return value === Prisma.JsonNull;
}

function cloneJsonObject(
  value: Prisma.JsonValue | Prisma.InputJsonObject | null | undefined
): Prisma.JsonObject {
  if (!value || isJsonNull(value)) {
    return {};
  }
  if (Array.isArray(value) || typeof value !== "object") {
    return {};
  }

  return { ...(value as Prisma.JsonObject) };
}

const VALID_FLAGS: readonly EventFlag[] = [
  "fixed",
  "flexible",
  "conditional-learning",
  "dopamine",
] as const;

const VALID_FLAG_SET = new Set<EventFlag>(VALID_FLAGS);

function normalizeFlagList(flags: unknown): EventFlag[] | undefined {
  if (!Array.isArray(flags)) {
    return undefined;
  }

  const unique: EventFlag[] = [];
  for (const entry of flags) {
    if (typeof entry !== "string") {
      continue;
    }
    const candidate = entry as EventFlag;
    if (!VALID_FLAG_SET.has(candidate)) {
      continue;
    }
    if (!unique.includes(candidate)) {
      unique.push(candidate);
    }
  }

  return unique;
}

export function buildEventMetadata({
  existing,
  incoming,
  tags,
  flags,
  feedType,
}: {
  existing?: Prisma.JsonValue | null;
  incoming?: Prisma.InputJsonObject | null;
  tags?: CalendarTagMetadata[];
  flags?: EventFlag[];
  feedType?: string | null;
}): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (incoming === null) {
    return Prisma.JsonNull;
  }

  const base = cloneJsonObject(existing);
  const next = {
    ...base,
    ...(incoming ? cloneJsonObject(incoming) : {}),
  } as Prisma.JsonObject;

  if (Array.isArray(tags)) {
    if (tags.length === 0) {
      delete next.tags;
    } else {
      next.tags = tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color ?? null,
      }));
    }
  }

  if (flags !== undefined) {
    next.flags = [...new Set(flags)];
  } else if ("flags" in next) {
    const normalized = normalizeFlagList((next as { flags?: unknown }).flags);
    if (normalized) {
      next.flags = normalized;
    } else if (Array.isArray((next as { flags?: unknown }).flags)) {
      next.flags = [];
    } else {
      delete next.flags;
    }
  }

  if (feedType) {
    next.feedType = feedType;
  }

  return next;
}

export function extractEventFlags(
  metadata: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined
): EventFlag[] {
  const payload = normalizeFlagList(
    metadata && typeof metadata === "object"
      ? (metadata as { flags?: unknown }).flags
      : undefined
  );

  return payload ?? [];
}

export function normalizeIncomingFlags(
  value: unknown
): EventFlag[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return [];
  }

  const normalized = normalizeFlagList(value);
  return normalized ?? [];
}
