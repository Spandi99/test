import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@prisma/client";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { newDate } from "@/lib/date-utils";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  buildEventMetadata,
  CalendarTagMetadata,
} from "@/lib/calendar-metadata";
import {
  createConditionalLearningEvents,
  hasConditionalLearningFlag,
} from "@/lib/conditional-learning";

const LOG_SOURCE = "events-route";

// List all calendar events
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;

    logger.debug("Fetching events from database...", {}, LOG_SOURCE);

    // Get events from feeds that belong to the current user
    const events = await prisma.calendarEvent.findMany({
      where: {
        feed: {
          userId,
        },
      },
      include: {
        feed: {
          select: {
            name: true,
            color: true,
            type: true,
          },
        },
      },
    });

    logger.debug(`Found ${events.length} events in database`, {}, LOG_SOURCE);
    return NextResponse.json(events);
  } catch (error) {
    logger.error(
      "Failed to fetch events:",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

// Create a new event
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;

    const {
      feedId,
      title,
      description,
      start,
      end,
      location,
      isRecurring,
      recurrenceRule,
      allDay,
      tagIds,
      metadata: incomingMetadata,
    } = await request.json();

    if (!feedId || !title || !start || !end) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if the feed belongs to the current user
    const feed = await prisma.calendarFeed.findUnique({
      where: {
        id: feedId,
        userId,
      },
      include: {
        account: true,
      },
    });

    if (!feed) {
      return NextResponse.json(
        {
          error:
            "Calendar feed not found or you don't have permission to access it",
        },
        { status: 404 }
      );
    }

    const metadataInput =
      incomingMetadata === null
        ? null
        : (incomingMetadata as Prisma.InputJsonObject | undefined);

    let tags: CalendarTagMetadata[] | undefined;
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      tags = await prisma.tag.findMany({
        where: {
          id: { in: tagIds },
          userId,
        },
        select: {
          id: true,
          name: true,
          color: true,
        },
      });
    }

    const metadataPayload = buildEventMetadata({
      existing: null,
      incoming: metadataInput ?? undefined,
      tags,
      feedType: feed.type,
    });

    const startDate = newDate(start);
    const endDate = newDate(end);

    const shouldSplit = hasConditionalLearningFlag(metadataInput);

    if (shouldSplit) {
      const created = await prisma.$transaction((tx) =>
        createConditionalLearningEvents({
          prisma: tx,
          userId,
          feedId,
          baseData: {
            title,
            description,
            location,
            allDay: allDay || false,
            isRecurring: isRecurring || false,
            recurrenceRule,
          },
          start: startDate,
          end: endDate,
          metadata: metadataPayload ?? Prisma.JsonNull,
        })
      );

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

    const event = await prisma.calendarEvent.create({
      data: {
        feedId,
        title,
        description,
        start: startDate,
        end: endDate,
        location,
        isRecurring: isRecurring || false,
        recurrenceRule,
        allDay: allDay || false,
        metadata: metadataPayload ?? { feedType: feed.type },
      },
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

    return NextResponse.json({ event, events: [event] });
  } catch (error) {
    logger.error(
      "Failed to create calendar event:",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to create calendar event" },
      { status: 500 }
    );
  }
}

// Update an event
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;

    const {
      id,
      title,
      description,
      start,
      end,
      location,
      isRecurring,
      recurrenceRule,
      allDay,
      tagIds,
      metadata: incomingMetadata,
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    // Check if the event belongs to a feed owned by the current user
    const existingEvent = await prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        feed: true,
      },
    });

    if (!existingEvent || existingEvent.feed.userId !== userId) {
      return NextResponse.json(
        { error: "Event not found or you don't have permission to update it" },
        { status: 404 }
      );
    }

    const metadataInput =
      incomingMetadata === null
        ? null
        : (incomingMetadata as Prisma.InputJsonObject | undefined);

    let tags: CalendarTagMetadata[] | undefined;
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      tags = await prisma.tag.findMany({
        where: {
          id: { in: tagIds },
          userId,
        },
        select: {
          id: true,
          name: true,
          color: true,
        },
      });
    } else if (Array.isArray(tagIds) && tagIds.length === 0) {
      tags = [];
    }

    const metadataPayload = buildEventMetadata({
      existing: existingEvent.metadata,
      incoming: metadataInput ?? undefined,
      tags,
      feedType: existingEvent.feed.type,
    });

    const startDate = start ? newDate(start) : newDate(existingEvent.start);
    const endDate = end
      ? newDate(end)
      : newDate(existingEvent.end ?? existingEvent.start);

    if (metadataInput && hasConditionalLearningFlag(metadataInput)) {
      const created = await prisma.$transaction(async (tx) => {
        const events = await createConditionalLearningEvents({
          prisma: tx,
          userId,
          feedId: existingEvent.feedId,
          baseData: {
            title: title ?? existingEvent.title,
            description: description ?? existingEvent.description,
            location: location ?? existingEvent.location,
            allDay: allDay ?? existingEvent.allDay,
            isRecurring: isRecurring ?? existingEvent.isRecurring,
            recurrenceRule: recurrenceRule ?? existingEvent.recurrenceRule,
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

    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        title,
        description,
        start: start ? startDate : undefined,
        end: end ? endDate : undefined,
        location,
        isRecurring,
        recurrenceRule,
        allDay,
        metadata: metadataPayload ?? { feedType: existingEvent.feed.type },
      },
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

    return NextResponse.json({ event, events: [event] });
  } catch (error) {
    logger.error(
      "Failed to update calendar event:",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to update calendar event" },
      { status: 500 }
    );
  }
}

// Delete an event
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    // Check if the event belongs to a feed owned by the current user
    const existingEvent = await prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        feed: true,
      },
    });

    if (!existingEvent || existingEvent.feed.userId !== userId) {
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
      "Failed to delete calendar event:",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to delete calendar event" },
      { status: 500 }
    );
  }
}
