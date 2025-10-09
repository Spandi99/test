import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import {
  createConditionalLearningEvents,
  hasConditionalLearningFlag,
} from "@/lib/conditional-learning";

const FEED_ID = "feed-1";

function buildPrismaMock(blockers: unknown[] = []) {
  const createMock = jest.fn().mockImplementation(({ data }) =>
    Promise.resolve({
      id: `event-${createMock.mock.calls.length + 1}`,
      feedId: FEED_ID,
      feed: {
        id: FEED_ID,
        name: "Local",
        color: null,
        type: "LOCAL",
      },
      ...data,
    })
  );

  const prisma = {
    calendarEvent: {
      findMany: jest.fn().mockResolvedValue(blockers),
      create: createMock,
    },
  } as unknown as PrismaClient;

  return { prisma, createMock } as const;
}

describe("hasConditionalLearningFlag", () => {
  it("detects conditional flag in input metadata", () => {
    const metadata: Prisma.InputJsonObject = {
      flags: ["conditional-learning", "flexible"],
    };

    expect(hasConditionalLearningFlag(metadata)).toBe(true);
  });

  it("detects conditional flag in stored metadata", () => {
    const metadata: Prisma.JsonObject = {
      flags: ["dopamine"],
    };

    expect(hasConditionalLearningFlag(metadata)).toBe(false);

    metadata.flags = ["fixed", "conditional-learning"];
    expect(hasConditionalLearningFlag(metadata)).toBe(true);
  });

  it("returns false for null-like metadata", () => {
    expect(hasConditionalLearningFlag(null)).toBe(false);
    expect(hasConditionalLearningFlag(Prisma.JsonNull)).toBe(false);
  });
});

describe("createConditionalLearningEvents", () => {
  it("splits a learning block around fixed blockers and annotates metadata", async () => {
    const blockers = [
      {
        id: "fixed-1",
        start: new Date("2024-01-01T08:00:00.000Z"),
        end: new Date("2024-01-01T10:00:00.000Z"),
        metadata: { flags: ["fixed"] },
        feed: { type: "LOCAL" },
      },
      {
        id: "fixed-2",
        start: new Date("2024-01-01T11:00:00.000Z"),
        end: new Date("2024-01-01T12:00:00.000Z"),
        metadata: { flags: ["fixed"] },
        feed: { type: "LOCAL" },
      },
    ];

    const { prisma, createMock } = buildPrismaMock(blockers);

    const start = new Date("2024-01-01T08:00:00.000Z");
    const end = new Date("2024-01-01T17:00:00.000Z");
    const metadata: Prisma.JsonObject = {
      flags: ["conditional-learning"],
      tags: [{ id: "tag-1", name: "Focus", color: "#fff" }],
    };

    const events = await createConditionalLearningEvents({
      prisma,
      userId: "user-1",
      feedId: FEED_ID,
      baseData: {
        title: "Lernblock",
        description: null,
        location: null,
        allDay: false,
        isRecurring: false,
      },
      start,
      end,
      metadata,
    });

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(events).toHaveLength(2);

    const firstCall = createMock.mock.calls[0]?.[0];
    const secondCall = createMock.mock.calls[1]?.[0];

    expect(firstCall?.data.start).toEqual(new Date("2024-01-01T10:00:00.000Z"));
    expect(firstCall?.data.end).toEqual(new Date("2024-01-01T11:00:00.000Z"));
    expect(secondCall?.data.start).toEqual(new Date("2024-01-01T12:00:00.000Z"));
    expect(secondCall?.data.end).toEqual(new Date("2024-01-01T17:00:00.000Z"));

    const firstMetadata = firstCall?.data.metadata as Prisma.JsonObject;
    expect(firstMetadata.flags).toContain("conditional-learning");
    expect(firstMetadata.segmentIndex).toBe(0);
    expect(firstMetadata.segmentCount).toBe(2);
    expect(firstMetadata.originalStart).toBe(start.toISOString());
    expect(firstMetadata.originalEnd).toBe(end.toISOString());
  });

  it("returns no events when no qualifying gap exists", async () => {
    const blockers = [
      {
        id: "fixed-1",
        start: new Date("2024-01-01T08:00:00.000Z"),
        end: new Date("2024-01-01T09:00:00.000Z"),
        metadata: { flags: ["fixed"] },
        feed: { type: "LOCAL" },
      },
    ];

    const { prisma, createMock } = buildPrismaMock(blockers);

    const events = await createConditionalLearningEvents({
      prisma,
      userId: "user-1",
      feedId: FEED_ID,
      baseData: {
        title: "Kurzblock",
        description: null,
        location: null,
      },
      start: new Date("2024-01-01T08:00:00.000Z"),
      end: new Date("2024-01-01T09:30:00.000Z"),
      metadata: { flags: ["conditional-learning"] } as Prisma.JsonObject,
    });

    expect(events).toHaveLength(0);
    expect(createMock).not.toHaveBeenCalled();
  });
});
