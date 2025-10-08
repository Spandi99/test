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

type IcalProperty = {
  name?: string;
  getFirstValue?: () => unknown;
  getValues?: () => unknown[];
  getParameter?: (name: string) => unknown;
};

interface ParsedAttendee {
  name?: string;
  email: string;
  status?: string;
}

interface ParsedOrganizer {
  name?: string;
  email: string;
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
  organizer?: ParsedOrganizer;
  attendees?: ParsedAttendee[];
}

interface ParsedCalendar {
  events: ParsedEvent[];
  calendarName?: string;
  calendarColor?: string;
  skipped: number;
}

function sanitizeText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const normalized = value
      .replace(/\\n/gi, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\")
      .trim();
    return normalized.length ? normalized : undefined;
  }

  if (value && typeof value === "object" && "toString" in value) {
    return sanitizeText(String(value));
  }

  return undefined;
}

function sanitizeColor(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function normalizeEmail(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const email = value.replace(/^mailto:/i, "").trim();
  if (!email) return undefined;
  return email.toLowerCase();
}

function parseCalAddress(property: IcalProperty | null | undefined):
  | ParsedOrganizer
  | ParsedAttendee
  | undefined {
  if (!property) return undefined;

  const rawValue = property.getFirstValue?.();
  if (typeof rawValue !== "string") {
    return undefined;
  }

  const email = normalizeEmail(rawValue);
  if (!email) return undefined;

  const commonNameParam = property.getParameter?.("cn");
  const name =
    typeof commonNameParam === "string"
      ? sanitizeText(commonNameParam)
      : undefined;

  const attendeeStatusParam = property.getParameter?.("partstat");
  const status =
    typeof attendeeStatusParam === "string"
      ? attendeeStatusParam.toUpperCase()
      : undefined;

  return {
    email,
    name,
    status,
  } as ParsedOrganizer | ParsedAttendee;
}

function mergeDescription(
  baseDescription: string | undefined,
  extraSections: Array<string | undefined>
): string | undefined {
  const sections = [baseDescription, ...extraSections];
  const filtered = sections.filter(
    (section): section is string =>
      typeof section === "string" && section.trim().length > 0
  );

  if (!filtered.length) {
    return undefined;
  }

  return filtered.map((section) => section.trim()).join("\n\n");
}

function normalizeIcalContent(raw: string): string {
  const unixNewlines = raw.replace(/\r\n?/g, "\n");
  const lines = unixNewlines.split("\n");
  const normalized: string[] = [];

  for (const line of lines) {
    if (!line.length) {
      normalized.push(line);
      continue;
    }

    if (/^[ \t]/.test(line)) {
      if (normalized.length) {
        normalized[normalized.length - 1] += line.slice(1);
        continue;
      }

      normalized.push(line.trimStart());
      continue;
    }

    if (!line.includes(":") && !line.includes(";")) {
      if (normalized.length) {
        const previous = normalized[normalized.length - 1];
        const trimmed = line.trim();
        const needsSpace =
          trimmed.length > 0 &&
          previous.length > 0 &&
          !previous.endsWith(" ") &&
          !previous.endsWith("\\") &&
          !previous.endsWith("=");
        normalized[normalized.length - 1] =
          previous + (needsSpace ? " " : "") + trimmed;
        continue;
      }

      normalized.push(line.trim());
      continue;
    }

    normalized.push(line);
  }

  return normalized.join("\n");
}

function parseIcalData(icalData: string): ParsedCalendar {
  try {
    const normalized = normalizeIcalContent(icalData);
    const jcalData = ICAL.parse(normalized);
    const vcalendar = new ICAL.Component(jcalData);
    const vevents = vcalendar.getAllSubcomponents("vevent");

    if (!vevents.length) {
      throw new Error("Keine Termine in den iCal-Daten gefunden");
    }

    const calendarName = vcalendar.getFirstPropertyValue("x-wr-calname");
    const calendarColor = sanitizeColor(
      vcalendar.getFirstPropertyValue("x-wr-calcolor")
    );

    const events: ParsedEvent[] = [];
    let skipped = 0;

    for (const vevent of vevents) {
      try {
        const event = new ICAL.Event(vevent);
        const baseUid = event.uid || randomUUID();

        if (!event.startDate) {
          skipped += 1;
          logger.warn(
            "Termin ohne Startzeit übersprungen",
            { uid: baseUid },
            LOG_SOURCE
          );
          continue;
        }

        const rawStatus = vevent.getFirstPropertyValue("status");
        const normalizedStatus =
          typeof rawStatus === "string" ? rawStatus.toUpperCase() : undefined;
        if (normalizedStatus === "CANCELLED") {
          skipped += 1;
          logger.debug(
            "Stornierten Termin aus dem Import ausgelassen",
            { uid: baseUid },
            LOG_SOURCE
          );
          continue;
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

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          skipped += 1;
          logger.warn(
            "Termin mit ungültigem Datum übersprungen",
            { uid: baseUid },
            LOG_SOURCE
          );
          continue;
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
        const lastModifiedValue = vevent.getFirstPropertyValue(
          "last-modified"
        ) as ICAL.Time | undefined;
        const sequenceValue = vevent.getFirstPropertyValue("sequence");
        const sequence =
          typeof sequenceValue === "number" ? sequenceValue : undefined;

        const description = sanitizeText(
          vevent.getFirstPropertyValue("description")
        );
        const location = sanitizeText(
          vevent.getFirstPropertyValue("location")
        );
        const url = sanitizeText(vevent.getFirstPropertyValue("url"));
        const categorySet = new Set<string>();
        const categoryProperties = vevent.getAllProperties(
          "categories"
        ) as IcalProperty[];
        for (const property of categoryProperties) {
          const values = property.getValues?.();
          if (Array.isArray(values) && values.length) {
            for (const value of values) {
              const text = sanitizeText(value);
              if (text) {
                text
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean)
                  .forEach((entry) => categorySet.add(entry));
              }
            }
            continue;
          }

          const single = sanitizeText(property.getFirstValue?.());
          if (single) {
            single
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean)
              .forEach((entry) => categorySet.add(entry));
          }
        }
        const categoryPropertyValues = Array.from(categorySet);

        const customInfo = (vevent.getAllProperties() as IcalProperty[])
          .filter((property) =>
            typeof property.name === "string" && property.name.startsWith("X-")
          )
          .map((property) => {
            const propName =
              typeof property.name === "string" ? property.name : undefined;
            const value = sanitizeText(property.getFirstValue?.());
            if (!value || !propName) return undefined;

            const label = propName
              .replace(/^X-/i, "")
              .replace(/[-_]/g, " ");
            return `${label}: ${value}`;
          })
          .filter(Boolean) as string[];

        const combinedDescription = mergeDescription(description, [
          categoryPropertyValues.length
            ? `Kategorien: ${categoryPropertyValues.join(", ")}`
            : undefined,
          url ? `Link: ${url}` : undefined,
          customInfo.length ? customInfo.join("\n") : undefined,
        ]);

        const organizerProperty = vevent.getFirstProperty(
          "organizer"
        ) as IcalProperty | null;
        const organizer = parseCalAddress(organizerProperty) as
          | ParsedOrganizer
          | undefined;

        const attendeeMap = new Map<string, ParsedAttendee>();
        const attendeeProperties = vevent.getAllProperties(
          "attendee"
        ) as IcalProperty[];
        for (const property of attendeeProperties) {
          const attendee = parseCalAddress(property) as ParsedAttendee | undefined;
          if (attendee?.email) {
            attendeeMap.set(attendee.email, attendee);
          }
        }
        const attendees = attendeeMap.size
          ? Array.from(attendeeMap.values())
          : undefined;

        events.push({
          baseUid,
          externalEventId:
            hasRecurrenceId && recurrenceId
              ? `${baseUid}-${recurrenceId}`
              : baseUid,
          title: sanitizeText(event.summary) || "Unbenannter Termin",
          description: combinedDescription,
          start,
          end,
          location,
          allDay: event.startDate.isDate,
          recurrenceRule,
          status: normalizedStatus,
          sequence,
          created: createdValue ? createdValue.toJSDate() : undefined,
          lastModified: lastModifiedValue
            ? lastModifiedValue.toJSDate()
            : undefined,
          isMaster: !!recurrenceRule && !hasRecurrenceId,
          isRecurring: !!recurrenceRule || hasRecurrenceId,
          masterUid: hasRecurrenceId ? baseUid : undefined,
          organizer,
          attendees,
        });
      } catch (error) {
        skipped += 1;
        logger.error(
          "Fehler beim Verarbeiten eines Termins aus dem iCal-Feed",
          {
            error: error instanceof Error ? error.message : String(error),
          },
          LOG_SOURCE
        );
      }
    }

    if (!events.length) {
      throw new Error(
        "Keine verarbeitbaren Termine in den iCal-Daten gefunden"
      );
    }

    return {
      events,
      calendarName: calendarName ? String(calendarName) : undefined,
      calendarColor: calendarColor || undefined,
      skipped,
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

    let importUrl: URL | undefined;

    if (!icalData && payload.icalUrl) {
      const trimmedUrl = payload.icalUrl.trim();
      try {
        importUrl = new URL(trimmedUrl);
      } catch (error) {
        logger.error(
          "Ungültige iCal-URL übermittelt",
          {
            url: payload.icalUrl ?? null,
            error: error instanceof Error ? error.message : String(error),
          },
          LOG_SOURCE
        );
        return NextResponse.json(
          { error: "Die angegebene iCal-URL ist ungültig" },
          { status: 400 }
        );
      }

      if (!importUrl || !["http:", "https:"].includes(importUrl.protocol)) {
        return NextResponse.json(
          { error: "Nur HTTP- und HTTPS-Links werden unterstützt" },
          { status: 400 }
        );
      }
    }

    if (!icalData && importUrl) {
      try {
        const response = await fetch(importUrl.toString(), {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        icalData = await response.text();
      } catch (error) {
        logger.error(
          "Fehler beim Laden der iCal-URL",
          {
            url: payload.icalUrl ?? importUrl.toString(),
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

    icalData = icalData.replace(/^\uFEFF/, "").trim();

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
      sanitizeColor(payload.color) ?? parsed.calendarColor ?? null;

    const orderedEvents = [...parsed.events].sort((a, b) => {
      if (a.isMaster && !b.isMaster) return -1;
      if (!a.isMaster && b.isMaster) return 1;
      return a.start.getTime() - b.start.getTime();
    });

    const externalIdsToReplace = Array.from(
      new Set(
        orderedEvents
          .map((event) => event.externalEventId?.trim())
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );

    const { feed, imported, skipped } = await prisma.$transaction(
      async (tx) => {
        const resolvedFeed =
          targetFeed ??
          (await tx.calendarFeed.create({
            data: {
              name: feedName,
              color: desiredColor ?? "#3b82f6",
              type: "LOCAL",
              enabled: true,
              userId: auth.userId,
            },
          }));

        if (externalIdsToReplace.length) {
          await tx.calendarEvent.deleteMany({
            where: {
              feedId: resolvedFeed.id,
              externalEventId: { in: externalIdsToReplace },
            },
          });
        }

        const masterMap = new Map<string, string>();
        let importedCount = 0;
        let storageFailures = 0;

        for (const event of orderedEvents) {
          try {
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
                recurringEventId: event.isRecurring
                  ? event.isMaster
                    ? event.baseUid
                    : event.masterUid || event.baseUid
                  : null,
                organizer: event.organizer
                  ? {
                      name: event.organizer.name,
                      email: event.organizer.email,
                    }
                  : undefined,
                attendees: event.attendees?.length
                  ? event.attendees.map((attendee) => ({
                      name: attendee.name,
                      email: attendee.email,
                      status: attendee.status,
                    }))
                  : undefined,
              },
            });

            if (event.isMaster) {
              masterMap.set(event.baseUid, createdEvent.id);
            }

            importedCount += 1;
          } catch (error) {
            storageFailures += 1;
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

        return {
          feed: resolvedFeed,
          imported: importedCount,
          skipped: parsed.skipped + storageFailures,
        };
      },
      {
        maxWait: 10_000,
        timeout: 120_000,
      }
    );

    logger.info(
      "iCal-Import abgeschlossen",
      {
        feedId: feed.id,
        imported,
        skipped,
      },
      LOG_SOURCE
    );

    return NextResponse.json({
      feedId: feed.id,
      imported,
      feedName: feed.name,
      skipped,
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

