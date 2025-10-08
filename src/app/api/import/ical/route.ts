import { NextRequest, NextResponse } from "next/server";

import ICAL from "ical.js";
import { randomUUID } from "crypto";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const LOG_SOURCE = "import-ical-api";

export const runtime = "nodejs";

interface ImportPayload {
  feedName?: string;
  color?: string | null;
  feedId?: string;
  icalData?: string;
  icalUrl?: string;
}

interface ParsedEvent {
  baseUid: string;
  externalEventId: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  allDay: boolean;
  recurrenceRule?: string;
  status?: string;
  sequence?: number;
  created?: Date;
  lastModified?: Date;
  isMaster: boolean;
  isRecurring: boolean;
  masterUid?: string;
}

interface ParsedCalendar {
  events: ParsedEvent[];
  calendarName?: string;
  calendarColor?: string;
}

function parseIcalData(icalData: string): ParsedCalendar {
  try {
    const jcalData = ICAL.parse(icalData);
    const vcalendar = new ICAL.Component(jcalData);
    const vevents = vcalendar.getAllSubcomponents("vevent");

    if (!vevents.length) {
      throw new Error("Keine Termine in den iCal-Daten gefunden");
    }

    const calendarName = vcalendar.getFirstPropertyValue("x-wr-calname");
    const calendarColor = vcalendar.getFirstPropertyValue("x-wr-calcolor");

    const events: ParsedEvent[] = vevents.map((vevent) => {
      const event = new ICAL.Event(vevent);
      const baseUid = event.uid || randomUUID();

      if (!event.startDate) {
        throw new Error(`Termin ohne Startzeit gefunden (${baseUid})`);
      }

      const start = event.startDate.toJSDate();
      let end: Date;
      if (event.endDate) {
        end = event.endDate.toJSDate();
      } else if (event.duration) {
        const calculatedEnd = event.startDate.clone();
        calculatedEnd.addDuration(event.duration);
        end = calculatedEnd.toJSDate();
      } else {
        end = new Date(start.getTime() + 60 * 60 * 1000);
      }

      const recurrenceRuleValue = vevent.getFirstPropertyValue("rrule") as
        | ICAL.Recur
        | undefined;
      const recurrenceRule = recurrenceRuleValue
        ? recurrenceRuleValue.toString()
        : undefined;

      const hasRecurrenceId = vevent.hasProperty("recurrence-id");
      const recurrenceIdValue = hasRecurrenceId
        ? (vevent.getFirstPropertyValue("recurrence-id") as
            | ICAL.Time
            | undefined)
        : undefined;
      const recurrenceId = recurrenceIdValue
        ? recurrenceIdValue.toString()
        : undefined;

      const createdValue = vevent.getFirstPropertyValue("created") as
        | ICAL.Time
        | undefined;
      const lastModifiedValue = vevent.getFirstPropertyValue("last-modified") as
        | ICAL.Time
        | undefined;
      const sequenceValue = vevent.getFirstPropertyValue("sequence");
      const sequence =
        typeof sequenceValue === "number" ? sequenceValue : undefined;

      return {
        baseUid,
        externalEventId:
          hasRecurrenceId && recurrenceId
            ? `${baseUid}-${recurrenceId}`
            : baseUid,
        title: event.summary || "Unbenannter Termin",
        description: event.description || undefined,
        start,
        end,
        location: event.location || undefined,
        allDay: event.startDate.isDate,
        recurrenceRule,
        status: (vevent.getFirstPropertyValue("status") as string | undefined) || undefined,
        sequence,
        created: createdValue ? createdValue.toJSDate() : undefined,
        lastModified: lastModifiedValue
          ? lastModifiedValue.toJSDate()
          : undefined,
        isMaster: !!recurrenceRule && !hasRecurrenceId,
        isRecurring: !!recurrenceRule || hasRecurrenceId,
        masterUid: hasRecurrenceId ? baseUid : undefined,
      } satisfies ParsedEvent;
    });

    return {
      events,
      calendarName: calendarName ? String(calendarName) : undefined,
      calendarColor: calendarColor ? String(calendarColor) : undefined,
    };
  } catch (error) {
    logger.error(
      "Fehler beim Parsen der iCal-Daten",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      LOG_SOURCE
    );
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const payload = (await request.json()) as ImportPayload;

    if (!payload.icalData && !payload.icalUrl) {
      return NextResponse.json(
        { error: "Es wurden keine iCal-Daten übermittelt" },
        { status: 400 }
      );
    }

    let targetFeed = null as Awaited<
      ReturnType<typeof prisma.calendarFeed.findFirst>
    >;

    if (payload.feedId) {
      targetFeed = await prisma.calendarFeed.findFirst({
        where: {
          id: payload.feedId,
          OR: [
            { userId: auth.userId },
            {
              account: {
                userId: auth.userId,
              },
            },
          ],
        },
      });

      if (!targetFeed) {
        return NextResponse.json(
          { error: "Der ausgewählte Kalender wurde nicht gefunden" },
          { status: 404 }
        );
      }

      if (targetFeed.type !== "CALDAV" && targetFeed.type !== "LOCAL") {
        return NextResponse.json(
          {
            error:
              "In diesen Kalender können keine iCal-Termine importiert werden",
          },
          { status: 400 }
        );
      }
    }

    let icalData = payload.icalData;

    if (!icalData && payload.icalUrl) {
      try {
        const response = await fetch(payload.icalUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        icalData = await response.text();
      } catch (error) {
        logger.error(
          "Fehler beim Laden der iCal-URL",
          {
            url: payload.icalUrl,
            error: error instanceof Error ? error.message : String(error),
          },
          LOG_SOURCE
        );
        return NextResponse.json(
          { error: "Die iCal-Datei konnte nicht geladen werden" },
          { status: 400 }
        );
      }
    }

    if (!icalData) {
      return NextResponse.json(
        { error: "Die iCal-Daten sind leer" },
        { status: 400 }
      );
    }

    let parsed: ParsedCalendar;
    try {
      parsed = parseIcalData(icalData);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Die iCal-Daten konnten nicht verarbeitet werden",
        },
        { status: 400 }
      );
    }

    const parsedCalendarName = parsed.calendarName
      ? String(parsed.calendarName).trim()
      : undefined;

    const feedName =
      payload.feedName?.trim() || parsedCalendarName || "Importierter Kalender";

    const desiredColor =
      typeof payload.color === "string" && payload.color.trim().length > 0
        ? payload.color.trim()
        : parsed.calendarColor && String(parsed.calendarColor).trim().length > 0
          ? String(parsed.calendarColor).trim()
          : null;

    const { feed, imported } = await prisma.$transaction(async (tx) => {
      const resolvedFeed =
        targetFeed ??
        (await tx.calendarFeed.create({
          data: {
            name: feedName,
            color: desiredColor,
            type: "LOCAL",
            enabled: true,
            userId: auth.userId,
          },
        }));

      const masterMap = new Map<string, string>();
      let importedCount = 0;

      const events = [...parsed.events].sort((a, b) => {
        if (a.isMaster && !b.isMaster) return -1;
        if (!a.isMaster && b.isMaster) return 1;
        return 0;
      });

      for (const event of events) {
        try {
          if (event.externalEventId) {
            await tx.calendarEvent.deleteMany({
              where: {
                feedId: resolvedFeed.id,
                externalEventId: event.externalEventId,
              },
            });
          }

          const masterEventId = event.masterUid
            ? masterMap.get(event.masterUid) || null
            : null;

          const createdEvent = await tx.calendarEvent.create({
            data: {
              feedId: resolvedFeed.id,
              externalEventId: event.externalEventId,
              title: event.title,
              description: event.description,
              start: event.start,
              end: event.end,
              location: event.location,
              isRecurring: event.isRecurring,
              recurrenceRule: event.recurrenceRule,
              allDay: event.allDay,
              status: event.status,
              sequence: event.sequence,
              created: event.created,
              lastModified: event.lastModified,
              isMaster: event.isMaster,
              masterEventId,
              recurringEventId: event.masterUid || null,
            },
          });

          if (event.isMaster) {
            masterMap.set(event.baseUid, createdEvent.id);
          }

          importedCount += 1;
        } catch (error) {
          logger.error(
            "Fehler beim Speichern eines Termins",
            {
              feedId: resolvedFeed.id,
              externalEventId: event.externalEventId,
              error: error instanceof Error ? error.message : String(error),
            },
            LOG_SOURCE
          );
        }
      }

      return { feed: resolvedFeed, imported: importedCount };
    });

    logger.info(
      "iCal-Import abgeschlossen",
      {
        feedId: feed.id,
        imported,
      },
      LOG_SOURCE
    );

    return NextResponse.json({
      feedId: feed.id,
      imported,
      feedName: feed.name,
    });
  } catch (error) {
    logger.error(
      "Unerwarteter Fehler beim iCal-Import",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      LOG_SOURCE
    );

    return NextResponse.json(
      { error: "Der iCal-Import ist fehlgeschlagen" },
      { status: 500 }
    );
  }
}

