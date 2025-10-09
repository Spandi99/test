import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@prisma/client";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { getEvent } from "@/lib/calendar-db";
import { newDate } from "@/lib/date-utils";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  buildEventMetadata,
  CalendarTagMetadata,
} from "@/lib/calendar-metadata";
import { ensureTagProgressionSchema } from "@/lib/schema-guards";
import {
  createConditionalLearningEvents,
  hasConditionalLearningFlag,
} from "@/lib/conditional-learning";

const LOG_SOURCE = "event-route";

// Get a specific event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;

    const { id } = await params;
    const event = await getEvent(id);

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Check if the event belongs to a feed owned by the current user
    if (event.feed.userId !== userId) {
      logger.warn(
        "Unauthorized access attempt to event",
        { eventId: id, userId: userId || "unknown" },
        LOG_SOURCE
      );
      return NextResponse.json(
        { error: "Event not found or you don't have permission to access it" },
        { status: 404 }
      );
    }

    return NextResponse.json(event);
  } catch (error) {
    logger.error(
      "Failed to fetch event:",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}

// Update a specific event
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;

    const { id } = await params;

    // Check if the event belongs to a feed owned by the current user
    const existingEvent = await prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        feed: true,
      },
    });

    if (!existingEvent || existingEvent.feed.userId !== userId) {
      logger.warn(
        "Unauthorized access attempt to update event",
        { eventId: id, userId: userId || "unknown" },
        LOG_SOURCE
      );
      return NextResponse.json(
        { error: "Event not found or you don't have permission to update it" },
        { status: 404 }
      );
    }

    const updates = await request.json();

    const metadataInput =
      updates.metadata === null
        ? null
        : (updates.metadata as Prisma.InputJsonObject | undefined);

    await ensureTagProgressionSchema();

    const requestedTagIds = Array.isArray(updates.tagIds)
      ? updates.tagIds
      : Array.isArray(metadataInput?.tags)
        ? metadataInput?.tags
            .map((tag) =>
              typeof tag === "object" && tag !== null && "id" in tag
                ? String(tag.id)
                : undefined
            )
            .filter((id): id is string => Boolean(id))
        : undefined;

    let tags: CalendarTagMetadata[] | undefined;
    if (requestedTagIds && requestedTagIds.length > 0) {
      tags = await prisma.tag.findMany({
        where: {
          id: { in: requestedTagIds },
          userId,
        },
        select: {
          id: true,
          name: true,
          color: true,
        },
      });
    } else if (Array.isArray(updates.tagIds) && updates.tagIds.length === 0) {
      tags = [];
    }

    const existingMetadata =
      (existingEvent as { metadata?: Prisma.JsonValue | null }).metadata ?? null;

    const metadataPayload = buildEventMetadata({
      existing: metadataInput ? null : existingMetadata,
      incoming: metadataInput ?? undefined,
      tags,
      feedType: existingEvent.feed.type,
    });

    const startDate =
      updates.start !== undefined
        ? newDate(updates.start)
        : newDate(existingEvent.start);
    const endDate =
      updates.end !== undefined
        ? newDate(updates.end)
        : newDate(existingEvent.end ?? existingEvent.start);

    if (metadataInput && hasConditionalLearningFlag(metadataInput)) {
      const created = await prisma.$transaction(async (tx) => {
        const events = await createConditionalLearningEvents({
          prisma: tx,
          userId,
          feedId: existingEvent.feedId,
          baseData: {
            title: updates.title ?? existingEvent.title,
            description: updates.description ?? existingEvent.description,
            location: updates.location ?? existingEvent.location,
            allDay:
              updates.allDay !== undefined
                ? updates.allDay
                : existingEvent.allDay,
            isRecurring:
              updates.isRecurring !== undefined
                ? updates.isRecurring
                : existingEvent.isRecurring,
            recurrenceRule:
              updates.recurrenceRule ?? existingEvent.recurrenceRule,
          },
          start: startDate,
          end: endDate,
          metadata: metadataPayload ?? Prisma.JsonNull,
          ignoreEventId: existingEvent.id,
        });

        await tx.calendarEvent.delete({ where: { id } });
        return events;
      });

      if (created.length === 0) {
        return NextResponse.json(
          {
            error:
              "Kein freies Zeitfenster für diesen Lernblock gefunden. Bitte passe die Zeiten an.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json({ event: created[0], events: created });
    }

    const updateData: Record<string, unknown> = {
      metadata:
        metadataPayload ??
        (metadataInput === null
          ? Prisma.JsonNull
          : { feedType: existingEvent.feed.type }),
    };

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.start !== undefined) updateData.start = startDate;
    if (updates.end !== undefined) updateData.end = endDate;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.isRecurring !== undefined)
      updateData.isRecurring = updates.isRecurring;
    if (updates.recurrenceRule !== undefined)
      updateData.recurrenceRule = updates.recurrenceRule;
    if (updates.allDay !== undefined) updateData.allDay = updates.allDay;

    const updated = await prisma.calendarEvent.update({
      where: { id },
      data: updateData as unknown as Prisma.CalendarEventUpdateInput,
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

    return NextResponse.json({ event: updated, events: [updated] });
  } catch (error) {
    logger.error(
      "Failed to update event:",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

// Delete a specific event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;

    const { id } = await params;

    // Check if the event belongs to a feed owned by the current user
    const existingEvent = await prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        feed: true,
      },
    });

    if (!existingEvent || existingEvent.feed.userId !== userId) {
      logger.warn(
        "Unauthorized access attempt to delete event",
        { eventId: id, userId: userId || "unknown" },
        LOG_SOURCE
      );
      return NextResponse.json(
        { error: "Event not found or you don't have permission to delete it" },
        { status: 404 }
      );
    }

    await prisma.calendarEvent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      "Failed to delete event:",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}
