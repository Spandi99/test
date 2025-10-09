import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@prisma/client";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { ensureTagProgressionSchema } from "@/lib/schema-guards";

const LOG_SOURCE = "tags-route";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;

    await ensureTagProgressionSchema();

    const tags = await prisma.tag.findMany({
      where: {
        // Filter by the current user's ID
        userId,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(tags);
  } catch (error) {
    logger.error(
      "Error fetching tags:",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      LOG_SOURCE
    );
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;

    await ensureTagProgressionSchema();

    const body = await request.json();
    logger.debug("Received tag creation request", { body }, LOG_SOURCE);

    if (!body || typeof body.name !== "string" || !body.name.trim()) {
      logger.warn(
        "Tag validation failed",
        {
          hasBody: !!body,
          nameType: typeof body?.name,
          nameTrimmed: body?.name?.trim?.(),
        },
        LOG_SOURCE
      );
      return new NextResponse(
        JSON.stringify({
          error: "Name is required",
          details: {
            hasBody: !!body,
            nameType: typeof body?.name,
            receivedName: body?.name,
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const name = body.name.trim();
    const color = body.color;
    const category =
      typeof body.category === "string" && body.category.trim().length > 0
        ? body.category.trim()
        : undefined;
    const statKey =
      typeof body.statKey === "string" && body.statKey.trim().length > 0
        ? body.statKey.trim()
        : undefined;

    // Check if tag with same name already exists for this user
    const existingTag = await prisma.tag.findFirst({
      where: {
        name,
        userId,
      },
    });

    if (existingTag) {
      return new NextResponse(
        JSON.stringify({ error: "Tag with this name already exists" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = {
      name,
      color: color ?? null,
      category: category ?? null,
      statKey: statKey ?? null,
      user: userId ? { connect: { id: userId } } : undefined,
    };

    const tag = await prisma.tag.create({
      data: data as unknown as Prisma.TagUncheckedCreateInput,
    });

    return NextResponse.json(tag);
  } catch (error) {
    logger.error(
      "Error creating tag:",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      LOG_SOURCE
    );
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
