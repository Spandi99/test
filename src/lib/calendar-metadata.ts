import { Prisma } from "@prisma/client";

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

export function buildEventMetadata({
  existing,
  incoming,
  tags,
  feedType,
}: {
  existing?: Prisma.JsonValue | null;
  incoming?: Prisma.InputJsonObject | null;
  tags?: CalendarTagMetadata[];
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

  if (feedType) {
    next.feedType = feedType;
  }

  return next;
}
