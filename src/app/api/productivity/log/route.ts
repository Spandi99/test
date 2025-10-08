import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { newDate } from "@/lib/date-utils";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const LOG_SOURCE = "productivity-log";

function coerceNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;
    const body = await request.json();

    const {
      sourceType,
      sourceId,
      recordedAt,
      start,
      end,
      durationMinutes,
      taskType,
      statKey,
      energyLevel,
      overlapWithUni,
      success,
      mood,
      metadata,
    } = body;

    if (!sourceType || !sourceId || !start || !end || !taskType || !statKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const startDate = newDate(start);
    const endDate = newDate(end);
    const recorded = recordedAt ? newDate(recordedAt) : newDate();

    const dayOfWeek = startDate.getDay();
    const hourOfDay = startDate.getHours();
    const duration = Number.isFinite(durationMinutes)
      ? Number(durationMinutes)
      : Math.max(15, Math.round(Math.abs(endDate.getTime() - startDate.getTime()) / 60000));

    const metadataPayload =
      metadata && typeof metadata === "object"
        ? { ...(metadata as Record<string, unknown>), statKey }
        : { statKey };

    const sample = await prisma.productivitySample.create({
      data: {
        userId,
        sourceType,
        sourceId,
        recordedAt: recorded,
        dayOfWeek,
        hourOfDay,
        duration,
        taskType,
        energyLevel: coerceNumber(energyLevel),
        overlapWithUni: Boolean(overlapWithUni),
        success: Boolean(success),
        mood: coerceNumber(mood),
        metadata: metadataPayload,
      },
    });

    return NextResponse.json(sample);
  } catch (error) {
    logger.error(
      "Failed to log productivity sample",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to log productivity" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");

    const samples = await prisma.productivitySample.findMany({
      where: { userId },
      orderBy: { recordedAt: "desc" },
    });

    if (format === "csv") {
      const header = [
        "id",
        "recordedAt",
        "sourceType",
        "sourceId",
        "dayOfWeek",
        "hourOfDay",
        "duration",
        "taskType",
        "statKey",
        "energyLevel",
        "overlapWithUni",
        "success",
        "mood",
      ];
      const rows = samples.map((sample) =>
        [
          sample.id,
          sample.recordedAt.toISOString(),
          sample.sourceType,
          sample.sourceId,
          sample.dayOfWeek,
          sample.hourOfDay,
          sample.duration,
          sample.taskType,
          sample.metadata && typeof sample.metadata === "object"
            ? (sample.metadata as Record<string, unknown>).statKey ?? ""
            : "",
          sample.energyLevel ?? "",
          sample.overlapWithUni ? "1" : "0",
          sample.success ? "1" : "0",
          sample.mood ?? "",
        ].join(",")
      );

      const csv = [header.join(","), ...rows].join("\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
        },
      });
    }

    return NextResponse.json(samples);
  } catch (error) {
    logger.error(
      "Failed to fetch productivity samples",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to fetch productivity data" },
      { status: 500 }
    );
  }
}
